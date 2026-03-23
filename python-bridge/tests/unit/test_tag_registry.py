"""Unit tests — TagRegistry"""
import pytest
from pathlib import Path
from bridge.tag_registry import TagRegistry

TAGS_YAML = Path(__file__).parent.parent.parent / "tags.yaml"


@pytest.mark.unit
class TestTagRegistry:

    def setup_method(self):
        self.reg = TagRegistry(TAGS_YAML)

    def test_loads_all_tags(self):
        tags = self.reg.all()
        assert len(tags) == 5

    def test_get_known_tag(self):
        tag = self.reg.get("counter.count")
        assert tag is not None
        assert tag.tag_id == "counter.count"
        assert tag.data_type == "INT"
        assert tag.writable is False

    def test_get_unknown_tag_returns_none(self):
        assert self.reg.get("nonexistent.tag") is None

    def test_writable_ids_contains_only_writable(self):
        writable = self.reg.writable_ids()
        assert "counter.preset" in writable
        assert "counter.reset" in writable
        assert "counter.threshold" in writable
        assert "counter.count" not in writable   # read-only
        assert "counter.done" not in writable    # read-only

    def test_writable_count(self):
        assert len(self.reg.writable_ids()) == 3

    def test_node_id_format(self):
        tag = self.reg.get("counter.count")
        assert tag.node_id.startswith("ns=")
        assert ";s=" in tag.node_id

    def test_all_tags_have_required_fields(self):
        for tag in self.reg.all():
            assert tag.tag_id
            assert tag.node_id
            assert tag.data_type in ("BOOL", "INT", "DINT", "REAL", "LREAL", "STRING")
