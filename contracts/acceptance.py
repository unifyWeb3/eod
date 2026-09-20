# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
import genlayer as gl
from genlayer.types import *
from genlayer.storage import TreeMap
import json


class Acceptance(gl.contract.Contract):
    """Routine acceptance adapter: versioned policy -> typed envelope ->
    deterministic gates -> single comparative LLM judgment on the
    subjective residue. Receipt-gated downstream release/hold.
    UNDETERMINED is first-class. No custody in this contract.
    """

    jobs: TreeMap[str, str]
    job_count: u256

    def __init__(self):
        self.job_count = u256(0)

    def _is_hex64(self, s: str) -> bool:
        if len(s) != 64:
            return False
        for ch in s:
            if not (
                ("0" <= ch and ch <= "9")
                or ("a" <= ch and ch <= "f")
                or ("A" <= ch and ch <= "F")
            ):
                return False
        return True

    def _load_job(self, job_id: str) -> dict:
        try:
            raw = self.jobs[job_id]
        except Exception:
            raise gl.vm.UserError("[EXPECTED] unknown job")
        if raw == "":
            raise gl.vm.UserError("[EXPECTED] unknown job")
        return json.loads(raw)

    def _save_job(self, job_id: str, job: dict) -> None:
        self.jobs[job_id] = json.dumps(job, sort_keys=True)

    @gl.public.write
    def create_job(self, policy_json: str) -> str:
        try:
            policy = json.loads(policy_json)
        except Exception:
            raise gl.vm.UserError("[SCHEMA] policy is not valid JSON")
        criteria = policy.get("criteria", [])
        if not isinstance(criteria, list) or not (2 <= len(criteria) <= 4):
            raise gl.vm.UserError("[SCHEMA] policy needs 2-4 criteria")
        seen = ""
        for c in criteria:
            cid = c.get("id", "")
            text = c.get("text", "")
            weight = c.get("weight", 0)
            if not isinstance(cid, str) or cid == "":
                raise gl.vm.UserError("[SCHEMA] criterion ids must be non-empty")
            if cid in seen.split(","):
                raise gl.vm.UserError("[SCHEMA] criterion ids must be unique")
            seen = seen + cid + ","
            if not isinstance(text, str) or text == "" or len(text) > 500:
                raise gl.vm.UserError("[SCHEMA] criterion text invalid")
            if not isinstance(weight, int) or not (1 <= weight <= 10):
                raise gl.vm.UserError("[SCHEMA] criterion weight must be 1-10")
        version = policy.get("version", 0)
        if not isinstance(version, int) or version < 1:
            raise gl.vm.UserError("[SCHEMA] policy version must be >= 1")
        self.job_count = self.job_count + u256(1)
        job_id = "job-" + str(int(self.job_count))
        job = {
            "policy": policy,
            "envelope": None,
            "status": "OPEN",
            "results": [],
            "receipt": "",
            "rationale": "",
        }
        self._save_job(job_id, job)
        return job_id

    @gl.public.write
    def submit_deliverable(self, job_id: str, envelope_json: str) -> None:
        job = self._load_job(job_id)
        status = job["status"]
        if status != "OPEN":
            if status in ("ACCEPT", "REJECT", "UNDETERMINED"):
                raise gl.vm.UserError("[STALE] job already settled")
            raise gl.vm.UserError("[EXPECTED] job not open for submission")
        try:
            env = json.loads(envelope_json)
        except Exception:
            raise gl.vm.UserError("[SCHEMA] envelope is not valid JSON")
        artifacts = env.get("artifacts", [])
        if not isinstance(artifacts, list) or len(artifacts) == 0:
            raise gl.vm.UserError("[MISSING] envelope has no artifacts")
        if len(artifacts) > 4:
            raise gl.vm.UserError("[SCHEMA] envelope has too many artifacts")
        for a in artifacts:
            name = a.get("name", "")
            h = a.get("hash", "")
            text = a.get("text", "")
            uri = a.get("uri", "")
            if not isinstance(name, str) or name == "":
                raise gl.vm.UserError("[MISSING] artifact without name")
            if not isinstance(text, str) or text == "":
                raise gl.vm.UserError("[MISSING] artifact without text")
            if not isinstance(h, str) or not self._is_hex64(h):
                raise gl.vm.UserError("[HASH_MISMATCH] artifact hash must be 64 hex chars")
            if not isinstance(uri, str) or not (
                uri.startswith("https://") or uri.startswith("ipfs://")
            ):
                raise gl.vm.UserError("[SOURCE_BLOCKED] artifact uri scheme not allowed")
        job["envelope"] = env
        job["status"] = "SUBMITTED"
        self._save_job(job_id, job)

    @gl.public.write
    def evaluate(self, job_id: str) -> None:
        job = self._load_job(job_id)
        status = job["status"]
        if status == "OPEN":
            raise gl.vm.UserError("[EXPECTED] nothing submitted yet")
        if status in ("ACCEPT", "REJECT", "UNDETERMINED"):
            raise gl.vm.UserError("[STALE] job already settled")
        criteria = job["policy"]["criteria"]
        artifacts = job["envelope"]["artifacts"]
        crit_text = ""
        for c in criteria:
            crit_text = crit_text + c["id"] + ": " + c["text"] + " | "
        art_text = ""
        for a in artifacts:
            art_text = art_text + a["name"] + ": " + a["text"] + " | "

        def leader_fn():
            prompt = (
                "Judge whether a deliverable satisfies each acceptance criterion. "
                "Return JSON only: {\"results\": [{\"id\": \"<criterion id>\", "
                "\"verdict\": \"PASS|FAIL|UNCLEAR\"}], "
                "\"rationale\": \"one sentence\"}. "
                "Use UNCLEAR only for genuine ambiguity. "
                "Criteria: " + crit_text + " Deliverable: " + art_text
            )
            return gl.nondet.exec_prompt(prompt, response_format="json")

        def norm(v) -> str:
            return str(v).strip().upper().rstrip(".")

        def validator_fn(leader_result) -> bool:
            try:
                leader_data = leader_result.calldata
            except Exception:
                return False
            try:
                mine = leader_fn()
            except Exception:
                return False
            try:
                if len(mine["results"]) != len(leader_data["results"]):
                    return False
                lv = {}
                for r in leader_data["results"]:
                    lv[str(r["id"])] = norm(r["verdict"])
                mv = {}
                for r in mine["results"]:
                    mv[str(r["id"])] = norm(r["verdict"])
                for k in lv:
                    if k not in mv or mv[k] != lv[k]:
                        return False
                for k in mv:
                    if k not in lv:
                        return False
                return True
            except Exception:
                return False

        result = gl.vm.run_nondet(leader_fn, validator_fn)
        verdicts = {}
        for r in result.get("results", []):
            v = str(r.get("verdict", "")).strip().upper().rstrip(".")
            if v not in ("PASS", "FAIL", "UNCLEAR"):
                raise gl.vm.UserError("[LLM_ERROR] bad criterion verdict")
            verdicts[str(r.get("id", ""))] = v
        if len(verdicts) != len(criteria):
            raise gl.vm.UserError("[LLM_ERROR] criterion coverage mismatch")
        overall = "ACCEPT"
        for c in criteria:
            v = verdicts.get(c["id"], "UNCLEAR")
            if v == "FAIL":
                overall = "REJECT"
                break
            if v == "UNCLEAR":
                overall = "UNDETERMINED"
        job["results"] = result.get("results", [])
        job["status"] = overall
        job["receipt"] = job_id + ":v" + str(job["policy"]["version"]) + ":" + overall
        job["rationale"] = str(result.get("rationale", ""))[:280]
        self._save_job(job_id, job)

    @gl.public.view
    def get_job(self, job_id: str) -> str:
        try:
            return self.jobs[job_id]
        except Exception:
            raise gl.vm.UserError("[EXPECTED] unknown job")

    @gl.public.view
    def get_receipt(self, job_id: str) -> str:
        job = self._load_job(job_id)
        return job["receipt"]

    @gl.public.view
    def get_job_count(self) -> u256:
        return self.job_count
