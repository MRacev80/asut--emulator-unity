"""Unit tests — WebSocket protocol messages"""
import json
import pytest
from bridge.ws.protocol import (
    TagUpdateMsg, BatchUpdateMsg, InitialSnapshotMsg,
    WriteAckMsg, PlcStatusMsg, parse_message
)


@pytest.mark.unit
class TestTagUpdateMsg:

    def test_serializes_to_json(self):
        msg = TagUpdateMsg(tag_id="pump.state", value=2)
        data = json.loads(msg.to_json())
        assert data["type"] == "tag_update"
        assert data["tag_id"] == "pump.state"
        assert data["value"] == 2

    def test_has_timestamp(self):
        msg = TagUpdateMsg(tag_id="x", value=1)
        data = json.loads(msg.to_json())
        assert data["timestamp"] > 0

    def test_default_quality_good(self):
        msg = TagUpdateMsg(tag_id="x", value=1)
        data = json.loads(msg.to_json())
        assert data["quality"] == "good"


@pytest.mark.unit
class TestBatchUpdateMsg:

    def test_serializes_updates_list(self):
        msg = BatchUpdateMsg(updates=[
            {"tag_id": "pump.state", "value": "2"},
            {"tag_id": "valve.state", "value": "1"},
        ])
        data = json.loads(msg.to_json())
        assert data["type"] == "batch_update"
        assert len(data["updates"]) == 2
        assert data["updates"][0]["tag_id"] == "pump.state"

    def test_empty_updates(self):
        msg = BatchUpdateMsg(updates=[])
        data = json.loads(msg.to_json())
        assert data["updates"] == []

    def test_value_is_preserved_as_string(self):
        msg = BatchUpdateMsg(updates=[{"tag_id": "t", "value": "True"}])
        data = json.loads(msg.to_json())
        assert data["updates"][0]["value"] == "True"


@pytest.mark.unit
class TestInitialSnapshotMsg:

    def test_serializes_tags(self):
        msg = InitialSnapshotMsg(tags=[
            {"tag_id": "a", "value": 1},
            {"tag_id": "b", "value": False},
        ])
        data = json.loads(msg.to_json())
        assert data["type"] == "initial_snapshot"
        assert len(data["tags"]) == 2

    def test_empty_snapshot(self):
        msg = InitialSnapshotMsg(tags=[])
        data = json.loads(msg.to_json())
        assert data["tags"] == []


@pytest.mark.unit
class TestWriteAckMsg:

    def test_ok_status(self):
        msg = WriteAckMsg(request_id="123", tag_id="pump.cmd", status="ok")
        data = json.loads(msg.to_json())
        assert data["type"] == "write_ack"
        assert data["status"] == "ok"
        assert data["request_id"] == "123"

    def test_error_with_reason(self):
        msg = WriteAckMsg(request_id="456", tag_id="x", status="denied", reason="read-only")
        data = json.loads(msg.to_json())
        assert data["status"] == "denied"
        assert data["reason"] == "read-only"


@pytest.mark.unit
class TestParseMessage:

    def test_parses_write_tag(self):
        raw = json.dumps({
            "type": "write_tag",
            "request_id": "abc",
            "tag_id": "pump.cmd_start",
            "value": "True",
        })
        msg = parse_message(raw)
        assert msg is not None
        assert msg.tag_id == "pump.cmd_start"
        assert msg.request_id == "abc"

    def test_returns_none_for_wrong_type(self):
        raw = json.dumps({"type": "tag_update", "tag_id": "x", "value": 1})
        assert parse_message(raw) is None

    def test_returns_none_for_invalid_json(self):
        assert parse_message("not json") is None

    def test_returns_none_for_empty(self):
        assert parse_message("{}") is None
