from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_password_roundtrip():
    hashed = hash_password("Testpass123")
    assert hashed != "Testpass123"
    assert verify_password("Testpass123", hashed)


def test_verify_password_rejects_wrong_password():
    hashed = hash_password("Testpass123")
    assert not verify_password("WrongPassword", hashed)


def test_create_and_decode_access_token_roundtrip():
    token = create_access_token(subject="user-123")
    assert decode_access_token(token) == "user-123"


def test_decode_access_token_rejects_garbage():
    assert decode_access_token("not-a-real-token") is None


def test_decode_access_token_rejects_tampered_token():
    token = create_access_token(subject="user-123")
    tampered = token[:-1] + ("a" if token[-1] != "a" else "b")
    assert decode_access_token(tampered) is None
