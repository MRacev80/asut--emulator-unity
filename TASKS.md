# TASKS — Рабочая доска

> Правила: один коммит в конце каждой задачи. Формат: `[T-XXX] описание`.
> Детали задач — в ПРОЕКТ.md.

---

## В работе

- [ ] **T-MCP-07** Реализовать `monitor_variable` — чтение/запись переменных онлайн

---

## Бэклог — Итерация 0 (Инфраструктура MCP)

- [ ] **T-MCP-07** Реализовать `monitor_variable` — чтение/запись переменных онлайн
  - Чтение значений переменных из запущенного приложения
  - Запись значений (для FAT: имитация входных сигналов)

- [ ] **T-004** Проверить Modbus TCP из CODESYS (тест с Modbus Poll или C# клиентом)

---

## Бэклог — Итерация 2 (Python Bridge: CODESYS → Python → Unity)

> Архитектура: CODESYS OPC UA Server → Python asyncua → WebSocket → Unity
> MasterSCADA 4 подключается напрямую к CODESYS OPC UA (без Python)

- [ ] **T-PY-01** Проверить лицензию OPC UA в CODESYS Control Win V3
  - Открыть CODESYS → Device → правой кнопкой → License Info
  - Нужен: `OPC UA Server` или `SL_OPCUAServer`
  - Если нет — найти альтернативу (демо-лицензия, другой профиль)

- [ ] **T-PY-02** Включить OPC UA Server в CODESYS, опубликовать теги
  - Добавить `Symbol Configuration` в проект
  - Включить публикацию переменных PLC_PRG через OPC UA
  - Проверить подключение через UaExpert (бесплатный OPC UA браузер)

- [ ] **T-PY-03** Создать Python Bridge — базовый скелет
  - `asyncua` клиент → подписка на теги CODESYS (push, не polling)
  - `websockets` сервер → раздаёт JSON всем Unity-клиентам
  - Структура: `python-bridge/main.py`, `bridge/opc_client.py`, `bridge/ws_server.py`

- [ ] **T-PY-04** Подключить Unity к Python Bridge
  - Добавить `NativeWebSocket` (Unity Asset Store / GitHub, бесплатно)
  - `PLCBridge.cs` → заменить NModbus на WebSocket клиент
  - Разобрать JSON → обновлять переменные в Unity

- [ ] **T-PY-05** Тест end-to-end: CODESYS → Python → Unity
  - Запустить TestPLC в эмуляторе
  - Убедиться что счётчик FB_Counter отображается в Unity в реальном времени
  - Замерить latency (лог timestamps на каждом этапе)

- [ ] **T-PY-06** Mock CODESYS в Python (тест Unity без ПЛК)
  - `MockPlcSource` — генерирует синтетические данные
  - Unity переключается между Mock и реальным ПЛК через флаг в конфиге
  - Цель: тестировать Unity-сцены без запущенного CODESYS

- [ ] **T-PY-07** FAT-автоматизация — базовый скрипт
  - Python пишет значение в CODESYS через OPC UA
  - Читает результат, проверяет условие (assert)
  - Генерирует отчёт (JSON / MD) → Claude оформляет в документ

---

## Бэклог — Итерация 0a (Проектирование)

- [ ] **T-005** Шаблон `signals.md` — таблица сигналов (тег, тип, Modbus-адрес)
- [ ] **T-006** Исследовать LikeC4 → экспорт диаграммы в PNG для spec.md
- [ ] **T-007** Дополнить шаблон spec.md: диаграмма состояний, Mermaid-диаграммы
- [ ] **T-008** Промпт для ревью spec.md до написания кода
- [ ] **T-009** Пример полного spec.md для шнека Увелка

---

## Бэклог — Итерация 1 (Первый прототип: шнек дозирования)

- [ ] **T-011** spec.md для шнека дозирования Уvelka
- [ ] **T-012** Claude создаёт FB_Shnek в CODESYS через MCP, компилирует без ошибок
- [ ] **T-013** Настроить Modbus Slave в CODESYS (5-10 регистров)
- [ ] **T-014** Unity-сцена: PNG фон + 4 лейбла + 2 кнопки
- [ ] **T-015** PLCBridge.cs — чтение Modbus каждые 200 мс
- [ ] **T-016** Ручной FAT в Unity + CODESYS Watch
- [ ] **T-017** Документация по блоку шнека (Claude по spec.md + ST-коду)

---

## Готово

- [x] **T-001** Установить codesys-mcp-toolkit, подключить к Claude Code
- [x] **T-001a** Расширить MCP: `manage_library`, `get_codesys_log`, `download_to_plc`
  - `get_compile_messages` — не нужен: ошибки компилятора видны в выводе `download_to_plc`
  - `get_project_variables` — SP17 не поддерживает, отложено
- [x] **T-001b** Тестовый проект TestPLC: `FB_Counter` + `PLC_PRG`, загружен в эмулятор (State=run)
- [x] **T-MCP-03..06** Тесты пройдены: compile, manage_library, download_to_plc, get_codesys_log
- [x] **T-002** Git-репозиторий, структура папок `/specs /unity /docs /codesys`
- [x] **T-003** Шаблон spec.md
