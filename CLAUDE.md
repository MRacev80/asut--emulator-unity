# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

Проект по эмуляции и тестированию кода Structured Text (ST) для CODESYS в АСУ ТП проектах. Цели: уменьшение багов, обучение инженеров, демонстрация заказчику, упрощение написания кода с помощью ИИ, создание документации. Конечный результат — бизнес-процесс по написанию и тестированию ST-кода.

Также содержит research notes (Obsidian-style) по архитектуре эмулятора АСУТП.

## Knowledge Base Structure

All 5 `.md` files use Obsidian YAML frontmatter (`tags`, `Связь` for cross-references, `Задачи` for to-dos). Topics are interconnected:

| File | Topic |
|---|---|
| `Эмуляция АСУ ТП — технические решения и практика.md` | Core architecture: 4 emulation strategies (full simulation → full emulation), reference 800 MW plant project (~10 000 monitoring points) |
| `Architecture As Code — моделирование АСУТП.md` | Using **LikeC4** (TypeScript C4-model DSL) to model the SCADA system; proof-of-concept on Uvelka |
| `Естественный язык как программирование — связь с АСУТП.md` | **CodeSpeak** approach: Markdown specs → LLM → IEC 61131-3 Structured Text; PLC logic as "conditions + actions" |
| `Чтение и запись переменных из ПЛК по Modbus в CSharp.md` | C# Modbus TCP integration via **NModbus** (NuGet); CODESYS-specific limits (4096 holding registers, reset quirk) |
| `Prompt Master — генерация детальных промптов.md` | Notes on using the Prompt Master Claude skill for generating LLM prompts |

## Domain Concepts

- **АСУТП** — Russian abbreviation for industrial process control system (SCADA/DCS)
- **ПЛК** — PLC (programmable logic controller); real targets are **Uvelka** and **Zela** PLCs
- **CODESYS** — IEC 61131-3 IDE used for Structured Text (ST) programming
- **Digital Twin** — the long-term goal: a software replica that mirrors the real plant
- **1С** — Russian ERP system; planned integration with PLCs via Modbus

## `prompt-master-main/`

A vendored clone of the third-party [prompt-master](https://github.com/nidhinjs/prompt-master) Claude skill (MIT license). It is **not maintained in this repo** — do not edit its files. It contains `SKILL.md` (execution guide) and `references/` (patterns and templates for prompt engineering).

## CODESYS MCP Connector

Claude Code управляет CODESYS через MCP-сервер `codesys_local` (пакет `@codesys/mcp-toolkit`, установлен глобально через npm).

**Установка:** `npm install -g @codesys/mcp-toolkit`
**Конфигурация:** `~/.claude.json` → `mcpServers.codesys_local`
**CODESYS:** `C:\Program Files (x86)\CODESYS 3.5.17.30\CODESYS\Common\CODESYS.exe`
**Профиль:** `CODESYS V3.5 SP17 Patch 3`

### Доступные инструменты MCP

| Инструмент | Параметры | Что делает |
|---|---|---|
| `open_project` | `projectFilePath` | Открыть проект |
| `create_project` | `projectFilePath`, `deviceName` | Создать новый проект |
| `save_project` | `projectFilePath` | Сохранить проект |
| `create_pou` | `projectFilePath`, `name`, `type` (Program/FunctionBlock/Function), `language` (ST/LD/...), `parentPath` | Создать ПОУ |
| `set_pou_code` | `projectFilePath`, `pouPath`, `declarationCode`, `implementationCode` | Записать ST-код в ПОУ |
| `create_method` | `projectFilePath`, `pouPath`, `methodName`, `language` | Создать метод FB |
| `create_property` | `projectFilePath`, `pouPath`, `propertyName` | Создать свойство FB |
| `compile_project` | `projectFilePath` | Компилировать проект |
| `manage_library` | `projectFilePath`, `action` (add/remove/list), `libraryName` | Управление библиотеками |
| `get_project_variables` | `projectFilePath` | Declarations всех ПОУ |
| `get_compile_messages` | `projectFilePath`, `filter` (all/error/warning/info) | Сообщения компилятора |
| `get_codesys_log` | `logType` (runtime/plc/all), `lines` | Логи runtime |
| `download_to_plc` | `projectFilePath`, `simulationMode` (false=Control Win V3), `startAfterDownload` | Загрузить в ПЛК |
| `monitor_variable` | `projectFilePath`, `action` (read/write/read_all), `variablePath`, `value` | Читать/писать переменную online |
| `read_pou_code` | `projectFilePath`, `pouPath` | **[NEW]** Прочитать declaration + implementation ST-кода |
| `get_application_state` | `projectFilePath` | **[NEW]** Состояние приложения: Running/Stopped/Error/NoApplication |
| `update_symbol_configuration` | `projectFilePath`, `variablePaths` (через запятую) | **[NEW]** Добавить теги в OPC UA Symbol Configuration без UI |
| `create_gvl` | `projectFilePath`, `name`, `parentPath`, `code` | **[NEW]** Создать Global Variable List |
| `create_dut` | `projectFilePath`, `name`, `dutType` (STRUCT/ENUM/UNION), `parentPath`, `body` | **[NEW]** Создать STRUCT/ENUM/UNION |
| `list_project_objects` | `projectFilePath` | **[NEW]** Дерево всех объектов проекта (POUs, GVLs, DUTs, папки) |
| `start_stop_application` | `projectFilePath`, `action` (start/stop/reset) | **[NEW]** Старт/стоп/сброс без перезагрузки |

### Правила написания ST-кода через Claude

- **Комментарии** писать транслитом (латинскими буквами по-русски): `// Sbros schyotchika`, `// Vklyuchenie nasoса`
- Кириллица в комментариях → иероглифы в CODESYS SP17 (проблема кодировки UTF-8 vs Windows-1251)
- `pouPath` формат: `Application/ИмяПОУ` (например `Application/FB_Counter`)

### Ограничения и рабочий процесс

MCP запускает **отдельный скрытый экземпляр CODESYS** — не подключается к открытому UI.

**Не работает одновременно с открытым UI** (конфликт файла). Рекомендуемый процесс:
```
Claude пишет код (MCP) → сохраняет файл
    ↓
Открыть в CODESYS UI → скомпилировать → загрузить в ПЛК
    ↓
Закрыть UI → снова отдать Claude для правок
```

**download_to_plc — важно:**
- `simulationMode=False` → загружает в **Control Win V3** (нужен для OPC UA)
- `simulationMode=True` → загружает во встроенный симулятор CODESYS IDE (OPC UA не видит)
- Всегда использовать `simulationMode=False` когда нужен OPC UA / Python Bridge / Unity

**Нельзя через MCP:** управление Device, Task Configuration, онлайн-мониторинг, создание GVL.

### Расширение server.js

Кастомные инструменты добавлены напрямую в:
`C:\Users\Mike\AppData\Roaming\npm\node_modules\@codesys\mcp-toolkit\dist\server.js`

После изменений — перезапустить Claude Code для перезагрузки MCP-сервера.

**Бэкап и восстановление после `npm update`:**

Модифицированный `server.js` сохранён в папке проекта:
- `codesys-mcp-server.js` — бэкап кастомного server.js
- `restore-mcp.bat` — восстанавливает server.js одним двойным кликом

```
npm update -g @codesys/mcp-toolkit  →  restore-mcp.bat  →  перезапуск Claude Code
```

При добавлении новых инструментов в server.js — обновить бэкап:
```bash
cp "C:/Users/Mike/AppData/Roaming/npm/node_modules/@codesys/mcp-toolkit/dist/server.js" "./codesys-mcp-server.js"
```

### Тестовый проект

`C:\Users\Mike\Documents\TestPLC\TestPLC.project`
Содержит: `FB_Counter` (счётчик с порогом), `PLC_PRG` (главная программа с таймером).
