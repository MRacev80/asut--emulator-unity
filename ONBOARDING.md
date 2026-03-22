# Онбординг — Эмулятор АСУТП

> Для нового участника проекта. От нуля до рабочего окружения.

---

## Что это за проект

Система для разработки и тестирования кода ПЛК (Structured Text) **без выезда на объект**:

```
Claude Code (пишет ST)
    ↓ MCP
CODESYS Control Win V3 (SoftPLC + OPC UA сервер)
    ↓ OPC UA
Python Bridge (asyncua + WebSocket)
    ├─→ Unity HMI (2D визуализация, кнопки управления)
    └─→ pytest FAT (автоматические тесты)
        MasterSCADA 4 (прямо к OPC UA, для заказчика)
```

---

## Шаг 1 — CODESYS

**Версия строго: 3.5.17 SP17 Patch 3**

1. Скачать установщик у руководителя проекта (или с CODESYS Store)
2. Установить **CODESYS** (IDE)
3. Установить **CODESYS Control Win V3** (SoftPLC / эмулятор)

Проверка:
```
Пуск → CODESYS → запускается IDE
Пуск → CODESYS Control Win V3 → запускается в трее
```

---

## Шаг 2 — Node.js и MCP-сервер

1. Установить **Node.js** LTS: https://nodejs.org

2. Установить MCP-тулкит:
```bash
npm install -g @codesys/mcp-toolkit
```

3. Применить кастомный патч (новые инструменты):
```
Двойной клик: restore-mcp.bat
```
> Этот патч нужно повторять после каждого `npm update -g @codesys/mcp-toolkit`

Проверка:
```bash
codesys-mcp-tool --help
# Первые строки: "SERVER.TS Module Parsed" — всё ОК
```

---

## Шаг 3 — Claude Code + MCP конфигурация

1. Установить **Claude Code CLI**: https://claude.ai/code

2. Создать файл `C:\Users\[ВашеИмя]\.claude.json` с содержимым:
```json
{
  "mcpServers": {
    "codesys_local": {
      "type": "stdio",
      "command": "codesys-mcp-tool",
      "args": [
        "--codesys-path",
        "C:\\Program Files (x86)\\CODESYS 3.5.17.30\\CODESYS\\Common\\CODESYS.exe",
        "--codesys-profile",
        "CODESYS V3.5 SP17 Patch 3"
      ]
    }
  }
}
```
> Путь к CODESYS.exe уточнить если установлен в другую папку

3. Открыть Claude Code в папке проекта:
```bash
cd "C:\Users\[ВашеИмя]\Documents\проекты\Эмулятор АСУТП Unity"
claude
```

Проверка — в чате Claude спросить:
```
список инструментов MCP
```
Должны появиться: `open_project`, `compile_project`, `read_pou_code` и др.

---

## Шаг 4 — Python окружение

```bash
cd python-bridge
pip install -r requirements.txt
```

Устанавливает: `asyncua`, `websockets`, `pyyaml`

---

## Шаг 5 — Unity (только для HMI-разработки)

> Пропусти если занимаешься только ST-кодом или Python Bridge.

1. Установить **Unity Hub**: https://unity.com/download
2. Через Unity Hub установить **Unity 2022 LTS**
3. Открыть проект из папки `unity/`
4. В Package Manager добавить **NativeWebSocket** (через Git URL)

---

## Шаг 6 — Проверочный запуск

### 6.1 Запустить Control Win V3
```
Пуск → CODESYS Control Win V3 → значок в трее (зелёный)
```

### 6.2 Загрузить тестовый проект через Claude
Открыть Claude Code в папке проекта и написать:
```
Открой TestPLC, скомпилируй и загрузи в эмулятор
```
Claude сделает: `open_project` → `compile_project` → `download_to_plc`

### 6.3 Запустить Python Bridge
```bash
cd python-bridge
python bridge.py
```
Должно появиться: `OPC UA connected`, `WebSocket listening on 8765`

### 6.4 Проверить статус
```bash
# В другом терминале или в Claude:
python -c "import asyncio; from asyncua import Client; ..."
# Или просто проверить что bridge.log обновляется
```

---

## Ежедневный рабочий процесс

```
1. Запустить Control Win V3 (трей)
2. Открыть Claude Code в папке проекта
3. Работать через Claude — он пишет ST-код, компилирует, деплоит
4. НЕ открывать CODESYS IDE пока Claude работает (конфликт файла)
5. Если нужен UI — закрыть Claude задачу → открыть IDE → закрыть IDE → вернуть Claude
```

---

## Критические правила (прочитать обязательно)

| # | Правило | Почему |
|---|---|---|
| 1 | Комментарии в ST-коде **только транслитом** | SP17 не поддерживает UTF-8 → кириллица → иероглифы |
| 2 | `download_to_plc` с `simulationMode=False` | Иначе OPC UA не работает |
| 3 | MCP и CODESYS UI **не одновременно** | Оба лочат файл проекта |
| 4 | После `npm update` → запустить `restore-mcp.bat` | Обновление затирает патч |
| 5 | OPC UA теги — только через `GVL_HMI` | Symbol Config нельзя менять программно в SP17 |

---

## Структура репозитория

```
specs/              ← спецификации оборудования (.md)
  _шаблон/          ← шаблон для нового FB
  uvelka/           ← проект Увелка
codesys/            ← .project файлы CODESYS (если нужны)
python-bridge/      ← OPC UA → WebSocket мост
  bridge.py         ← запуск
  tags.yaml         ← реестр OPC UA тегов
  tests/            ← FAT автотесты (pytest)
unity/              ← Unity проект (HMI)
docs/               ← документация, ADR
asutп-spec/         ← скилл /asutп-spec для Claude
CLAUDE.md           ← инструкции для Claude (MCP, SP17 quirks)
TASKS.md            ← текущие задачи
restore-mcp.bat     ← восстановить патч MCP после npm update
codesys-mcp-server.js ← бэкап патча
```

---

## Частые проблемы

**"MCP не видит инструменты"**
→ Проверить `.claude.json`, перезапустить Claude Code

**"Иероглифы в CODESYS"**
→ Кириллица в комментариях ST-кода. Заменить транслитом.

**"OPC UA не подключается"**
→ Control Win V3 не запущен ИЛИ загружен старый проект без Symbol Config

**"Проект не открывается через MCP"**
→ CODESYS IDE открыт одновременно. Закрыть IDE.

**"codesys-mcp-tool не найден"**
→ `npm install -g @codesys/mcp-toolkit` не выполнен

**"Новые MCP-инструменты недоступны"**
→ Запустить `restore-mcp.bat`, перезапустить Claude Code

---

## Контакты и ресурсы

- CLAUDE.md — полный справочник по MCP инструментам и SP17 quirks
- TASKS.md — текущие задачи и бэклог
- docs/mcp-tool-tests.md — результаты QA тестирования инструментов
- CODESYS Forum: https://forum.codesys.com
