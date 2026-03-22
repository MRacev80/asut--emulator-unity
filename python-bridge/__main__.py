"""
Python Bridge entry point.

Usage:
  python -m bridge              # OPC UA mode (default)
  python -m bridge --mode mock  # Mock mode (no CODESYS needed)
  python -m bridge --help
"""
from __future__ import annotations
import argparse
import asyncio
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

BASE_DIR = Path(__file__).parent


async def main(mode: str, tags_yaml: Path, opcua_endpoint: str, ws_port: int) -> None:
    from bridge.tag_registry import TagRegistry
    from bridge.ws.server import WsServer

    registry = TagRegistry(tags_yaml)
    ws = WsServer(port=ws_port)

    if mode == "mock":
        from bridge.source.mock_source import MockPlcSource
        source = MockPlcSource(registry)
        ws.set_status(connected=True, mode="mock")
    else:
        from bridge.source.opcua_source import OpcUaSource
        source = OpcUaSource(registry, endpoint=opcua_endpoint)
        ws.set_status(connected=False, mode="opcua")

    # Wire up: PLC change → WebSocket broadcast
    source.set_callback(ws.on_tag_change)

    # Wire up: Unity write command → PLC write
    def write_handler(tag_id: str, value):
        asyncio.create_task(source.write(tag_id, value))

    ws.set_write_handler(write_handler)

    # Run both concurrently
    await asyncio.gather(
        source.connect(),
        ws.start(),
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ASUP Python Bridge")
    parser.add_argument("--mode", choices=["opcua", "mock"], default="opcua",
                        help="Data source mode (default: opcua)")
    parser.add_argument("--tags", default=str(BASE_DIR / "tags.yaml"),
                        help="Path to tags.yaml")
    parser.add_argument("--opcua", default="opc.tcp://localhost:4840",
                        help="OPC UA endpoint (opcua mode only)")
    parser.add_argument("--ws-port", type=int, default=8765,
                        help="WebSocket server port")
    args = parser.parse_args()

    asyncio.run(main(
        mode=args.mode,
        tags_yaml=Path(args.tags),
        opcua_endpoint=args.opcua,
        ws_port=args.ws_port,
    ))
