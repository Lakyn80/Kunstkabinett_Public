import pytest
import httpx

from app.modules.ai.http_retry import (
    is_retryable_network_error,
    post_json_with_retry,
)


def test_is_retryable_network_error_detects_dns_message():
    exc = Exception("[Errno -3] Temporary failure in name resolution")
    assert is_retryable_network_error(exc) is True


def test_is_retryable_network_error_detects_httpx_connect_error():
    request = httpx.Request("POST", "https://example.com")
    exc = httpx.ConnectError("connect failed", request=request)
    assert is_retryable_network_error(exc) is True


@pytest.mark.asyncio
async def test_post_json_with_retry_retries_on_retryable_status(monkeypatch):
    responses = [
        httpx.Response(503, text="busy"),
        httpx.Response(200, text='{"ok": true}'),
    ]
    calls = {"count": 0}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            calls["count"] += 1
            return responses.pop(0)

    async def fake_sleep(_):
        return None

    monkeypatch.setattr("app.modules.ai.http_retry.httpx.AsyncClient", FakeClient)
    monkeypatch.setattr("app.modules.ai.http_retry.asyncio.sleep", fake_sleep)
    monkeypatch.setattr("app.modules.ai.http_retry.random.uniform", lambda _a, _b: 0.0)

    response = await post_json_with_retry(
        url="https://example.com",
        headers={"x": "1"},
        payload={"a": 1},
        attempts=3,
        timeout=5.0,
    )

    assert response.status_code == 200
    assert calls["count"] == 2


@pytest.mark.asyncio
async def test_post_json_with_retry_does_not_retry_on_non_retryable_status(monkeypatch):
    responses = [
        httpx.Response(400, text="bad request"),
        httpx.Response(200, text='{"ok": true}'),
    ]
    calls = {"count": 0}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            calls["count"] += 1
            return responses.pop(0)

    monkeypatch.setattr("app.modules.ai.http_retry.httpx.AsyncClient", FakeClient)

    response = await post_json_with_retry(
        url="https://example.com",
        headers={"x": "1"},
        payload={"a": 1},
        attempts=3,
        timeout=5.0,
    )

    assert response.status_code == 400
    assert calls["count"] == 1


@pytest.mark.asyncio
async def test_post_json_with_retry_retries_on_dns_failure(monkeypatch):
    responses = [
        Exception("[Errno -3] Temporary failure in name resolution"),
        httpx.Response(200, text='{"ok": true}'),
    ]
    calls = {"count": 0}

    class FakeClient:
        def __init__(self, timeout):
            self.timeout = timeout

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, url, headers=None, json=None):
            calls["count"] += 1
            item = responses.pop(0)
            if isinstance(item, Exception):
                raise item
            return item

    async def fake_sleep(_):
        return None

    monkeypatch.setattr("app.modules.ai.http_retry.httpx.AsyncClient", FakeClient)
    monkeypatch.setattr("app.modules.ai.http_retry.asyncio.sleep", fake_sleep)
    monkeypatch.setattr("app.modules.ai.http_retry.random.uniform", lambda _a, _b: 0.0)

    response = await post_json_with_retry(
        url="https://example.com",
        headers={"x": "1"},
        payload={"a": 1},
        attempts=3,
        timeout=5.0,
    )

    assert response.status_code == 200
    assert calls["count"] == 2
