"""
Shared pytest fixtures for Python Bridge tests.

Test layers:
  unit        — no network, no files, fast
  integration — mock Bridge started per test class
  fat         — real CODESYS + OPC UA (skipped if not running)
"""
import asyncio
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest
import websockets

# ── Paths ──────────────────────────────────────────────────────────────────
BRIDGE_DIR = Path(__file__).parent.parent
TAGS_YAML = BRIDGE_DIR / "tags.yaml"
sys.path.insert(0, str(BRIDGE_DIR))

# ── Config ─────────────────────────────────────────────────────────────────
OPC_URL = os.environ.get("OPC_URL", "opc.tcp://localhost:4840")

# Keep module-level URL for backward compat with any existing imports
WS_TEST_PORT = 0
WS_TEST_URL = ""


def _find_free_port() -> int:
    """Let the OS assign a free port, then release it."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]


# ── Per-class mock Bridge ───────────────────────────────────────────────────
class _BridgeHandle:
    """Wraps the Bridge subprocess and exposes its WS URL."""
    def __init__(self, proc: subprocess.Popen, port: int):
        self.proc = proc
        self.port = port
        self.url = f"ws://localhost:{port}"


@pytest.fixture(scope="class")
def mock_bridge_proc():
    """
    Start mock Bridge once per test class, stop after all class tests complete.
    Class-scoped to prevent connection accumulation that causes Bridge crashes.
    """
    port = _find_free_port()
    proc = subprocess.Popen(
        [sys.executable, str(BRIDGE_DIR / "__main__.py"),
         "--mode", "mock",
         "--ws-port", str(port)],
        cwd=str(BRIDGE_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    # Wait for server to be ready (up to 4 seconds)
    for _ in range(20):
        time.sleep(0.2)
        try:
            s = socket.create_connection(("localhost", port), timeout=0.3)
            s.close()
            break
        except OSError:
            continue

    handle = _BridgeHandle(proc, port)
    yield handle
    proc.terminate()
    proc.wait(timeout=5)


@pytest.fixture
async def ws_client(mock_bridge_proc):
    """Fresh WebSocket connection per test (does not drain initial messages)."""
    async with websockets.connect(mock_bridge_proc.url) as ws:
        yield ws


@pytest.fixture
async def ws_client_clean(mock_bridge_proc):
    """WebSocket connection with initial_snapshot and plc_status already consumed."""
    async with websockets.connect(mock_bridge_proc.url) as ws:
        # Drain snapshot chunks + plc_status
        while True:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg["type"] == "plc_status":
                break
        yield ws


# ── OPC UA skip marker ─────────────────────────────────────────────────────
def pytest_collection_modifyitems(items):
    for item in items:
        if "fat" in item.keywords:
            item.add_marker(
                pytest.mark.skipif(
                    not _opc_ua_available(),
                    reason="CODESYS Control Win V3 not running (OPC UA)",
                )
            )


def _opc_ua_available() -> bool:
    try:
        host, port = OPC_URL.replace("opc.tcp://", "").split(":")
        s = socket.create_connection((host, int(port)), timeout=1)
        s.close()
        return True
    except OSError:
        return False
