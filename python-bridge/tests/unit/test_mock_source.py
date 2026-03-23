"""Unit tests — MockPlcSource value generation"""
import asyncio
import pytest
from pathlib import Path
from bridge.tag_registry import TagRegistry
from bridge.source.mock_source import MockPlcSource

TAGS_YAML = Path(__file__).parent.parent.parent / "tags.yaml"


@pytest.mark.unit
class TestMockPlcSource:

    def setup_method(self):
        self.reg = TagRegistry(TAGS_YAML)
        self.source = MockPlcSource(self.reg)

    def test_callback_set(self):
        called = []
        self.source.set_callback(lambda tag, val: called.append((tag, val)))
        assert self.source._callback is not None

    def test_write_known_writable_tag(self):
        """write() на writable тег возвращает True."""
        result = asyncio.run(self.source.write("counter.reset", True))
        assert result is True

    def test_write_readonly_tag_denied(self):
        """write() на read-only тег → False."""
        result = asyncio.run(self.source.write("counter.count", 99))
        assert result is False

    def test_write_unknown_tag_denied(self):
        """write() на несуществующий тег → False."""
        result = asyncio.run(self.source.write("nonexistent.tag", 1))
        assert result is False

    def test_read_returns_initial_value_before_connect(self):
        """read() возвращает initial value даже до connect() (state pre-populated)."""
        val = asyncio.run(self.source.read("counter.count"))
        assert val is not None
        assert val == 0   # INT initial = 0

    def test_read_bool_initial_value(self):
        val = asyncio.run(self.source.read("counter.done"))
        assert val is False   # BOOL initial = False

    def test_disconnect_stops_running(self):
        asyncio.run(self.source.disconnect())
        assert self.source._running is False
