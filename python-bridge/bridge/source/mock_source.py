"""
MockPlcSource — generates synthetic data without CODESYS.
Unity doesn't know the difference — same callback interface as OpcUaSource.
Modes: sine (for analog), counter (for INT), toggle (for BOOL).
"""
from __future__ import annotations
import asyncio
import logging
import math
import time
from typing import Any, Callable

from bridge.tag_registry import TagRegistry

log = logging.getLogger(__name__)

ChangeCallback = Callable[[str, Any], None]


class MockPlcSource:
    def __init__(self, registry: TagRegistry, interval_ms: int = 500):
        self._registry = registry
        self._interval = interval_ms / 1000.0
        self._callback: ChangeCallback | None = None
        self._running = False
        self._counter = 0
        # Pre-populate state so read() works before connect()
        self._state: dict[str, Any] = {
            tag.tag_id: self._initial_value(tag.data_type)
            for tag in registry.all()
        }

    def set_callback(self, cb: ChangeCallback) -> None:
        self._callback = cb

    async def connect(self) -> None:
        self._running = True
        log.info("mock_source_started tags=%d interval_ms=%d",
                 len(self._registry.all()), int(self._interval * 1000))

        # Initial values
        for tag in self._registry.all():
            self._state[tag.tag_id] = self._initial_value(tag.data_type)

        while self._running:
            self._counter += 1
            t = time.time()

            for tag in self._registry.all():
                value = self._generate(tag.tag_id, tag.data_type, t)
                self._state[tag.tag_id] = value
                if self._callback:
                    self._callback(tag.tag_id, value)

            await asyncio.sleep(self._interval)

    def _generate(self, tag_id: str, data_type: str, t: float) -> Any:
        dt = data_type.upper()
        if dt == "BOOL":
            return (self._counter // 4) % 2 == 0
        elif dt in ("INT", "DINT"):
            return self._counter % 10
        elif dt in ("REAL", "LREAL"):
            return round(50.0 + 50.0 * math.sin(2 * math.pi * t / 10), 2)
        return 0

    def _initial_value(self, data_type: str) -> Any:
        dt = data_type.upper()
        if dt == "BOOL":
            return False
        elif dt in ("INT", "DINT"):
            return 0
        elif dt in ("REAL", "LREAL"):
            return 0.0
        return None

    async def write(self, tag_id: str, value: Any) -> bool:
        tag = self._registry.get(tag_id)
        if not tag or not tag.writable:
            return False
        self._state[tag_id] = value
        log.info("mock_write tag=%s value=%s", tag_id, value)
        if self._callback:
            self._callback(tag_id, value)
        return True

    async def read(self, tag_id: str) -> Any:
        return self._state.get(tag_id)

    async def disconnect(self) -> None:
        self._running = False
