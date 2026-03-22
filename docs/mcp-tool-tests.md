# MCP Tool Test Plan — CODESYS SP17

> QA-прогон инструментов MCP после фиксов `textual_declaration` и `active_application` path resolution.
> Дата: 2026-03-22 | Версия CODESYS: SP17 Patch 3 | Проект: TestPLC.project

---

## Scope

| Группа | Инструменты | Тип |
|---|---|---|
| **Под тестом** | `read_pou_code`, `create_gvl`, `create_dut`, `update_symbol_configuration` | Новые (пофикшены) |
| **Регрессия** | `get_application_state`, `list_project_objects`, `start_stop_application` | Уже работали |
| **Out of scope** | `monitor_variable (read)` | Известный баг SP17, отдельная задача |

---

## Среда

```
Проект:   C:\Users\Mike\Documents\TestPLC\TestPLC.project
Runtime:  CODESYS Control Win V3 (порт 4840)
MCP:      @codesys/mcp-toolkit (кастомный server.js, бэкап: codesys-mcp-server.js)
```

**Предусловие:** Control Win V3 запущен, приложение загружено (state=Running или Stopped — не важно).

---

## Тест-матрица

| ID | Инструмент | Входные данные | Ожидаемый результат | Фактический результат | Статус |
|---|---|---|---|---|---|
| T-TEST-01 | `read_pou_code` | `pouPath=Application/FB_Counter` | ST-код с `FUNCTION_BLOCK FB_Counter` | Возвращён полный ST-код FB_Counter ✅ | PASS |
| T-TEST-02 | `read_pou_code` | `pouPath=Application/PLC_PRG` | ST-код с `PROGRAM PLC_PRG` | Возвращён полный ST-код PLC_PRG с bCmdReset, bCmdStart ✅ | PASS |
| T-TEST-03 | `create_dut` | `E_TestState`, ENUM, `(Idle:=0, Running:=1, Error:=2)` | DUT создан, виден в дереве | `E_TestState` создан, виден в list_project_objects, компилируется ✅ | PASS |
| T-TEST-04 | `create_gvl` | `GVL_Test`, код `VAR_GLOBAL nTestVar : INT; END_VAR` | GVL создан, компилируется | `GVL_Test` создан, виден в list_project_objects, компилируется ✅ | PASS |
| T-TEST-05 | `update_symbol_configuration` | `.Application.PLC_PRG.bCmdReset` | Тег добавлен в XML Symbol Config | `no working API found` — `textual_declaration.text` пуст, никаких методов add_symbol в SP17 | FAIL |
| T-TEST-06 | `start_stop_application` | `action=stop` → `action=start` | state: Running | start вернул "Application started", но get_application_state читает из файла (не runtime) | PARTIAL |
| T-TEST-07 | `get_application_state` | — | Running / Stopped (не крашится) | `state=Stopped` — работает корректно ✅ | PASS |
| T-TEST-08 | `list_project_objects` | — | Список объектов с FB_Counter, FB_Svetofor | FB_Counter, FB_Svetofor, Symbols — все видны ✅ | PASS |

---

## Критерии приёмки

- **PASS** — результат совпадает с ожидаемым
- **FAIL** — ошибка или неверный результат
- **PARTIAL** — инструмент работает, но неполно (например, GVL создан, но код не записан)

**Проходной порог:** T-TEST-01..02 обязательны (read_pou_code — критично для разработки).
T-TEST-05 (update_symbol_configuration) — целевой, допускает PARTIAL если XML формат отличается.

---

## Результаты прогона

**Прогон 1 — 2026-03-22, сессия 1 (после рестарта #2)**

| Инструмент | Статус | Ключевой баг |
|---|---|---|
| `read_pou_code` | ✅ PASS | — |
| `get_application_state` | ✅ PASS | — |
| `list_project_objects` | ✅ PASS | — |
| `start_stop_application` | ⚠️ PARTIAL | state читается из файла, не из runtime |
| `create_dut` | 🔴 BLOCKED | `NameError: scriptengine` → фикс: `script_engine` + fallbacks |
| `create_gvl` | ⏳ PENDING | ждёт рестарта после фикса |
| `update_symbol_configuration` | ⏳ PENDING | ждёт рестарта после фикса |

**Прогон 2 — 2026-03-22, сессия 2 (после рестарта #3)**

| Инструмент | Статус | Примечание |
|---|---|---|
| `create_dut` | ✅ PASS | E_TestState ENUM создан и компилируется |
| `create_gvl` | ✅ PASS | GVL_Test создан и компилируется |
| `update_symbol_configuration` | ❌ FAIL | SP17 не имеет scriptengine API для Symbol Config |

**Итого: 6/8 PASS, 1 PARTIAL, 1 FAIL (архитектурное ограничение SP17)**

**Прогон 3 — 2026-03-22, сессия 3 (diagnose_symbol_config)**

| Инструмент | Статус | Примечание |
|---|---|---|
| `diagnose_symbol_config` | ✅ PASS | Диагностика выполнена |

**Финальный вывод по update_symbol_configuration:**
- `Symbols` объект найден: тип `ExtendedObject[IScriptObject]`
- `dir(sym_cfg)` → **0 атрибутов** — COM-интерфейс не экспонирован в Python
- `textual_declaration` → нет
- Export/import методы → нет ни одного из 20+ кандидатов
- `script_engine.GetService()` → метод не существует в SP17
- **Вердикт: SP17 не предоставляет никакого scriptengine API для Symbol Configuration**

**Workaround (принят как архитектурное соглашение):**
- Разовая настройка в CODESYS UI: добавить `Application.GVL_HMI.*` wildcard в Symbol Config
- Все новые теги для OPC UA помещать в `GVL_HMI` (создаётся через `create_gvl`)
- Claude создаёт/обновляет GVL_HMI автоматически через MCP → wildcard публикует всё автоматически

---

## Известные ограничения SP17

- `monitor_variable` READ → "Internal Exception" — OPC UA bridge используется вместо
- `textual_declaration` — свойство (property), не метод `get_textual_declaration()`
- `active_application` — обязателен для резолва пути `Application/...`, прямой поиск не работает
- `update_symbol_configuration` — SP17 не экспонирует API Symbol Config через scriptengine; `.project` файл бинарный ZIP (GUID-ключи); **workaround: GVL_HMI + wildcard в UI**
