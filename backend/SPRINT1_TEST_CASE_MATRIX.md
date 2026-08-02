# Sprint 1 API Testing Matrix

Suite roots: `backend/tests/integration/`, `backend/tests/test_security.py`, and selected tests from `backend/tests/test_limiter.py`  
Scope: Repository-level API integration tests and a representative selection of backend unit tests. Contract tests are excluded. This is not a catalogue of every test in the repository.

## Integration Test Cases

| Case ID | API being tested | Inputs | Expected output | Actual output | Result | Pytest function |
|---|---|---|---|---|---|---|
| INT-001 | `POST /api/v1/auth/register` -> `POST /api/v1/auth/login` -> `GET /api/v1/users/me` | Valid resident identity, apartment and password; then matching login credentials and returned bearer token | `201` active resident; `200` token; `200` matching authenticated profile | `201` active resident; `200` bearer token; `200` profile with matching email and apartment ID | Success | `test_int_001_resident_registration_login_and_profile_workflow` |
| INT-002 | `POST /api/v1/tickets/` -> role-based `PATCH /api/v1/tickets/{id}` -> history and worker profile `GET`s | Resident complaint; employee assignment; worker progress/resolution; resident close with rating `5` | Lifecycle reaches `Closed`; history is Pending -> Assigned -> In_Progress -> Resolved -> Closed; worker rating becomes `5.0` | All API calls returned `200/201`; lifecycle, five history entries, resolution date and rating `5.0` matched | Success | `test_int_002_complete_ticket_lifecycle_updates_history_and_worker_rating` |
| INT-003 | `POST /api/v1/tickets/{id}/comments` -> `GET /api/v1/notifications/me` -> `PATCH /api/v1/notifications/{id}/read` | Assigned ticket; resident message `The water supply is now turned off.`; assigned worker credentials | `201` comment; worker receives unread `New message`; marking it read returns `200` and `is_read=true` | Comment created; matching unread worker notification returned; notification updated to `is_read=true` | Success | `test_int_003_comment_creates_worker_notification_and_can_be_marked_read` |
| INT-004 | `GET /api/v1/tickets/`, `GET /api/v1/tickets/{id}`, `GET /api/v1/tickets/{id}/comments` | Ticket owned by resident A; bearer token for unrelated resident B | B's list is empty; direct ticket and comment access both return `403` | Empty list returned; ticket request `403`; comments request `403` | Success | `test_int_004_ticket_and_comment_access_is_isolated_between_residents` |
| INT-005 | `POST /api/v1/uploads/` -> `POST /api/v1/tickets/` -> `GET /api/v1/tickets/{id}` | Authenticated JPEG upload, then returned URL in `photo_urls` of a new complaint | `200` upload; `201` ticket; fetched ticket contains the uploaded URL as primary image and media entry | Upload and ticket creation succeeded; fetched image/media URLs matched; one mocked S3 write recorded | Success | `test_int_005_uploaded_photo_is_attached_to_new_ticket` |
| INT-006 | `POST /api/v1/tickets/` -> `PATCH /api/v1/tickets/{id}` | Resident attempts to change a newly created `Pending` ticket directly to `Closed` with rating `5` | `409 Conflict` with `Only resolved tickets can be closed`; ticket remains Pending | `200 OK`; API changed the ticket from Pending directly to Closed | Fail - known issue (`XFAIL`) | `test_int_006_resident_cannot_close_ticket_before_resolution` |

## Selected Unit Test Cases

| Case ID | Component being tested | Inputs | Expected output | Actual output | Result | Pytest function |
|---|---|---|---|---|---|---|
| UNIT-001 | `security.hash_password` and `security.verify_password` | Plain-text password `Testpass123` | Generated hash differs from the password and verification returns `True` | Hash differed from the password and verification returned `True` | Success | `test_hash_password_roundtrip` |
| UNIT-002 | `security.verify_password` | Hash of `Testpass123` checked using `WrongPassword` | Verification returns `False` | Verification returned `False` | Success | `test_verify_password_rejects_wrong_password` |
| UNIT-003 | `security.create_access_token` and `security.decode_access_token` | JWT subject `user-123` | Decoded token returns `user-123` | Decoder returned `user-123` | Success | `test_create_and_decode_access_token_roundtrip` |
| UNIT-004 | `security.decode_access_token` | Invalid token string `not-a-real-token` | Decoder safely returns `None` | Decoder returned `None` without raising an exception | Success | `test_decode_access_token_rejects_garbage` |
| UNIT-005 | JWT signature validation | Valid token whose middle character is changed | Tampered token is rejected and decoder returns `None` | Tampered token was rejected and decoder returned `None` | Success | `test_decode_access_token_rejects_tampered_token` |
| UNIT-006 | `limiter.rate_limit_key_for_user` | Request containing a valid bearer token for `user-123` | Rate-limit key is `user:user-123` | Rate-limit key was `user:user-123` | Success | `test_rate_limit_key_uses_user_id_from_token` |
| UNIT-007 | `limiter.rate_limit_key_for_user` | Same valid bearer token sent from `1.1.1.1` and `9.9.9.9` | Both requests produce the same user-based key | Both requests produced the same key | Success | `test_rate_limit_key_is_stable_across_different_client_ips` |
| UNIT-008 | `limiter.rate_limit_key_for_user` | Request with no token and request with an invalid bearer token; client IP `1.2.3.4` | Both requests fall back to key `1.2.3.4` | Both requests returned key `1.2.3.4` | Success | `test_rate_limit_key_falls_back_to_ip_without_a_valid_token` |

## Screenshot-friendly execution

From the `backend` directory:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\integration -vv -rx
```

The expected summary is `5 passed, 1 xfailed`. The `XFAIL` line is intentional evidence of the expected/actual mismatch required for the milestone report; it does not make the pytest command fail.

For a separate screenshot of the selected unit tests:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\test_security.py tests\test_limiter.py::test_rate_limit_key_uses_user_id_from_token tests\test_limiter.py::test_rate_limit_key_is_stable_across_different_client_ips tests\test_limiter.py::test_rate_limit_key_falls_back_to_ip_without_a_valid_token -vv
```

The expected unit-test summary is `8 passed`.
