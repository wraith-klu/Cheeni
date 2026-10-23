from unittest.mock import Mock

from tools import web_intelligence


def test_page_reader_rejects_private_and_non_web_destinations():
    assert web_intelligence._validate_public_http_url("http://127.0.0.1/") is False
    assert web_intelligence._validate_public_http_url("http://192.168.1.1/") is False
    assert web_intelligence._validate_public_http_url("file:///C:/Windows/win.ini") is False
    assert web_intelligence._validate_public_http_url("https://user:pass@example.com/") is False
    assert web_intelligence._validate_public_http_url("http://example.com:8080/") is False


def test_page_reader_rejects_hostnames_resolving_to_private_addresses(monkeypatch):
    monkeypatch.setattr(
        web_intelligence.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("10.0.0.5", 443))],
    )

    assert web_intelligence._validate_public_http_url("https://example.com/") is False


def test_page_reader_does_not_follow_redirects(monkeypatch):
    response = Mock()
    response.status = 302
    response.headers = {}
    connection = Mock()
    monkeypatch.setattr(web_intelligence, "_resolve_public_addresses", lambda url: (object(), ["8.8.8.8"]))
    monkeypatch.setattr(web_intelligence, "_open_pinned_response", lambda url, resolved: (connection, response))

    result = web_intelligence.scrape_webpage("https://example.com/")

    assert result["success"] is False
    assert "Redirects" in result["error"]
    connection.close.assert_called_once()


def test_page_reader_connects_to_the_validated_ip(monkeypatch):
    monkeypatch.setattr(
        web_intelligence.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [(2, 1, 6, "", ("8.8.8.8", 443))],
    )
    connect = Mock()
    monkeypatch.setattr(web_intelligence.socket, "create_connection", connect)
    tls_context = Mock()
    tls_context.wrap_socket.return_value = Mock()
    monkeypatch.setattr(web_intelligence.ssl, "create_default_context", lambda: tls_context)
    monkeypatch.setattr(web_intelligence.http.client.HTTPSConnection, "request", Mock())
    monkeypatch.setattr(web_intelligence.http.client.HTTPSConnection, "getresponse", Mock(return_value=Mock()))

    connection, _ = web_intelligence._open_pinned_response("https://example.com/article")
    connection.connect()

    assert connect.call_args.args[0] == ("8.8.8.8", 443)
    connection.close()


def test_page_reader_rejects_mixed_public_and_private_dns_answers(monkeypatch):
    monkeypatch.setattr(
        web_intelligence.socket,
        "getaddrinfo",
        lambda *args, **kwargs: [
            (2, 1, 6, "", ("8.8.8.8", 443)),
            (2, 1, 6, "", ("10.0.0.5", 443)),
        ],
    )

    assert web_intelligence._validate_public_http_url("https://example.com/") is False
