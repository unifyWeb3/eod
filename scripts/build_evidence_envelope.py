"""Build a strict Stage 3a evidence envelope from local, exact UTF-8 bytes.

This tool does not upload or fetch evidence. It prepares the seller's
submission only after the content has been placed at a reviewed, commit-pinned
GitHub raw URL by the separate integration ceremony.
"""

import argparse
import json
from pathlib import Path

from eth_utils import keccak


MAX_ARTIFACT_BYTES = 4096
MAX_ID_BYTES = 64
EVIDENCE_BASE_PREFIX = "https://raw.githubusercontent.com/"
MEDIA_TYPE = "text/plain; charset=utf-8"


def validate_evidence_base_url(base_url: str) -> str:
    if not isinstance(base_url, str) or len(base_url.encode("utf-8")) > 253:
        raise ValueError("evidence base URL is too large")
    if not base_url.startswith(EVIDENCE_BASE_PREFIX):
        raise ValueError("evidence base must use raw.githubusercontent.com")
    parts = base_url[len(EVIDENCE_BASE_PREFIX):].split("/")
    if len(parts) != 4 or parts[3] != "evidence":
        raise ValueError("evidence base must select owner/repo/full-commit/evidence")
    for value in parts[:2]:
        if len(value) == 0 or len(value) > 100 or any(
            not ("a" <= ch <= "z" or "0" <= ch <= "9" or ch in "-_.") for ch in value
        ):
            raise ValueError("evidence repository component is invalid")
    commit = parts[2]
    if len(commit) != 40 or any(not ("0" <= ch <= "9" or "a" <= ch <= "f") for ch in commit):
        raise ValueError("evidence base must use a lowercase 40-hex commit")
    return base_url


def build_envelope(artifact_id: str, body: bytes, evidence_base_url: str) -> dict:
    validate_evidence_base_url(evidence_base_url)
    if not isinstance(artifact_id, str) or not (0 < len(artifact_id.encode("utf-8")) <= MAX_ID_BYTES):
        raise ValueError("artifact id must be 1-64 UTF-8 bytes")
    if not (0 < len(body) <= MAX_ARTIFACT_BYTES):
        raise ValueError("artifact must be 1-4096 bytes")
    body.decode("utf-8")
    digest = keccak(body).hex()
    return {
        "artifacts": [
            {
                "id": artifact_id,
                "source": evidence_base_url + "/keccak256/" + digest + ".txt",
                "digest": "keccak256:" + digest,
                "media_type": MEDIA_TYPE,
            }
        ]
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-base-url", required=True)
    parser.add_argument("--artifact-id", required=True)
    parser.add_argument("--file", required=True)
    args = parser.parse_args()
    body = Path(args.file).read_bytes()
    print(json.dumps(build_envelope(args.artifact_id, body, args.evidence_base_url), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
