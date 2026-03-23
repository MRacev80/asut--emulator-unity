"""
FAT тесты для FB_Counter (TestPLC).
Предусловие: CODESYS Control Win V3 запущен, приложение Running.
Запуск: cd python-bridge && pytest tests/fat/ -v -m fat

Теги (ns=4, TestPLC):
  counter.count    — текущее значение (read-only)
  counter.preset   — порог (writable)
  counter.done     — достигнут порог (read-only)
  counter.reset    — сброс (writable, one-shot)
  counter.threshold — порог PLC_PRG (writable)
"""
import asyncio
import pytest
from asyncua import Client

OPC_URL = "opc.tcp://localhost:4840"
NS = 4


# ── Helpers ────────────────────────────────────────────────────────────────

async def read_tag(client: Client, path: str):
    node = client.get_node(f"ns={NS};s={path}")
    return await node.read_value()


async def write_tag(client: Client, path: str, value):
    from asyncua.ua import DataValue, Variant, VariantType
    node = client.get_node(f"ns={NS};s={path}")
    await node.write_value(DataValue(Variant(value, VariantType.Boolean
        if isinstance(value, bool) else VariantType.Int16)))


async def wait_value(client, path, expected, timeout=10):
    for _ in range(timeout * 10):
        if await read_tag(client, path) == expected:
            return True
        await asyncio.sleep(0.1)
    return False


# ── FAT Tests ──────────────────────────────────────────────────────────────

@pytest.mark.fat
async def test_FAT_C01_counter_increments():
    """FAT-C01: счётчик растёт при работающем ПЛК."""
    async with Client(OPC_URL) as c:
        v1 = await read_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.fbSchyotchik.nCount")
        await asyncio.sleep(0.5)
        v2 = await read_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.fbSchyotchik.nCount")
        assert v2 > v1, f"Counter did not increment: {v1} → {v2}"


@pytest.mark.fat
async def test_FAT_C02_reset_clears_counter():
    """FAT-C02: запись bSbros=True → счётчик = 0."""
    async with Client(OPC_URL) as c:
        # Ждём ненулевого значения
        for _ in range(30):
            val = await read_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.fbSchyotchik.nCount")
            if val > 0:
                break
            await asyncio.sleep(0.2)

        # Сброс
        await write_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.bSbros", True)
        await asyncio.sleep(0.1)

        count = await read_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.fbSchyotchik.nCount")
        assert count == 0, f"Counter not reset, got {count}"


@pytest.mark.fat
async def test_FAT_C03_done_flag_at_threshold():
    """FAT-C03: bDone устанавливается когда nCount >= nPreset."""
    async with Client(OPC_URL) as c:
        # Установить низкий порог
        await write_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.nPorog", 3)
        await asyncio.sleep(0.1)

        # Сброс
        await write_tag(c, "|var|CODESYS Control Win V3.Application.PLC_PRG.bSbros", True)
        await asyncio.sleep(0.1)

        # Ждём bDone = True
        done = await asyncio.wait_for(
            asyncio.get_event_loop().run_in_executor(None,
                lambda: asyncio.run(wait_value(c,
                    "|var|CODESYS Control Win V3.Application.PLC_PRG.fbSchyotchik.bDone",
                    True))),
            timeout=10
        )
        assert done, "bDone never became True within timeout"
