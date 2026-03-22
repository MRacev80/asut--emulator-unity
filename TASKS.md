# TASKS — Рабочая доска

> Правила: один коммит в конце каждой задачи. Формат SMART (S, M, A, R — без даты).
> Детали и обзор — в ПРОЕКТ.md. Обновлять оба файла синхронно.

---

## В работе

### T-MCP-10 — update_symbol_configuration: OPC UA теги без UI

**Что:** `update_symbol_configuration` — принимает CSV список путей переменных, добавляет в Symbol Configuration через XML-редактирование textual_declaration
**Готово когда:** новая переменная появляется в OPC UA без открытия CODESYS UI; Python Bridge её читает
**Зачем:** каждый новый тег сейчас требует ручного шага в UI — разрывает автоматизацию
**Статус:** переписан через XML approach (get_textual_declaration → XML edit → replace); ждёт проверки после рестарта Claude Code

---

### T-MCP-08 — read_pou_code: чтение ST-кода POU

**Что:** `read_pou_code(pouPath="Application/FB_Counter")` — читает declaration + implementation
**Готово когда:** возвращает полный ST-код POU
**Зачем:** Claude читает код вслепую — невозможна инкрементальная разработка
**Статус:** пофикшен (path resolution через active_application); ждёт проверки после рестарта

---

### T-MCP-11 — create_gvl: Global Variable List

**Что:** `create_gvl(name="GVL_HMI", code="VAR_GLOBAL ... END_VAR")` добавляет GVL в проект
**Готово когда:** GVL виден в списке объектов и компилируется без ошибок
**Зачем:** реальные проекты используют GVL; без этого всё в PLC_PRG
**Статус:** пофикшен (resolve_parent через active_application); ждёт проверки после рестарта

---

### T-MCP-12 — create_dut: STRUCT/ENUM/UNION

**Что:** `create_dut(name="E_State", dutType="ENUM", body="(Idle, Running, Error)")` добавляет DUT
**Готово когда:** DUT компилируется и доступен в других POUах
**Зачем:** FB с логикой состояний требуют ENUM; параметры — STRUCT
**Статус:** пофикшен (resolve_parent через active_application); ждёт проверки после рестарта

---

## Бэклог — Итерация 2 (Python Bridge)

### T-PY-03a — tags.yaml: описать теги TestPLC

**Что:** создать `/python-bridge/tags.yaml` — теги TestPLC с реальными node_id из OPC UA
**Готово когда:** YAML валиден; Python читает node_id и успешно читает значение через asyncua
**Зачем:** инженер добавляет теги без правки кода Bridge — только YAML

---

### T-PY-06 — Mock CODESYS в Python

**Что:** создать `MockPlcSource` — флаг `USE_MOCK=true`; синтетические данные вместо OPC UA
**Готово когда:** Unity получает данные от mock без запущенного CODESYS; переключение — одна строка конфига
**Зачем:** разработка Unity-сцен без зависимости от CODESYS (Уровень 3 тестирования)

---

### T-PY-07 — FAT автоматизация: тесты FB_Counter

**Что:** написать `conftest.py` (OPC UA фикстуры) и `test_fb_counter.py` (3 теста: пуск, сброс, порог)
**Готово когда:** `pytest tests/` — все 3 теста проходят; JSON-отчёт сгенерирован
**Зачем:** шаблон FAT-автоматизации — Уровень 2 тестирования для всех будущих объектов

---

## Бэклог — Итерация 0a (Проектирование)

### T-005 — Шаблон signals.md

**Что:** создать `/specs/signals_template.md`: тег, тип, OPC UA адрес, описание, единицы, диапазон, аварийный порог; заполнить на TestPLC (5 тегов)
**Готово когда:** шаблон выглядит как рабочий документ — пригоден для передачи заказчику
**Зачем:** стандартная таблица сигналов — основа spec.md и конфигурации OPC UA

---

### T-006 — LikeC4: архитектурная диаграмма

**Что:** установить LikeC4; создать `.c4` модель архитектуры (CODESYS → Python → Unity + MasterSCADA); экспортировать PNG
**Готово когда:** PNG добавлен в `/docs/` и вставлен в ПРОЕКТ.md
**Зачем:** наглядная схема для заказчика и новых инженеров

---

### T-007 — spec.md: диаграмма состояний + аварийные ситуации

**Что:** добавить в шаблон spec.md секцию `Mermaid stateDiagram` и секцию «Аварийные ситуации»
**Готово когда:** шаблон содержит рабочий `stateDiagram` для двухсостоянного устройства
**Зачем:** диаграмма состояний — самая важная часть spec для генерации ST через Claude

---

## Бэклог — Итерация 1 (Шнек дозирования Увелка)

### T-009 — Полный spec.md для шнека Увелка

**Что:** написать `/specs/uvelka/FB_Shnek.md`: 7-10 тегов, логика пуска/останова, `stateDiagram`, аварии
**Готово когда:** spec прошёл ревью без критических вопросов
**Зачем:** первый реальный spec — проверка методологии на практике

### T-012 — Claude генерирует FB_Shnek через MCP
### T-013 — OPC UA теги FB_Shnek
### T-014 — Unity сцена П&ИД шнека
### T-015 — PLCBridge.cs двусторонняя связь шнека
### T-016 — FAT-скрипт шнека (5 тестов)
### T-017 — Документация FB_Shnek

---

## Готово ✅

- [x] **T-001** Установить codesys-mcp-toolkit, подключить к Claude Code
- [x] **T-001a** Расширить MCP: `manage_library`, `get_codesys_log`, `download_to_plc`
- [x] **T-001b** TestPLC: `FB_Counter` + `PLC_PRG`, запущен в эмуляторе
- [x] **T-002** Git-репозиторий, структура папок
- [x] **T-003** Шаблон spec.md
- [x] **T-PY-01** Лицензия OPC UA подтверждена
- [x] **T-PY-02** OPC UA включён; Symbol Configuration в TestPLC; Python читает теги
- [x] **T-ARCH-01** Архитектура Python Bridge — ADR-001, C4 L1-L3, протокол, failure modes
- [x] **T-PY-03b** Python Bridge OpcUaSource — asyncua polling 200ms, change detection
- [x] **T-PY-03c** WsServer — broadcast всем Unity клиентам, initial_snapshot
- [x] **T-PY-03d** WriteDispatcher — whitelist, write_ack
- [x] **T-PY-04** Unity NativeWebSocket + PLCBridge.cs — counter.count в реальном времени
- [x] **T-PY-05** End-to-end тест: CODESYS → Python → Unity — счётчик работает ✅
- [x] **T-DEMO-01** FB_Svetofor в CODESYS: Red/Yellow/Green по таймеру; OPC UA тег `svetofor.state` читается Python Bridge ✅
- [x] **T-DEMO-02** Unity светофор + кнопки Reset/Stop-Start: TrafficLight.cs, двустороннее управление через WebSocket ✅
- [x] **T-MCP-09** get_application_state: возвращает Running/Stopped/Error ✅
- [x] **T-MCP-13** list_project_objects: дерево объектов проекта ✅
- [x] **T-MCP-14** start_stop_application: старт/стоп/сброс без перезагрузки ✅
