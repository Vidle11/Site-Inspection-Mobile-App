import hashlib
import json
from typing import Any


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def canonical_json_hash(payload: Any) -> str:
    canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return sha256_hex(canonical)


def chained_audit_hash(prev_hash: str, payload: Any) -> str:
    payload_hash = canonical_json_hash(payload)
    return sha256_hex(f"{prev_hash}:{payload_hash}")
