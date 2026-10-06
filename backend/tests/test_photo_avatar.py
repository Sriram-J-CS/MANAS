import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_photo_avatar_match_endpoint_requires_photo():
    response = client.post("/api/agent/avatar/photo-match", json={"photo_base64": ""})
    assert response.status_code == 400

def test_photo_avatar_match_endpoint_returns_structured_attributes():
    # 1x1 transparent png base64
    fake_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    response = client.post("/api/agent/avatar/photo-match", json={"photo_base64": fake_b64})
    assert response.status_code == 200
    data = response.json()
    assert "skin_tone_hex" in data
    assert "hair_color_hex" in data
    assert "eye_color_hex" in data
    assert "lip_color_hex" in data
    assert "glasses" in data
    assert "glasses_shape" in data
    assert "confidence" in data
    assert isinstance(data["glasses"], bool)
