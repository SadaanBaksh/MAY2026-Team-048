import random
import time

_otp_store: dict[tuple[str, str], tuple[str, float]] = {}
_verified_emails: dict[tuple[str, str], float] = {}

OTP_EXPIRY_SECONDS = 900  # 15 minutes

def generate_otp(email: str, purpose: str) -> str:
    otp_code = f"{random.randint(0, 9999):04d}"
    expiry = time.time() + OTP_EXPIRY_SECONDS
    _otp_store[(email, purpose)] = (otp_code, expiry)
    return otp_code

def verify_otp(email: str, otp: str, purpose: str) -> bool:
    key = (email, purpose)
    if key not in _otp_store:
        return False
    
    stored_otp, expiry = _otp_store[key]
    if time.time() > expiry:
        del _otp_store[key]
        return False
        
    if stored_otp == otp:
        del _otp_store[key]
        _verified_emails[key] = time.time() + OTP_EXPIRY_SECONDS
        return True
        
    return False

def is_email_verified(email: str, purpose: str) -> bool:
    key = (email, purpose)
    if key not in _verified_emails:
        return False
        
    if time.time() > _verified_emails[key]:
        del _verified_emails[key]
        return False
        
    return True

def clear_verification(email: str, purpose: str) -> None:
    key = (email, purpose)
    if key in _verified_emails:
        del _verified_emails[key]
