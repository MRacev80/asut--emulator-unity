"""
Integration tests — WebSocket protocol against live mock Bridge.
Requires: mock Bridge running on WS_TEST_PORT (started by conftest.session fixture).
"""
import asyncio
import json
import uuid
import pytest
import websockets


pytestmark = pytest.mark.integration


async def recv_type(ws, msg_type: str, timeout: float = 5.0):
    """Receive messages until one with the given type arrives (skips batch_updates)."""
    deadline = asyncio.get_event_loop().time() + timeout
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            raise TimeoutError(f"No '{msg_type}' message within {timeout}s")
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=remaining))
        if msg["type"] == msg_type:
            return msg


class TestInitialConnection:

    async def test_receives_initial_snapshot(self, ws_client):
        msg = json.loads(await asyncio.wait_for(ws_client.recv(), timeout=3))
        assert msg["type"] == "initial_snapshot"
        assert isinstance(msg["tags"], list)

    async def test_snapshot_has_all_tags(self, ws_client):
        """Все 5 тегов из tags.yaml должны прийти в snapshot (возможно чанками)."""
        received_tags = set()
        while True:
            msg = json.loads(await asyncio.wait_for(ws_client.recv(), timeout=3))
            if msg["type"] == "initial_snapshot":
                for t in msg["tags"]:
                    received_tags.add(t["tag_id"])
            elif msg["type"] == "plc_status":
                break
        assert "counter.count" in received_tags
        assert "counter.preset" in received_tags
        assert "counter.done" in received_tags

    async def test_receives_plc_status_after_snapshot(self, ws_client):
        # Drain snapshot
        while True:
            msg = json.loads(await asyncio.wait_for(ws_client.recv(), timeout=3))
            if msg["type"] == "plc_status":
                break
        assert msg["connected"] is True
        assert msg["mode"] == "mock"


class TestBatchUpdates:

    async def test_receives_batch_update(self, ws_client_clean):
        msg = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
        assert msg["type"] == "batch_update"

    async def test_batch_has_updates_list(self, ws_client_clean):
        msg = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
        assert isinstance(msg["updates"], list)
        assert len(msg["updates"]) > 0

    async def test_update_item_has_tag_id_and_value(self, ws_client_clean):
        msg = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
        item = msg["updates"][0]
        assert "tag_id" in item
        assert "value" in item

    async def test_update_value_is_string(self, ws_client_clean):
        """Bridge конвертирует все value в str для совместимости с Unity."""
        msg = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
        for item in msg["updates"]:
            assert isinstance(item["value"], str), \
                f"tag {item['tag_id']} value is {type(item['value'])}, expected str"

    async def test_stream_continues_after_first_batch(self, ws_client_clean):
        """Убедиться что поток не обрывается после первого батча."""
        await asyncio.wait_for(ws_client_clean.recv(), timeout=3)
        msg2 = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
        assert msg2["type"] == "batch_update"


class TestWriteTag:

    async def test_write_ack_received(self, ws_client_clean):
        req_id = str(uuid.uuid4())
        await ws_client_clean.send(json.dumps({
            "type": "write_tag",
            "request_id": req_id,
            "tag_id": "counter.reset",
            "value": "True",
        }))
        ack = await recv_type(ws_client_clean, "write_ack", timeout=5)
        assert ack["request_id"] == req_id
        assert ack["status"] == "ok"

    async def test_write_readonly_tag_denied(self, ws_client_clean):
        req_id = str(uuid.uuid4())
        await ws_client_clean.send(json.dumps({
            "type": "write_tag",
            "request_id": req_id,
            "tag_id": "counter.count",   # read-only
            "value": "99",
        }))
        ack = await recv_type(ws_client_clean, "write_ack", timeout=5)
        assert ack["status"] in ("denied", "error")

    async def test_stream_not_broken_after_write(self, ws_client_clean):
        """После write_tag батчи продолжают приходить."""
        await ws_client_clean.send(json.dumps({
            "type": "write_tag",
            "request_id": str(uuid.uuid4()),
            "tag_id": "counter.preset",
            "value": "10",
        }))
        # Consume ack + next batch
        messages = []
        for _ in range(3):
            msg = json.loads(await asyncio.wait_for(ws_client_clean.recv(), timeout=3))
            messages.append(msg["type"])
        assert "batch_update" in messages


class TestSnapshotChunking:

    async def test_snapshot_chunks_sum_to_total(self, ws_client):
        """При любом числе тегов все чанки в сумме дают полный набор."""
        total_tags = 0
        while True:
            msg = json.loads(await asyncio.wait_for(ws_client.recv(), timeout=3))
            if msg["type"] == "initial_snapshot":
                total_tags += len(msg["tags"])
            elif msg["type"] == "plc_status":
                break
        # tags.yaml содержит 5 тегов
        assert total_tags == 5
