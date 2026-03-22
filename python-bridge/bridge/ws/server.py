"""
WsServer — WebSocket server for Unity clients.
- Broadcasts tag updates to all connected clients (batch every 50ms)
- Receives write_tag commands from Unity
- Sends initial_snapshot on connect
"""
from __future__ import annotations
import asyncio
import json
import logging
from typing import Any, Callable

import websockets
from websockets.server import WebSocketServerProtocol

from bridge.ws.protocol import (
    TagUpdateMsg, InitialSnapshotMsg, WriteAckMsg, PlcStatusMsg, parse_message
)

log = logging.getLogger(__name__)

WriteHandler = Callable[[str, Any], None]  # tag_id, value


class WsServer:
    def __init__(self, host: str = "0.0.0.0", port: int = 8765, batch_ms: int = 50):
        self._host = host
        self._port = port
        self._batch_ms = batch_ms / 1000.0
        self._clients: set[WebSocketServerProtocol] = set()
        self._snapshot: dict[str, Any] = {}   # tag_id -> last value
        self._pending: dict[str, Any] = {}    # tag_id -> changed since last batch
        self._write_handler: WriteHandler | None = None
        self._mode = "opcua"
        self._plc_connected = False

    def set_write_handler(self, handler: WriteHandler) -> None:
        self._write_handler = handler

    def set_status(self, connected: bool, mode: str) -> None:
        self._plc_connected = connected
        self._mode = mode

    def on_tag_change(self, tag_id: str, value: Any) -> None:
        """Called by PlcSource when a tag changes."""
        self._snapshot[tag_id] = value
        self._pending[tag_id] = value

    async def start(self) -> None:
        asyncio.create_task(self._batch_loop())
        async with websockets.serve(self._handle_client, self._host, self._port):
            log.info("ws_server_started host=%s port=%d", self._host, self._port)
            await asyncio.Future()  # run forever

    async def _handle_client(self, ws: WebSocketServerProtocol) -> None:
        self._clients.add(ws)
        log.info("ws_client_connected clients=%d", len(self._clients))

        try:
            # Send initial snapshot
            snapshot_msg = InitialSnapshotMsg(
                tags=[{"tag_id": k, "value": v} for k, v in self._snapshot.items()]
            )
            await ws.send(snapshot_msg.to_json())

            # Send PLC status
            status_msg = PlcStatusMsg(connected=self._plc_connected, mode=self._mode)
            await ws.send(status_msg.to_json())

            # Listen for commands from Unity
            async for raw in ws:
                await self._handle_message(ws, raw)

        except websockets.ConnectionClosed:
            log.info("ws_client_disconnected clients=%d", len(self._clients) - 1)
        finally:
            self._clients.discard(ws)

    async def _handle_message(self, ws: WebSocketServerProtocol, raw: str) -> None:
        msg = parse_message(raw)
        if msg is None:
            return

        log.info("ws_write_request tag=%s value=%s req=%s", msg.tag_id, msg.value, msg.request_id)

        if self._write_handler:
            self._write_handler(msg.tag_id, msg.value)
            ack = WriteAckMsg(request_id=msg.request_id, tag_id=msg.tag_id, status="ok")
        else:
            ack = WriteAckMsg(request_id=msg.request_id, tag_id=msg.tag_id,
                              status="error", reason="no write handler")
        await ws.send(ack.to_json())

    async def _batch_loop(self) -> None:
        """Send accumulated changes every batch_ms."""
        while True:
            await asyncio.sleep(self._batch_ms)
            if not self._pending or not self._clients:
                continue

            batch = self._pending.copy()
            self._pending.clear()

            messages = [
                TagUpdateMsg(tag_id=k, value=v).to_json()
                for k, v in batch.items()
            ]

            dead = set()
            for ws in self._clients:
                try:
                    for msg in messages:
                        await ws.send(msg)
                except Exception:
                    dead.add(ws)

            self._clients -= dead
