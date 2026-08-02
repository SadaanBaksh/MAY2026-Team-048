def test_upload_photo_success(client, auth_headers, resident_user, mock_s3):
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("photo.jpg", b"fake-jpeg-bytes", "image/jpeg")},
        data={"kind": "photo"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["url"].endswith(".jpg")
    assert len(mock_s3) == 1
    assert mock_s3[0]["ContentType"] == "image/jpeg"


def test_upload_voice_note_webm_success(client, auth_headers, resident_user, mock_s3):
    """Regression test: web recordings send audio/webm, which must be accepted."""
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("voice.webm", b"fake-webm-bytes", "audio/webm")},
        data={"kind": "voice_note"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json()["url"].endswith(".webm")


def test_upload_voice_note_webm_with_codec_param_success(client, auth_headers, resident_user, mock_s3):
    """Regression test: some browsers send 'audio/webm;codecs=opus'."""
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("voice.webm", b"fake-webm-bytes", "audio/webm;codecs=opus")},
        data={"kind": "voice_note"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 200
    assert response.json()["url"].endswith(".webm")


def test_upload_requires_auth(client, mock_s3):
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("photo.jpg", b"fake-jpeg-bytes", "image/jpeg")},
        data={"kind": "photo"},
    )

    assert response.status_code == 401


def test_upload_unsupported_content_type(client, auth_headers, resident_user, mock_s3):
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("photo.gif", b"fake-gif-bytes", "image/gif")},
        data={"kind": "photo"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 415
    assert mock_s3 == []


def test_upload_oversized_photo_rejected(client, auth_headers, resident_user, mock_s3):
    oversized = b"x" * (10 * 1024 * 1024 + 1)

    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("photo.jpg", oversized, "image/jpeg")},
        data={"kind": "photo"},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 413
    assert mock_s3 == []


def test_upload_missing_kind_is_rejected(client, auth_headers, resident_user, mock_s3):
    response = client.post(
        "/api/v1/uploads/",
        files={"file": ("photo.jpg", b"fake-jpeg-bytes", "image/jpeg")},
        headers=auth_headers(resident_user),
    )

    assert response.status_code == 422


def test_get_s3_client_builds_and_caches_a_boto3_client(monkeypatch):
    """Exercises the real (un-mocked) client builder — boto3.client() only constructs
    a local object, it makes no network call, so this is safe to run for real."""
    import app.core.storage as storage

    monkeypatch.setattr(storage, "_s3_client", None)

    first = storage._get_s3_client()
    second = storage._get_s3_client()

    assert first is second
    assert hasattr(first, "put_object")
