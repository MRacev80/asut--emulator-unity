"""
Проверка окружения АСУТП Эмулятора.
Запуск из корня проекта: python verify.py
"""

import asyncio
import importlib
import json
import os
import subprocess
import sys
from pathlib import Path

# ── Конфиг ──────────────────────────────────────────────────────────────────

CODESYS_EXE = Path(r"C:\Program Files (x86)\CODESYS 3.5.17.30\CODESYS\Common\CODESYS.exe")
MCP_SERVER_JS = Path(os.environ.get("APPDATA", "")) / "npm/node_modules/@codesys/mcp-toolkit/dist/server.js"
CLAUDE_JSON = Path.home() / ".claude.json"
OPC_URL = "opc.tcp://localhost:4840"
CONTROLWIN_PROCESS = "CODESYSControlWinV3.exe"

# ── Helpers ──────────────────────────────────────────────────────────────────

PASS = "[PASS]"
WARN = "[WARN]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"

results = []

def check(label: str, status: str, detail: str = ""):
    results.append((status, label, detail))

def run_cmd(args, timeout=10):
    try:
        r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return r.returncode == 0, (r.stdout + r.stderr).strip()
    except FileNotFoundError:
        return False, "команда не найдена"
    except subprocess.TimeoutExpired:
        return False, "таймаут"

def check_module(name):
    try:
        m = importlib.import_module(name)
        ver = getattr(m, "__version__", "?")
        return True, ver
    except ImportError:
        return False, "не установлен"

def is_process_running(name: str) -> bool:
    try:
        import psutil
        return any(p.name().lower() == name.lower() for p in psutil.process_iter(["name"]))
    except Exception:
        # psutil недоступен — пробуем tasklist
        ok, out = run_cmd(["tasklist", "/FI", f"IMAGENAME eq {name}", "/NH"])
        return name.lower() in out.lower()

# ── Проверки ─────────────────────────────────────────────────────────────────

def check_nodejs():
    ok, out = run_cmd(["node", "--version"])
    if ok:
        check("Node.js", PASS, out.split("\n")[0])
    else:
        check("Node.js", FAIL, "не найден — https://nodejs.org")

def check_mcp_tool():
    ok, out = run_cmd(["codesys-mcp-tool", "--help"])
    if ok:
        check("codesys-mcp-tool", PASS, "найден в PATH")
    else:
        check("codesys-mcp-tool", FAIL, "npm install -g @codesys/mcp-toolkit")

def check_codesys_exe():
    if CODESYS_EXE.exists():
        check("CODESYS.exe", PASS, str(CODESYS_EXE))
    else:
        check("CODESYS.exe", FAIL, f"не найден: {CODESYS_EXE}")

def check_control_win():
    if is_process_running(CONTROLWIN_PROCESS):
        check("Control Win V3", PASS, "процесс запущен")
        return True
    else:
        check("Control Win V3", WARN, "не запущен — запустите из трея (нужен для OPC UA)")
        return False

def check_python_packages():
    packages = [
        ("asyncua", "asyncua"),
        ("websockets", "websockets"),
        ("pyyaml", "yaml"),
        ("psutil", "psutil"),
    ]
    for display_name, import_name in packages:
        ok, ver = check_module(import_name)
        if ok:
            check(f"Python {display_name}", PASS, ver)
        else:
            check(f"Python {display_name}", FAIL, f"pip install {display_name}")

def check_claude_json():
    if not CLAUDE_JSON.exists():
        check(".claude.json", FAIL, f"не найден: {CLAUDE_JSON} — запустите setup.bat")
        return
    try:
        data = json.loads(CLAUDE_JSON.read_text(encoding="utf-8"))
        if "mcpServers" in data and "codesys_local" in data["mcpServers"]:
            check(".claude.json", PASS, "codesys_local сконфигурирован")
        else:
            check(".claude.json", WARN, "нет секции mcpServers.codesys_local — см. ONBOARDING.md шаг 3")
    except Exception as e:
        check(".claude.json", FAIL, f"ошибка парсинга JSON: {e}")

def check_mcp_patch():
    if not MCP_SERVER_JS.exists():
        check("MCP patch", FAIL, "server.js не найден — @codesys/mcp-toolkit не установлен?")
        return
    content = MCP_SERVER_JS.read_text(encoding="utf-8", errors="ignore")
    if "read_pou_code" in content and "get_application_state" in content:
        check("MCP patch", PASS, "кастомные инструменты обнаружены")
    else:
        check("MCP patch", WARN, "патч не применён — запустите restore-mcp.bat")

async def check_opc_ua(control_win_running: bool):
    if not control_win_running:
        check("OPC UA connect", SKIP, "Control Win V3 не запущен")
        return
    try:
        from asyncua import Client
        async with Client(OPC_URL) as c:
            await asyncio.wait_for(c.connect(), timeout=3)
            check("OPC UA connect", PASS, OPC_URL)
    except asyncio.TimeoutError:
        check("OPC UA connect", FAIL, f"таймаут подключения к {OPC_URL}")
    except Exception as e:
        msg = str(e)[:60]
        check("OPC UA connect", FAIL, msg)

# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print()
    print("Проверка окружения АСУТП Эмулятора")
    print("=" * 52)

    check_nodejs()
    check_mcp_tool()
    check_codesys_exe()
    control_running = check_control_win()
    check_python_packages()
    check_claude_json()
    check_mcp_patch()
    await check_opc_ua(control_running)

    print()
    # Вывод таблицы
    label_w = max(len(r[1]) for r in results) + 2
    for status, label, detail in results:
        print(f"  {status} {label:<{label_w}} {detail}")

    counts = {PASS: 0, WARN: 0, FAIL: 0, SKIP: 0}
    for status, _, _ in results:
        counts[status] = counts.get(status, 0) + 1

    print()
    print("=" * 52)
    print(f"  Результат: {counts[PASS]} PASS, {counts[WARN]} WARN, "
          f"{counts[FAIL]} FAIL, {counts[SKIP]} SKIP")
    print("=" * 52)
    print()

    if counts[FAIL] > 0:
        print("  Исправьте ошибки выше и запустите verify.py снова.")
        print()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
