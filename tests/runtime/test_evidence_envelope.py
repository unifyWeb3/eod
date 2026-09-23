"""Local evidence-preparation tests; they do not contact a hosting provider."""

import importlib.util
from pathlib import Path

import pytest
from eth_utils import keccak


ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("build_evidence_envelope", ROOT / "scripts" / "build_evidence_envelope.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

BASE = "https://raw.githubusercontent.com/eod-fixtures/evidence/0123456789abcdef0123456789abcdef01234567/evidence"


def test_builds_the_exact_commit_pinned_digest_addressed_envelope():
    body = b"exact UTF-8 evidence"
    envelope = MODULE.build_envelope("artifact-1", body, BASE)
    digest = keccak(body).hex()
    artifact = envelope["artifacts"][0]
    assert artifact["digest"] == "keccak256:" + digest
    assert artifact["source"] == BASE + "/keccak256/" + digest + ".txt"
    assert artifact["media_type"] == "text/plain; charset=utf-8"


@pytest.mark.parametrize(
    "base_url",
    [
        "https://evidence.example/keccak256",
        "https://raw.githubusercontent.com/eod-fixtures/evidence/main/evidence",
        BASE + "/",
    ],
)
def test_rejects_non_commit_pinned_or_ambiguous_evidence_bases(base_url):
    with pytest.raises(ValueError):
        MODULE.build_envelope("artifact-1", b"x", base_url)


def test_rejects_oversized_or_non_utf8_local_content():
    with pytest.raises(ValueError):
        MODULE.build_envelope("artifact-1", b"x" * 4097, BASE)
    with pytest.raises(UnicodeDecodeError):
        MODULE.build_envelope("artifact-1", b"\xff", BASE)
