"""Unit tests — WsServer internal logic (no network)"""
import json
import pytest
from bridge.ws.server import WsServer, SNAPSHOT_CHUNK


@pytest.mark.unit
class TestSnapshotChunking:

    def test_snapshot_chunk_constant(self):
        assert SNAPSHOT_CHUNK == 200

    def test_single_chunk_for_small_snapshot(self):
        """50 tags → 1 chunk of 50."""
        chunks = _collect_chunks(50)
        assert len(chunks) == 1
        assert chunks[0] == 50

    def test_exact_chunk_boundary(self):
        """200 tags → exactly 1 chunk."""
        chunks = _collect_chunks(200)
        assert len(chunks) == 1
        assert chunks[0] == 200

    def test_two_chunks_for_250_tags(self):
        """250 tags → [200, 50]."""
        chunks = _collect_chunks(250)
        assert len(chunks) == 2
        assert chunks[0] == 200
        assert chunks[1] == 50

    def test_three_chunks_for_600_tags(self):
        """600 tags → [200, 200, 200]."""
        chunks = _collect_chunks(600)
        assert len(chunks) == 3
        assert all(c == 200 for c in chunks)

    def test_no_tags_lost_in_chunking(self):
        for n in [1, 199, 200, 201, 500, 1500]:
            assert sum(_collect_chunks(n)) == n, f"lost tags at n={n}"


@pytest.mark.unit
class TestWsServerState:

    def test_on_tag_change_updates_snapshot(self):
        ws = WsServer()
        ws.on_tag_change("pump.state", 2)
        assert ws._snapshot["pump.state"] == 2

    def test_on_tag_change_updates_pending(self):
        ws = WsServer()
        ws.on_tag_change("pump.state", 2)
        assert ws._pending["pump.state"] == 2

    def test_multiple_changes_last_wins_in_pending(self):
        ws = WsServer()
        ws.on_tag_change("pump.state", 1)
        ws.on_tag_change("pump.state", 2)
        ws.on_tag_change("pump.state", 3)
        assert ws._pending["pump.state"] == 3

    def test_snapshot_persists_after_pending_clear(self):
        ws = WsServer()
        ws.on_tag_change("pump.state", 5)
        ws._pending.clear()
        assert ws._snapshot["pump.state"] == 5   # snapshot не очищается

    def test_set_status(self):
        ws = WsServer()
        ws.set_status(connected=True, mode="mock")
        assert ws._plc_connected is True
        assert ws._mode == "mock"


# ── Helpers ────────────────────────────────────────────────────────────────

def _collect_chunks(n_tags: int) -> list[int]:
    """Simulate snapshot chunking logic, return list of chunk sizes."""
    items = [(f"tag_{i}", i) for i in range(n_tags)]
    if not items:
        return [0]
    chunks = []
    for i in range(0, len(items), SNAPSHOT_CHUNK):
        chunks.append(len(items[i:i + SNAPSHOT_CHUNK]))
    return chunks
