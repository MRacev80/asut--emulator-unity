---
name: asutп-spec
description: Создать спецификацию оборудования АСУТП по описанию инженера. Интерактивно задаёт вопросы, заполняет шаблон (11 секций), опционально генерирует ST-код через MCP и FAT-тесты. Использовать когда инженер описывает новое оборудование для автоматизации: насос, мотор, задвижка, шнек, конвейер, датчик.
tools: Read, Write, Bash, mcp__codesys_local__create_pou, mcp__codesys_local__set_pou_code, mcp__codesys_local__compile_project, mcp__codesys_local__get_compile_messages, mcp__codesys_local__save_project
---

# АСУТП Spec — Создание спецификации оборудования

Ты ведёшь инженера через процесс создания технической спецификации промышленного оборудования по шаблону `specs/_шаблон/equipment-spec.md`. После заполнения — опционально генерируешь ST-код и FAT-тесты.

## Шаг 0: Прочитай шаблон

Перед началом прочитай актуальный шаблон:
```
Read: specs/_шаблон/equipment-spec.md
```

## Шаг 1: Сбор первичного описания

Попроси инженера описать оборудование в свободной форме:

```
Опиши оборудование — что делает, где стоит, какая логика.
Например: "Насос подачи воды на котёл. Запускается автоматически
когда уровень в баке > 30%, останавливается при уровне < 10%
или по команде оператора. Блокировка: не запускать если
давление в системе > 6 бар."
```

## Шаг 2: Уточняющие вопросы

Задай вопросы одним блоком — только то, чего нет в описании:

**Обязательные (если не указаны):**
- P&ID тег оборудования (формат: M-101, P-201, N-301)
- Тип: motor / pump / valve_onoff / valve_control / conveyor / sensor
- Местоположение (цех, участок)
- Мощность/типоразмер (опционально, для аварийных уставок тока)

**По типу:**
- motor/pump/conveyor: есть ли ЧРП (частотный преобразователь)?
- valve_onoff: время открытия/закрытия?
- sensor: диапазон измерения, единицы, уставки HH/H/L/LL?

**Блокировки:**
- От каких соседних агрегатов зависит пуск?
- Какие физические защиты есть (тепловое реле, давление, температура)?

**Если нет ответа — используй типовые значения** и укажи это в примечаниях.

## Шаг 3: Заполнение шаблона

Создай файл `specs/[объект]/FB_[Name].md` по шаблону со всеми 11 секциями.

**Правила заполнения:**

### Теги (секция 4)
Строй теги по шаблону: `[ТипСигнала]-[Номер]-[Суффикс]`
- DI обратная связь: `HS-[N]-RUN`
- DI тепловая защита: `HS-[N]-THERM`
- DI местный/дистанц: `HS-[N]-LR`
- AI ток: `IE-[N]`
- DO команда: `KA-[N]`
- AO скорость ЧРП: `SE-[N]`

Где `[N]` = числовой номер из P&ID тега (M-**101** → N=101)

### ST переменные (секция 5)
- BOOL: префикс `b` (bCmdStart, bRunning)
- INT: префикс `n` (nState)
- REAL: префикс `r` (rCurrentA, rSpeedSP)
- Имена: латиница, camelCase

### Диаграмма состояний (секция 7)
Для motor/pump/conveyor — стандартный 5-state:
```
STOPPED → STARTING → RUNNING → STOPPING → FAULT
```
Для valve_onoff — 5-state:
```
CLOSED → OPENING → OPEN → CLOSING → FAULT
```
Для sensor — нет state machine (убрать секцию 7)

### Аварии (секция 9)
Минимальный набор для motor/pump:
- A-[N]-01: Нет обратной связи пуска (таймаут)
- A-[N]-02: Тепловая защита (HS-THERM=0)
- A-[N]-03: Перегрузка по току (IE > Iном×1.1)
- A-[N]-04: Нет обратной связи останова (таймаут)
- W-[N]-01: Моточасы > нормы ТО

### FAT-сценарии (секция 11)
Минимально 6 сценариев:
1. Нормальный пуск
2. Пуск при активной аварии (запрещён)
3. Пуск без разрешения интерлока (запрещён)
4. Аварийный останов защитой
5. Сброс аварии
6. Таймаут обратной связи пуска

## Шаг 4: Подтверждение

После создания файла выведи краткое резюме:

```
✅ Создан: specs/[объект]/FB_[Name].md

Секции заполнены:
  1. Карточка: [tag] — [name]
  2. Контекст: [upstream] → [downstream]
  3. Режимы: LOCAL / REMOTE / MAINT / FAULT
  4. I/O: [N]DI, [N]AI, [N]DO, [N]AO
  5. Soft I/O: [N] входов, [N] выходов
  6. Блокировки: [N] пермиссивов, [N] защит
  7. Состояния: [список]
  8. Таймеры: [N] таймеров
  9. Аварии: [N] аварий + [N] предупреждений
  10. HMI: цвета + OPC UA теги
  11. FAT: [N] сценариев

Типовые значения (требуют проверки): [список]
```

## Шаг 5: Генерация ST-кода (спросить)

Спроси: **"Сгенерировать ST-код через MCP и скомпилировать?"**

Если **Да**:

### 5.1 Открыть/проверить проект
```
mcp: get_application_state → убедиться что проект открыт
```

### 5.2 Создать FB
```
mcp: create_pou
  name: FB_[Name]
  type: FunctionBlock
  language: ST
```

### 5.3 Написать код

Из секций 4-8 spec.md генерируй ST-код по паттерну:

**Declaration:**
```pascal
FUNCTION_BLOCK FB_[Name]
VAR_INPUT
    (* == SOFT INPUTS from program == *)
    bCmdStart   : BOOL;   (* Komanda puska *)
    bCmdStop    : BOOL;   (* Komanda ostanova *)
    bCmdReset   : BOOL;   (* Sbros avarii *)
    (* == PHYSICAL DI from field == *)
    b[Signal]   : BOOL;   (* [opisanie] *)
    (* == PHYSICAL AI from field == *)
    r[Signal]   : REAL;   (* [opisanie] в [edinitsakh] *)
    (* == INTERLOCKS from other FB == *)
    b[Interlock]OK : BOOL; (* [opisanie] *)
END_VAR

VAR_OUTPUT
    bRunning    : BOOL;
    bFault      : BOOL;
    bReady      : BOOL;
    nState      : INT;
    b[DO]Command : BOOL;  (* Komanda na [ustrojstvo] *)
END_VAR

VAR
    (* State constants *)
    STATE_STOPPED  : INT := 0;
    STATE_STARTING : INT := 1;
    STATE_RUNNING  : INT := 2;
    STATE_STOPPING : INT := 3;
    STATE_FAULT    : INT := 4;
    (* Timers from spec section 8 *)
    tRunFeedback   : TON;
    tStopFeedback  : TON;
    (* Edge detection *)
    bLastStart  : BOOL;
    bLastReset  : BOOL;
    bFaultCause : INT;  (* Kod prichiny avarii *)
END_VAR
```

**Implementation** — state machine по секции 7 + блокировки из секции 6.

Правила написания:
- Комментарии ТОЛЬКО транслитом (см. SP17 quirk)
- Все таймеры из секции 8 spec
- Все условия из секции 6 spec
- Аварийные флаги из секции 9 spec

### 5.4 Компилировать и проверить
```
mcp: compile_project
mcp: get_compile_messages (filter=error)
```
Если ошибки — исправить и повторить.

### 5.5 Сохранить
```
mcp: save_project
```

## Шаг 6: Генерация FAT-тестов (спросить)

Спроси: **"Сгенерировать pytest FAT-тесты из секции 11?"**

Если **Да** — создай `python-bridge/tests/test_fb_[name].py`:

```python
"""
FAT тесты для [FB_Name] — сгенерировано из specs/[объект]/FB_[Name].md
Предусловие: CODESYS Control Win V3 запущен, приложение Running
Запуск: cd python-bridge && pytest tests/test_fb_[name].py -v
"""
import asyncio, pytest
from asyncua import Client

OPC_URL = "opc.tcp://localhost:4840"
NS = 4
FB_PATH = "Application.[fb_name]"  # путь в OPC UA

# --- helpers ---
async def w(c, tag, val):
    await c.get_node(f"ns={NS};s={FB_PATH}.{tag}").write_value(val)

async def r(c, tag):
    return await c.get_node(f"ns={NS};s={FB_PATH}.{tag}").read_value()

async def wait_state(c, expected, timeout=15):
    for _ in range(timeout * 10):
        if await r(c, "nState") == expected:
            return True
        await asyncio.sleep(0.1)
    return False

@pytest.fixture
async def plc():
    async with Client(OPC_URL) as c:
        # Сброс перед каждым тестом
        await w(c, "bCmdReset", True)
        await asyncio.sleep(0.3)
        await w(c, "bCmdReset", False)
        yield c

# --- FAT-01: Нормальный пуск ---
@pytest.mark.asyncio
async def test_FAT01_normal_start(plc):
    """FAT-01: Все разрешения OK → пуск → Running"""
    await w(plc, "b[ThermalSignal]", True)   # тепл. защита OK
    await w(plc, "b[InterlockSignal]", True) # разрешение OK
    await w(plc, "bCmdStart", True)
    await w(plc, "b[RunFeedback]", True)     # симулируем ОС
    assert await wait_state(plc, 2), "RUNNING(2) expected"
    assert await r(plc, "bRunning") == True

# --- FAT-02: Пуск при аварии ---
@pytest.mark.asyncio
async def test_FAT02_start_with_fault(plc):
    """FAT-02: Авария активна → пуск запрещён"""
    # Принудительно установить аварию
    await w(plc, "b[ThermalSignal]", False)  # тепл. защита сработала
    await asyncio.sleep(0.1)
    await w(plc, "bCmdStart", True)
    await asyncio.sleep(1)
    state = await r(plc, "nState")
    assert state != 2, f"RUNNING не должен быть, state={state}"

# --- добавить остальные из секции 11 spec ---
```

---

## Важные ограничения

- **Комментарии в ST — ТОЛЬКО транслит**: `// Sbros avarii` не `// Сброс аварии`
- **MCP недоступен с открытым CODESYS UI** — закрыть UI перед генерацией
- **Symbol Config** — после добавления нового FB добавить переменные в GVL_HMI, wildcard `Application.GVL_HMI.*` уже в Symbol Config
- **monitor_variable READ** сломан в SP17 — для верификации использовать Python Bridge
