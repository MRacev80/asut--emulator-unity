"""
ASUP Python Bridge
CODESYS OPC UA --> Python --> Unity (WebSocket)
"""

import asyncio
import json
import logging
import time
import websockets
from asyncua import Client, ua

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("bridge")

# --- Config ---
OPC_URL  = "opc.tcp://localhost:4840"
WS_PORT  = 8765
OPC_NS   = 4
OPC_BASE = "|var|CODESYS Control Win V3.Application."

# --- Tag registry: friendly_id -> OPC UA node identifier ---
TAGS = {
    # Counter
    "counter.count":    OPC_BASE + "PLC_PRG.fbSchyotchik.nCount",
    "counter.done":     OPC_BASE + "PLC_PRG.fbSchyotchik.bDone",
    "counter.enable":   OPC_BASE + "PLC_PRG.fbSchyotchik.bEnable",
    "counter.preset":   OPC_BASE + "PLC_PRG.fbSchyotchik.nPreset",
    "plc.reset":        OPC_BASE + "PLC_PRG.bSbros",
    "plc.threshold":    OPC_BASE + "PLC_PRG.nPorog",
    # Svetofor
    "svetofor.state":   OPC_BASE + "PLC_PRG.fbSvetofor.sState",
}

# Whitelist — only these tags can be written from Unity
WRITABLE_TAGS = {"plc.reset", "plc.threshold"}

# --- State ---
ws_clients: set = set()
tag_values: dict = {}


# ─── WebSocket ────────────────────────────────────────────────────────────────

async def ws_handler(websocket):
    ws_clients.add(websocket)
    log.info(f"Unity connected: {websocket.remote_address}")

    # Send current snapshot on connect
    if tag_values:
        snapshot = {"type": "initial_snapshot", "tags": {k: str(v) for k, v in tag_values.items()}}
        await websocket.send(json.dumps(snapshot))

    try:
        async for raw in websocket:
            await handle_ws_message(raw)
    except websockets.exceptions.ConnectionClosedOK:
        pass
    except Exception as e:
        log.warning(f"WS error: {e}")
    finally:
        ws_clients.discard(websocket)
        log.info(f"Unity disconnected: {websocket.remote_address}")


async def handle_ws_message(raw: str):
    """Handle incoming message from Unity."""
    try:
        msg = json.loads(raw)
        if msg.get("type") == "write_tag":
            tag_id = msg.get("tag_id")
            value  = msg.get("value")
            req_id = msg.get("request_id", "")
            if tag_id not in WRITABLE_TAGS:
                log.warning(f"Write rejected (not in whitelist): {tag_id}")
                return
            log.info(f"Write command: {tag_id} = {value}")
            await opc_write(tag_id, value)
            # Send ACK to Unity
            ack = {"type": "write_ack", "request_id": req_id, "tag_id": tag_id, "ok": True}
            await broadcast(json.dumps(ack))
    except Exception as e:
        log.error(f"WS message error: {e} | {raw}")


async def broadcast(message: str):
    """Send message to all connected Unity clients."""
    global ws_clients
    if not ws_clients:
        return
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send(message)
        except Exception:
            dead.add(ws)
    ws_clients -= dead


# ─── OPC UA ───────────────────────────────────────────────────────────────────

opc_client: Client = None
opc_nodes: dict = {}


async def opc_connect():
    global opc_client, opc_nodes
    log.info(f"Connecting to OPC UA: {OPC_URL}")
    opc_client = Client(OPC_URL)
    await opc_client.connect()
    log.info("OPC UA connected!")

    # Resolve all tag node IDs — skip tags not in Symbol Configuration
    for tag_id, identifier in TAGS.items():
        node_id = ua.NodeId(Identifier=identifier, NamespaceIndex=OPC_NS,
                            NodeIdType=ua.NodeIdType.String)
        node = opc_client.get_node(node_id)
        try:
            await node.read_value()  # Test if node exists
            opc_nodes[tag_id] = node
            log.info(f"Tag registered: {tag_id}")
        except Exception as e:
            log.warning(f"Tag skipped (not in OPC UA): {tag_id}")

    # Read initial values
    for tag_id, node in opc_nodes.items():
        try:
            val = await node.read_value()
            tag_values[tag_id] = val
        except Exception as e:
            log.warning(f"Initial read error {tag_id}: {e}")


async def opc_poll_loop():
    """Poll OPC UA tags every 200ms and broadcast changes to Unity."""
    while True:
        try:
            for tag_id, node in opc_nodes.items():
                val = await node.read_value()
                old = tag_values.get(tag_id)
                if val != old:
                    tag_values[tag_id] = val
                    msg = {
                        "type":      "tag_update",
                        "tag_id":    tag_id,
                        "value":     str(val),
                        "timestamp": time.time(),
                        "quality":   "good"
                    }
                    await broadcast(json.dumps(msg))
                    log.debug(f"TAG {tag_id} = {val}")
        except Exception as e:
            log.error(f"OPC poll error: {e}")
            await asyncio.sleep(3)
            await opc_reconnect()
        await asyncio.sleep(0.2)


async def opc_write(tag_id: str, value: str):
    """Write value to OPC UA tag."""
    if tag_id not in opc_nodes:
        log.error(f"Tag not found: {tag_id}")
        return
    try:
        node = opc_nodes[tag_id]
        current = await node.read_value()

        # Convert to correct type
        if isinstance(current, bool):
            typed_val = value.lower() in ("true", "1", "yes")
        elif isinstance(current, int):
            typed_val = int(value)
        elif isinstance(current, float):
            typed_val = float(value)
        else:
            typed_val = value

        dv = ua.DataValue(ua.Variant(typed_val, await node.read_data_type_as_variant_type()))
        await node.write_value(dv)
        log.info(f"Written: {tag_id} = {typed_val}")
    except Exception as e:
        log.error(f"Write error {tag_id}: {e}")


async def opc_reconnect():
    global opc_client, opc_nodes
    log.info("Reconnecting to OPC UA...")
    try:
        if opc_client:
            await opc_client.disconnect()
    except Exception:
        pass
    opc_nodes = {}
    await asyncio.sleep(2)
    await opc_connect()


# ─── Main ─────────────────────────────────────────────────────────────────────

async def main():
    log.info("=== ASUP Python Bridge starting ===")

    # Connect to CODESYS OPC UA
    await opc_connect()

    # Start WebSocket server
    ws_server = await websockets.serve(ws_handler, "localhost", WS_PORT)
    log.info(f"WebSocket server: ws://localhost:{WS_PORT}")

    # Run poll loop + WebSocket server together
    await asyncio.gather(
        opc_poll_loop(),
        ws_server.wait_closed()
    )


if __name__ == "__main__":
    asyncio.run(main())
