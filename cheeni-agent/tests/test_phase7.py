import pytest
from tools.web_intelligence import (
    search_web,
    get_latest_news,
    scrape_webpage,
    DDGS_AVAILABLE,
    BS4_AVAILABLE
)

@pytest.mark.skipif(not DDGS_AVAILABLE, reason="duckduckgo-search is not installed")
def test_search_web():
    res = search_web("python programming", max_results=2)
    assert res["success"] is True
    assert "python" in res["query"].lower()
    assert res["count"] > 0
    assert len(res["results"]) <= 2

@pytest.mark.skipif(not DDGS_AVAILABLE, reason="duckduckgo-search is not installed")
def test_get_latest_news():
    res = get_latest_news("technology", max_results=2)
    assert res["success"] is True
    assert "technology" in res["topic"].lower()
    assert res["count"] > 0
    assert len(res["results"]) <= 2

@pytest.mark.skipif(not BS4_AVAILABLE, reason="beautifulsoup4 is not installed")
def test_scrape_webpage():
    # Use a reliable, fast page to test
    url = "https://example.com"
    res = scrape_webpage(url)
    assert res["success"] is True
    assert "Example Domain" in res["title"]
    assert "use in documentation examples" in res["content"]
