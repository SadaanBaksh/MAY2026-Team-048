def test_list_categories_empty(client):
    response = client.get("/api/v1/categories/")
    assert response.status_code == 200
    assert response.json() == []


def test_list_categories_returns_seeded_rows(client, make_category):
    make_category(id="cat_plumbing", name="Plumbing", icon="water")
    make_category(id="cat_electrical", name="Electrical", icon="bolt")

    response = client.get("/api/v1/categories/")

    assert response.status_code == 200
    ids = {row["id"] for row in response.json()}
    assert ids == {"cat_plumbing", "cat_electrical"}


def test_get_category_by_id(client, make_category):
    make_category(id="cat_plumbing", name="Plumbing", icon="water")

    response = client.get("/api/v1/categories/cat_plumbing")

    assert response.status_code == 200
    assert response.json()["name"] == "Plumbing"


def test_get_category_not_found(client):
    response = client.get("/api/v1/categories/does-not-exist")
    assert response.status_code == 404
