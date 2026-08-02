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
    # Flip a character in the middle of the token, not the last one. The final
    # base64url character of a JWT segment can carry unused padding bits, so some
    # replacement characters there decode to the exact same bytes and don't
    # actually change the signature - that made this test flaky (it passed or
    # failed depending on what character the signature happened to end with). A
    # middle character has no such ambiguity: changing it always changes the
    # decoded bytes, so the signature check reliably fails.
    mid = len(token) // 2
    tampered = token[:mid] + ("a" if token[mid] != "a" else "b") + token[mid + 1 :]
    assert decode_access_token(tampered) is None
