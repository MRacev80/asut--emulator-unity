# Эмулятор АСУТП — CODESYS + Python Bridge + Unity

Система для разработки и тестирования кода ПЛК **без выезда на объект**.
Инженер пишет Structured Text, тестирует через OPC UA, демонстрирует заказчику в Unity — всё на ноутбуке.

---

## Проблема

В АСУ ТП проектах ST-код тестируется впервые на живом объекте во время пусконаладки.
Баги — под давлением времени, при работающем оборудовании. FAT — формально или не проводится.

## Решение

```
Claude Code (пишет ST)          AI-ассистент генерирует код из спецификации
    ↓ MCP
CODESYS Control Win V3          SoftPLC выполняет ST-логику, цикл 20мс
    ↓ OPC UA tcp:4840
Python Bridge                   Читает теги, транслирует в WebSocket
    ├─→ Unity HMI                2D/3D визуализация, кнопки управления
    └─→ pytest FAT               Автоматические приёмочные тесты
        MasterSCADA 4            SCADA заказчика (напрямую к OPC UA)
```

---

## Быстрый старт

```
1. Установить CODESYS 3.5.17 SP17 Patch 3 (у руководителя проекта)
2. Запустить setup.bat     — устанавливает Node.js, MCP, Python-зависимости
3. Запустить verify.py     — проверяет весь стек, показывает таблицу PASS/FAIL
```

Подробнее: **[ONBOARDING.md](ONBOARDING.md)**

---

## Стек

| Слой | Технология | Версия |
|---|---|---|
| ST Runtime | CODESYS Control Win V3 | SP17 (3.5.17.30) |
| Язык ПЛК | Structured Text IEC 61131-3 | — |
| AI + MCP | Claude Code + codesys-mcp-toolkit | npm global |
| OPC UA клиент | asyncua (Python) | ≥1.0.0 |
| WebSocket сервер | websockets (Python) | ≥12.0 |
| Тесты | pytest + pytest-asyncio | — |
| Unity HMI | Unity 2022 LTS + NativeWebSocket | — |
| SCADA | MasterSCADA 4 | — |

---

## Структура репозитория

```
python-bridge/
  __main__.py          — точка входа (--mode mock | opcua)
  bridge/
    source/
      mock_source.py   — генератор синтетических данных (без CODESYS)
      opcua_source.py  — OPC UA клиент (asyncua subscriptions)
    ws/
      server.py        — WebSocket сервер (broadcast, write_tag)
      protocol.py      — типы сообщений (dataclasses → JSON)
    tag_registry.py    — реестр тегов из tags.yaml
  tags.yaml            — описание тегов (tag_id, node_id, type, writable)
  tests/
    unit/              — юнит-тесты (no network)
    integration/       — тесты протокола против mock Bridge
    fat/               — FAT тесты (требуется запущенный CODESYS)

unity/AsutpEmulator/
  Assets/
    PLCBridge.cs       — WebSocket клиент, реестр тегов
    TrafficLight.cs    — пример HMI компонента
    Tags.cs            — список тегов (auto-generated)

docs/
  business-process.md        — бизнес-процесс от задачи до сдачи объекта
  transport-layer-analysis.md — анализ масштабирования (500 тегов, 1 ПЛК)

specs/
  _шаблон/equipment-spec.md  — 11-секционный шаблон спецификации FB

setup.bat      — автоматическая настройка окружения (шаги 2-5)
verify.py      — проверка стека PASS/FAIL
restore-mcp.bat — восстановить патч MCP после npm update
ONBOARDING.md  — пошаговый гайд для нового сотрудника
TASKS.md       — рабочая доска задач
CLAUDE.md      — инструкции и справочник MCP для Claude Code
```

---

## WebSocket протокол (Python Bridge → Unity)

Все сообщения: UTF-8 JSON, порт `8765`.

```json
// При подключении — снимок всех тегов
{ "type": "initial_snapshot", "tags": [{"tag_id": "counter.count", "value": "3"}] }

// Обновление тегов (каждые 50мс, только изменившиеся)
{ "type": "batch_update", "updates": [{"tag_id": "counter.count", "value": "4"}] }

// Команда записи от Unity
{ "type": "write_tag", "request_id": "uuid", "tag_id": "counter.reset", "value": "True" }

// Подтверждение записи
{ "type": "write_ack", "request_id": "uuid", "tag_id": "counter.reset", "status": "ok" }
```

---

## Тесты

```bash
cd python-bridge

# Только юнит-тесты (без сети, быстро)
python -m pytest tests/unit -v

# Юнит + интеграционные (запускает mock Bridge автоматически)
python -m pytest tests/unit tests/integration -v

# FAT тесты (нужен запущенный CODESYS Control Win V3)
python -m pytest tests/fat -v -m fat
```

Текущий статус: **51/51 PASS** (unit + integration)

| Модуль | Покрытие |
|---|---|
| tag_registry.py | 100% |
| ws/protocol.py | 98% |
| source/mock_source.py | 61% |
| ws/server.py | 40% |

---

## Бизнес-процесс

| Шаг | Инструмент | Результат |
|---|---|---|
| 1. Spec | `/asutп-spec` в Claude | Формализованное ТЗ (11 секций: I/O, интерлоки, stateDiagram, FAT) |
| 2. Генерация ST | Claude → MCP → CODESYS | Скомпилированный FB без ошибок |
| 3. Загрузка | `download_to_plc` | Control Win V3 работает, OPC UA активен |
| 4. FAT | pytest + asyncua | Задокументированный результат теста |
| 5. Демо | Unity HMI | Визуализация заказчику без выезда |
| 6. SCADA | MasterSCADA 4 → OPC UA | Заказчик работает в своём ПО |

Подробнее: [docs/business-process.md](docs/business-process.md)

---

## Соглашения

**Комментарии в ST-коде — только транслит:**
```pascal
// Sbros schyotchika   ← правильно
// Сброс счётчика      ← НЕЛЬЗЯ — иероглифы в CODESYS SP17
```

**Именование тегов:**
```
counter.count   counter.reset   svetofor.state
```

**Добавление нового тега:**
1. Добавить переменную в FB/PLC_PRG
2. Добавить в `GVL_HMI.*` (wildcard в Symbol Configuration публикует автоматически)
3. Добавить строку в `python-bridge/tags.yaml`

---

## Тестовый проект

`C:\Users\Mike\Documents\TestPLC\TestPLC.project`
Содержит: `FB_Counter` (счётчик с порогом) + `PLC_PRG` (главная программа с таймером).

---

## Лицензия

Внутренний рабочий проект. Инструмент `prompt-master-main/` — MIT (third-party).
