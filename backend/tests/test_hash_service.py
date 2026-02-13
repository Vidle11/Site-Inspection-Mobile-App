from app.services.hash_service import canonical_json_hash


def test_canonical_hash_stable_order():
    a = {"b": 1, "a": 2}
    b = {"a": 2, "b": 1}
    assert canonical_json_hash(a) == canonical_json_hash(b)
