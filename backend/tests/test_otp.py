from app.services import otp as otp_module
from app.services.otp import (
    clear_verification,
    generate_otp,
    is_email_verified,
    verify_otp,
)


def test_generate_otp_returns_four_digit_code():
    code = generate_otp("otp-gen@example.com", "register")

    assert len(code) == 4
    assert code.isdigit()


def test_verify_otp_succeeds_and_marks_email_verified():
    email = "otp-verify@example.com"
    code = generate_otp(email, "register")

    assert verify_otp(email, code, "register") is True
    assert is_email_verified(email, "register") is True


def test_verify_otp_consumes_the_code_so_it_cannot_be_reused():
    email = "otp-reuse@example.com"
    code = generate_otp(email, "register")

    assert verify_otp(email, code, "register") is True
    # Second attempt with the same code: the (email, purpose) key was deleted on
    # first success, so this now falls into the "no OTP was ever requested" path.
    assert verify_otp(email, code, "register") is False


def test_verify_otp_fails_for_email_with_no_pending_otp():
    assert verify_otp("otp-never-requested@example.com", "1234", "register") is False


def test_verify_otp_fails_for_wrong_code():
    email = "otp-wrong@example.com"
    generate_otp(email, "register")

    assert verify_otp(email, "0000", "register") is False
    assert is_email_verified(email, "register") is False


def test_verify_otp_fails_once_expired(monkeypatch):
    email = "otp-expired@example.com"
    code = generate_otp(email, "register")

    real_time = otp_module.time.time
    monkeypatch.setattr(otp_module.time, "time", lambda: real_time() + otp_module.OTP_EXPIRY_SECONDS + 1)

    assert verify_otp(email, code, "register") is False
    # Expiry also deletes the stored entry - confirm a fresh OTP still works afterwards.
    monkeypatch.undo()
    new_code = generate_otp(email, "register")
    assert verify_otp(email, new_code, "register") is True


def test_is_email_verified_false_when_never_verified():
    assert is_email_verified("otp-unverified@example.com", "register") is False


def test_is_email_verified_expires_after_window(monkeypatch):
    email = "otp-verified-expiry@example.com"
    code = generate_otp(email, "register")
    assert verify_otp(email, code, "register") is True
    assert is_email_verified(email, "register") is True

    real_time = otp_module.time.time
    monkeypatch.setattr(otp_module.time, "time", lambda: real_time() + otp_module.OTP_EXPIRY_SECONDS + 1)

    assert is_email_verified(email, "register") is False
    # Expiry deletes the entry - checking again should still cleanly report False.
    assert is_email_verified(email, "register") is False


def test_clear_verification_removes_verified_state():
    email = "otp-clear@example.com"
    code = generate_otp(email, "register")
    verify_otp(email, code, "register")
    assert is_email_verified(email, "register") is True

    clear_verification(email, "register")

    assert is_email_verified(email, "register") is False


def test_clear_verification_is_a_noop_when_nothing_to_clear():
    # Must not raise even though "otp-clear-noop@example.com" was never verified.
    clear_verification("otp-clear-noop@example.com", "register")


def test_otp_purposes_are_independent():
    email = "otp-purposes@example.com"
    register_code = generate_otp(email, "register")
    forgot_code = generate_otp(email, "forgot_password")

    # A code generated for one purpose must not verify against another.
    assert verify_otp(email, register_code, "forgot_password") is False
    assert verify_otp(email, forgot_code, "forgot_password") is True
