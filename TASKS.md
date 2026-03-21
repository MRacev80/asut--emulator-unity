# TASKS — Рабочая доска

> Правила: один коммит в конце каждой задачи. Формат: `[T-XXX] описание`.
> Детали задач — в ПРОЕКТ.md.

---

## В работе

- [ ] **T-MCP-03** Протестировать компиляцию + чтение ошибок

---

## Бэклог — Итерация 0 (Инфраструктура MCP)

- [ ] **T-MCP-03** Протестировать компиляцию + чтение ошибок
  - `compile_project` → `get_compile_messages(filter=error)`
  - Ожидание: список ошибок возвращается в чат

- [ ] **T-MCP-04** Протестировать `manage_library`
  - `manage_library(action=list)` — посмотреть что в проекте
  - `manage_library(action=add, libraryName=IoStandard)` — добавить библиотеку
  - Ожидание: IoStandard добавляется, ошибки компиляции уходят

- [ ] **T-MCP-05** Протестировать `download_to_plc`
  - Эмулятор должен быть запущен (CODESYS Control Win V3)
  - `download_to_plc(simulationMode=true, startAfterDownload=true)`
  - Ожидание: приложение загружено и запущено в эмуляторе

- [ ] **T-MCP-06** Протестировать чтение логов
  - `get_codesys_log(logType=runtime, lines=20)`
  - `get_codesys_log(logType=plc, lines=20)`
  - Ожидание: последние строки логов возвращаются в чат

- [ ] **T-MCP-07** Реализовать `monitor_variable` — чтение/запись переменных онлайн
  - Чтение значений переменных из запущенного приложения
  - Запись значений (для FAT: имитация входных сигналов)

- [ ] **T-004** Проверить Modbus TCP из CODESYS (тест с Modbus Poll или C# клиентом)

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
- [x] **T-001a** Расширить MCP: `manage_library`, `get_project_variables`, `get_compile_messages`, `get_codesys_log`, `download_to_plc`
- [x] **T-001b** Тестовый проект TestPLC: `FB_Counter` + `PLC_PRG`
- [x] **T-002** Git-репозиторий, структура папок `/specs /unity /docs /codesys`
- [x] **T-003** Шаблон spec.md
