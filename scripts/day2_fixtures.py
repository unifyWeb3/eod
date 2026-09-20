"""Day-2 four-fixture demo: acceptance contract + per-fixture escrow cycles.

Fixtures: pass / structural-fail / semantic-fail / undetermined.
ACCEPT -> release to owned seller; REJECT -> refund to buyer;
UNDETERMINED -> funds stay locked. Structural fail stops at submit
(no LLM, no escrow). Resumable via scripts/day2_state.json.
Secrets-safe: redacted logs, keys never printed.
"""

import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gl_patch

gl_patch.apply()

BASE_CHAIN = 84532
GL_CHAIN = 61997
ALLOWED = {61997, 61999, 4221, 84532, 61127}
MAINNETS = {1, 8453, 10, 137, 42161}
STATE_PATH = os.path.join(os.path.dirname(__file__), "day2_state.json")
BASE_EXPLORER = "https://sepolia.basescan.org"
ACCEPTANCE = "0xFB388b8213a8Ac809B212E879E62e103F6d7767b"
FUND_WEI = 10_000_000_000_000_000
SELLER_KEY_PATH = "/home/unify/.config/eod-seller.key"

POLICY = {
    "version": 1,
    "criteria": [
        {"id": "c1", "text": "The deliverable must state that the sky is blue.", "weight": 5},
        {"id": "c2", "text": "The deliverable must include the number 42.", "weight": 5},
    ],
}

GOOD_HASH = "a" * 64
FIXTURES = {
    "pass": {
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": GOOD_HASH,
            "text": "The sky is blue today. Reference number: 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "release",
    },
    "structural": {
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "NOT-A-HASH",
            "text": "The sky is blue today. Reference number: 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": False, "expect_submit_error": "[HASH_MISMATCH]",
    },
    "semantic": {
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "b" * 64,
            "text": "The sky is green today. Reference number: 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "refund",
    },
    "undetermined": {
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "c" * 64,
            "text": "The sky might be blue-ish, hard to tell in this light. "
                    "Possibly 42? Unclear.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
    "undetermined2": {
        "envelope": {"artifacts": [
            {"name": "report-a.txt", "hash": "d" * 64,
             "text": "Field survey: the sky is blue today. Reference number: 42.",
             "uri": "https://example.com/report-a.txt"},
            {"name": "report-b.txt", "hash": "e" * 64,
             "text": "Field survey: the sky is gray and overcast today. Reference number: 42.",
             "uri": "https://example.com/report-b.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
    "undetermined3": {
        "policy": {
            "version": 1,
            "criteria": [
                {"id": "c1", "text": "The deliverable must PROVE the sky is blue beyond reasonable doubt.", "weight": 5},
                {"id": "c2", "text": "The deliverable must include the number 42.", "weight": 5},
            ],
        },
        "envelope": {"artifacts": [
            {"name": "report-a.txt", "hash": "d" * 64,
             "text": "Field survey: the sky is blue today. Reference number: 42.",
             "uri": "https://example.com/report-a.txt"},
            {"name": "report-b.txt", "hash": "e" * 64,
             "text": "Field survey: the sky is gray and overcast today. Reference number: 42.",
             "uri": "https://example.com/report-b.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
    "undetermined6": {
        "policy": {
            "version": 1,
            "criteria": [
                {"id": "c1", "text": "The deliverable must state what the sky will look like tomorrow.", "weight": 5},
                {"id": "c2", "text": "The deliverable must include the number 42.", "weight": 5},
            ],
        },
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "1" * 64,
            "text": "The sky is blue today. Number 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
    "undetermined5": {
        "policy": {
            "version": 1,
            "criteria": [
                {"id": "c1", "text": "The deliverable must state the EXACT shade of blue of the sky (e.g. azure, cerulean, navy).", "weight": 5},
                {"id": "c2", "text": "The deliverable must include the number 42.", "weight": 5},
            ],
        },
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "0" * 64,
            "text": "The sky is blue. Number 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
    "undetermined4": {
        "envelope": {"artifacts": [{
            "name": "report.txt", "hash": "f" * 64,
            "text": "The sky is blue. The sky is not blue. Number 42.",
            "uri": "https://example.com/report.txt"}]},
        "escrow": True, "expect_settle": "locked",
    },
}


def load_env(path):
    d = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def redact(a):
    s = str(a)
    return "0x****..." + s[-4:] if s.lower().startswith("0x") else "****..." + s[-4:]


def log(*a):
    print(*a, flush=True)


def erpc(url, method, params=(), tries=8):
    body = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": list(params), "id": 1}
    ).encode()
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(
                url, data=body,
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                method="POST",
            )
            return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        except Exception as e:
            last = e
            time.sleep(5)
    raise last


def guard(url, expect, label):
    cid = int(erpc(url, "eth_chainId")["result"], 16)
    if cid in MAINNETS or cid not in ALLOWED or cid != expect:
        log(f"ABORT {label}: chain {cid}")
        sys.exit(3)
    log(f"{label}: chain {cid} OK")


def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(s):
    with open(STATE_PATH, "w") as f:
        json.dump(s, f, indent=2)


def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = load_env(os.path.join(root, ".env"))
    base_url, base_priv, base_me = (env["BASE_SEPOLIA_RPC_URL"],
                                    env["BASE_SEPOLIA_PRIVATE_KEY"],
                                    env["BASE_SEPOLIA_ADDRESS"])
    gl_url, gl_priv = env["GENLAYER_STUDIO_DEV_RPC"], env["GENLAYER_PRIVATE_KEY"]
    guard(base_url, BASE_CHAIN, "base-sepolia")
    guard(gl_url, GL_CHAIN, "studio-dev")

    from web3 import Web3
    from eth_account import Account as EthAccount
    w3 = Web3(Web3.HTTPProvider(base_url, request_kwargs={"timeout": 30}))
    acct = EthAccount.from_key(base_priv)
    seller_addr = EthAccount.from_key(open(SELLER_KEY_PATH).read().strip()).address
    log(f"owned seller {redact(seller_addr)} bal={w3.eth.get_balance(seller_addr) / 1e18:.6f} ETH")

    with open(os.path.join(root, "evm", "out", "SpikeEscrow.sol", "SpikeEscrow.json")) as f:
        art = json.load(f)
    esc_factory = w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"]["object"])

    def send(tx):
        tx["chainId"] = BASE_CHAIN
        tx["nonce"] = w3.eth.get_transaction_count(acct.address)
        tx["gas"] = int(w3.eth.estimate_gas(tx) * 1.2)
        try:
            tx["maxPriorityFeePerGas"] = w3.eth.max_priority_fee
        except Exception:
            tx["maxPriorityFeePerGas"] = Web3.to_wei(1, "gwei")
        tx["maxFeePerGas"] = w3.eth.gas_price * 2
        return w3.eth.send_raw_transaction(
            acct.sign_transaction(tx).raw_transaction).hex()

    from genlayer_py import create_client, create_account
    from genlayer_py.chains import studio_devnet
    from genlayer_py.transactions import is_successful
    gacct = create_account(gl_priv)
    client = create_client(chain=studio_devnet, endpoint=gl_url, account=gacct)

    def gfees():
        return client.estimate_transaction_fees({
            "leaderTimeunitsAllocation": 100, "validatorTimeunitsAllocation": 200,
            "totalMessageFees": 0, "appealRounds": 0, "rotations": [1]})

    state = load_state()
    names = [only] if only else list(FIXTURES)
    for name in names:
        fx = FIXTURES[name]
        st = state.setdefault(name, {})
        log(f"===== fixture {name} =====")
        # 1. create job (adopt job-4 if a previous create landed but state was lost)
        if "job_id" not in st:
            policy = fx.get("policy", POLICY)
            raw = client.read_contract(ACCEPTANCE, "get_job_count", account=gacct)
            n0 = int(raw, 16) if isinstance(raw, str) and raw.startswith("0x") else int(raw)
            if n0 >= 4:
                try:
                    blob = json.loads(client.read_contract(
                        ACCEPTANCE, "get_job", account=gacct, args=["job-4"]))
                    if blob["status"] in ("OPEN", "SUBMITTED"):
                        st["job_id"] = "job-4"
                        st["create_tx"] = "adopted-after-502"
                        save_state(state)
                        log(f"{name}: adopted job-4 ({blob['status']})")
                except Exception as e:
                    log(f"{name}: adoption read failed ({type(e).__name__})")
            if "job_id" not in st:
                t0 = time.time()
                txh = client.write_contract(
                    ACCEPTANCE, "create_job", account=gacct,
                    args=[json.dumps(policy)], fees=gfees())
                tx = client.wait_for_finalization(str(txh), interval=10, retries=180)
                if not is_successful(tx):
                    log(f"{name}: create_job FAILED onchain"); save_state(state); return 4
                # job id = current count
                raw = client.read_contract(ACCEPTANCE, "get_job_count", account=gacct)
                n = int(raw, 16) if isinstance(raw, str) and raw.startswith("0x") else int(raw)
                st["job_id"] = f"job-{n}"
                st["create_tx"] = str(txh)
                st["create_s"] = round(time.time() - t0)
                save_state(state)
        log(f"{name}: {st['job_id']} create_tx={st['create_tx']}")
        # 2. submit
        if "submit_tx" not in st and "submit_error" not in st:
            t0 = time.time()
            txh = client.write_contract(
                ACCEPTANCE, "submit_deliverable", account=gacct,
                args=[st["job_id"], json.dumps(fx["envelope"])], fees=gfees())
            tx = client.wait_for_finalization(str(txh), interval=10, retries=180)
            if not is_successful(tx):
                import re
                st["submit_tx"] = str(txh)
                st["submit_error"] = "deterministic-gate (see explorer)"
                save_state(state)
                log(f"{name}: submit REJECTED by gate tx={st['submit_tx']}")
            else:
                st["submit_tx"] = str(txh)
                st["submit_s"] = round(time.time() - t0)
                save_state(state)
                log(f"{name}: submitted tx={st['submit_tx']}")
        if "submit_error" in st:
            log(f"{name}: done at gate ({st['submit_error']})")
            continue
        # 3. escrow cycle (deploy+fund before evaluate so verdict can settle)
        if fx["escrow"] and "escrow" not in st:
            tx = esc_factory.constructor(seller_addr, acct.address).build_transaction(
                {"from": acct.address, "value": FUND_WEI})
            h = send(tx)
            rc = w3.eth.wait_for_transaction_receipt(h, timeout=600)
            st["escrow"] = rc["contractAddress"]
            st["escrow_tx"] = h
            save_state(state)
            log(f"{name}: escrow {redact(st['escrow'])} tx={h}")
        # 4. evaluate (retry on validator disagreement; failures leave no state)
        if "eval_tx" not in st:
            for att in range(3):
                t0 = time.time()
                txh = client.write_contract(
                    ACCEPTANCE, "evaluate", account=gacct,
                    args=[st["job_id"]], fees=gfees())
                tx = client.wait_for_finalization(str(txh), interval=10, retries=240)
                if is_successful(tx):
                    st.setdefault("eval_txs", []).append(str(txh))
                    st["eval_tx"] = str(txh)
                    st["eval_s"] = round(time.time() - t0)
                    st["eval_attempts"] = att + 1
                    blob = json.loads(client.read_contract(
                        ACCEPTANCE, "get_job", account=gacct, args=[st["job_id"]]))
                    st["verdict"] = blob["status"]
                    st["receipt"] = blob["receipt"]
                    st["rationale"] = blob["rationale"]
                    save_state(state)
                    break
                log(f"{name}: evaluate attempt {att + 1} no-consensus tx={txh}, checking status...")
                try:
                    blob = json.loads(client.read_contract(
                        ACCEPTANCE, "get_job", account=gacct, args=[st["job_id"]]))
                except Exception as e:
                    log(f"{name}: status read failed ({type(e).__name__}), continuing...")
                    continue
                if blob["status"] in ("ACCEPT", "REJECT", "UNDETERMINED"):
                    log(f"{name}: job settled ({blob['status']}) despite tx failure; recording.")
                    st.setdefault("eval_txs", []).append(str(txh))
                    st["eval_tx"] = str(txh)
                    st["verdict"] = blob["status"]
                    st["receipt"] = blob["receipt"]
                    st["rationale"] = blob["rationale"]
                    save_state(state)
                    break
                if blob["status"] != "SUBMITTED":
                    log(f"{name}: job left SUBMITTED unexpectedly ({blob['status']})")
                    save_state(state)
                    return 5
            else:
                st["eval_tx"] = str(txh)
                save_state(state)
                log(f"{name}: evaluate FAILED after 3 attempts")
                return 5
        log(f"{name}: verdict={st['verdict']} receipt={st['receipt']} rationale={st['rationale']}")
        # 5. settle
        if fx["escrow"] and "settle_tx" not in st:
            esc = w3.eth.contract(address=st["escrow"], abi=art["abi"])
            if st["verdict"] == "ACCEPT":
                h = send(esc.functions.release().build_transaction({"from": acct.address}))
                kind = "release"
            elif st["verdict"] == "REJECT":
                h = send(esc.functions.refund().build_transaction({"from": acct.address}))
                kind = "refund"
            else:
                st["settle_tx"] = "LOCKED-no-tx"
                save_state(state)
                log(f"{name}: UNDETERMINED -> funds stay locked")
                continue
            rc = w3.eth.wait_for_transaction_receipt(h, timeout=600)
            st["settle_tx"] = h
            st["settle_kind"] = kind
            st["settle_status"] = rc["status"]
            save_state(state)
            log(f"{name}: {kind} tx={h} status={rc['status']}")
    log("DONE fixtures")
    return 0


if __name__ == "__main__":
    sys.exit(main())
