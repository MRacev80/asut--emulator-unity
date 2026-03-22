"""
WebSocket protocol contracts (Unity <-> Python Bridge).
All messages are JSON. tag_id is the key defined in tags.yaml.
"""
from __future__ import annotations
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Literal
import json


@dataclass
class TagUpdateMsg:
    tag_id: str
    value: Any
    type: Literal["tag_update"] = "tag_update"
    timestamp: float = field(default_factory=time.time)
    quality: Literal["good", "bad"] = "good"
    unit: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self))


@dataclass
class InitialSnapshotMsg:
    tags: list[dict]
    type: Literal["initial_snapshot"] = "initial_snapshot"

    def to_json(self) -> str:
        return json.dumps(asdict(self))


@dataclass
class WriteTagMsg:
    request_id: str
    tag_id: str
    value: Any
    type: Literal["write_tag"] = "write_tag"


@dataclass
class WriteAckMsg:
    request_id: str
    tag_id: str
    status: Literal["ok", "denied", "error"]
    type: Literal["write_ack"] = "write_ack"
    reason: str = ""

    def to_json(self) -> str:
        return json.dumps(asdict(self))


@dataclass
class PlcStatusMsg:
    connected: bool
    mode: Literal["opcua", "mock"]
    type: Literal["plc_status"] = "plc_status"

    def to_json(self) -> str:
        return json.dumps(asdict(self))


def parse_message(raw: str) -> WriteTagMsg | None:
    try:
        data = json.loads(raw)
        if data.get("type") == "write_tag":
            return WriteTagMsg(
                request_id=data["request_id"],
                tag_id=data["tag_id"],
                value=data["value"],
            )
    except Exception:
        pass
    return None
