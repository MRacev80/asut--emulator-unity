"""
OpcUaSource — connects to CODESYS OPC UA Server via asyncua subscription.
Push model: CODESYS notifies on change, no polling.
Reconnects automatically on disconnect.
"""
from __future__ import annotations
import asyncio
import logging
from typing import Callable, Any

from asyncua import Client, Node
from asyncua.ua import DataChangeNotification

from bridge.tag_registry import TagRegistry, TagDef

log = logging.getLogger(__name__)

# Type alias for change callback
ChangeCallback = Callable[[str, Any], None]  # tag_id, value


class _SubscriptionHandler:
    def __init__(self, node_to_tag: dict[str, str], callback: ChangeCallback):
        self._node_to_tag = node_to_tag
        self._callback = callback

    def datachange_notification(self, node: Node, val: Any, data: DataChangeNotification):
        node_id_str = node.nodeid.to_string()
        tag_id = self._node_to_tag.get(node_id_str)
        if tag_id:
            log.debug("tag_changed tag=%s value=%s", tag_id, val)
            self._callback(tag_id, val)


class OpcUaSource:
    def __init__(
        self,
        registry: TagRegistry,
        endpoint: str = "opc.tcp://localhost:4840",
        period_ms: int = 100,
    ):
        self._registry = registry
        self._endpoint = endpoint
        self._period_ms = period_ms
        self._callback: ChangeCallback | None = None
        self._client: Client | None = None
        self._sub = None
        self._running = False

    def set_callback(self, cb: ChangeCallback) -> None:
        self._callback = cb

    async def connect(self) -> None:
        self._running = True
        while self._running:
            try:
                await self._connect_once()
            except Exception as e:
                log.error("opcua_disconnect endpoint=%s error=%s — retry in 5s", self._endpoint, e)
                await asyncio.sleep(5)

    async def _connect_once(self) -> None:
        log.info("opcua_connecting endpoint=%s", self._endpoint)
        async with Client(self._endpoint) as client:
            self._client = client
            log.info("opcua_connected endpoint=%s", self._endpoint)

            tags = self._registry.all()
            node_to_tag: dict[str, str] = {}
            nodes: list[Node] = []

            for tag in tags:
                node = client.get_node(tag.node_id)
                node_to_tag[node.nodeid.to_string()] = tag.tag_id
                nodes.append(node)

            handler = _SubscriptionHandler(node_to_tag, self._on_change)
            sub = await client.create_subscription(self._period_ms, handler)
            await sub.subscribe_data_change(nodes)
            log.info("opcua_subscribed tags=%d period_ms=%d", len(nodes), self._period_ms)

            # Keep alive until disconnect
            while self._running:
                await asyncio.sleep(1)

    def _on_change(self, tag_id: str, value: Any) -> None:
        if self._callback:
            self._callback(tag_id, value)

    async def write(self, tag_id: str, value: Any) -> bool:
        tag = self._registry.get(tag_id)
        if not tag:
            log.warning("write_unknown_tag tag=%s", tag_id)
            return False
        if not tag.writable:
            log.warning("write_denied_readonly tag=%s", tag_id)
            return False
        if self._client is None:
            log.error("write_failed_no_connection tag=%s", tag_id)
            return False
        try:
            from asyncua.ua import DataValue, Variant, VariantType
            node = self._client.get_node(tag.node_id)
            vtype = _ua_type(tag.data_type)
            await node.write_value(DataValue(Variant(value, vtype)))
            log.info("write_ok tag=%s value=%s", tag_id, value)
            return True
        except Exception as e:
            log.error("write_error tag=%s error=%s", tag_id, e)
            return False

    async def read(self, tag_id: str) -> Any:
        tag = self._registry.get(tag_id)
        if not tag or self._client is None:
            return None
        try:
            node = self._client.get_node(tag.node_id)
            return await node.read_value()
        except Exception as e:
            log.error("read_error tag=%s error=%s", tag_id, e)
            return None

    async def disconnect(self) -> None:
        self._running = False


def _ua_type(data_type: str):
    from asyncua.ua import VariantType
    mapping = {
        "BOOL": VariantType.Boolean,
        "INT": VariantType.Int16,
        "DINT": VariantType.Int32,
        "REAL": VariantType.Float,
        "LREAL": VariantType.Double,
        "STRING": VariantType.String,
    }
    return mapping.get(data_type.upper(), VariantType.Variant)
