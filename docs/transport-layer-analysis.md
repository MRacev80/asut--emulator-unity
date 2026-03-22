# Анализ транспортного уровня — CODESYS → Python Bridge → Unity

> Дата: 2026-03-22 | Статус: быстрые правки применены ✅ — справочный для будущего масштабирования

## Контекст проекта

- **Целевая ёмкость**: 500 тегов (средний проект), 1500 макс (исторический максимум)
- **Топология ПЛК**: 1 ПЛК на проект — все интерфейсные модули на шине ПЛК, ПЛК выставляет единый OPC UA сервер
- **Рабочий фокус**: 500 тегов, 1 ПЛК — покрывает все текущие проекты без изменений

---

## Стек

```
CODESYS Control Win V3 (OPC UA :4840)
    ↓ subscription push, period_ms=100
Python Bridge (asyncua + asyncio)
    ↓ WebSocket batch 50ms, JSON
Unity HMI (NativeWebSocket, C#)
```

---

## Слой 1 — OPC UA (opcua_source.py)

### Что делает
- Одна подписка `create_subscription(period_ms=100)`
- Все теги регистрируются в ONE `subscribe_data_change(nodes)`
- Push-модель: CODESYS уведомляет при изменении, не polling
- Реконнект: 5s backoff, полная перерегистрация подписок

### Риски

| # | Риск | 500 тегов | 1500 тегов | Фикс |
|---|------|-----------|------------|------|
| R-OPC-1 | Лимит monitored items в одном вызове (CODESYS ~1000) | ✅ OK | ❌ Сломает | `subscribe_data_change` чанками по 500 |
| R-OPC-2 | Burst при реконнекте: 1500 событий подряд | ✅ OK | ⚠️ Flood | Rate limiting |
| R-OPC-3 | `ns=4` захардкожено в tags.yaml — меняется при переустановке | ⚠️ Риск | ⚠️ Риск | `get_namespace_index()` при коннекте |

### При 500 тегах: без изменений ✅

---

## Слой 2 — Python asyncio

### Что делает
- Один event loop: OPC UA события + WebSocket сервер + batch_loop
- `datachange_notification` → синхронный callback → два dict-write (snapshot + pending)
- `batch_loop`: каждые 50ms отправляет накопленные изменения

### Риски

| # | Риск | 500 тегов | 1500 тегов | Фикс |
|---|------|-----------|------------|------|
| R-ASYNC-1 | N×M отправка: `for ws in clients: for msg in batch: await ws.send(msg)` | ✅ OK | ❌ Starvation | Один `ws.send(json_array)` вместо N awaits |

**Конкретно**: 1500 тегов × 3 клиента = 4500 `await` в одном батче → event loop занят ~30-50ms → OPC UA события накапливаются.

При 500 тегах: 500 × 3 = 1500 await, ~10ms — работает, но burst при старте ощутим.

### При 500 тегах: приемлемо ✅

---

## Слой 3 — WebSocket (ws/server.py)

### Что делает
- `on_client_connect` → `initial_snapshot` (все текущие значения одним сообщением) + `plc_status`
- `batch_loop` каждые 50ms: берёт `_pending`, сериализует в JSON, рассылает по клиентам

### Риски

| # | Риск | 500 тегов | 1500 тегов | Фикс |
|---|------|-----------|------------|------|
| R-WS-1 | `initial_snapshot` — одно сообщение 150KB, NativeWebSocket buffer 64KB | ⚠️ 50KB, на грани | ❌ Обрыв | Чанки по 200 тегов |
| R-WS-2 | Нет backpressure: медленный клиент блокирует event loop | ✅ OK | ⚠️ | Per-client queue + drop old |

### Трафик в штатном режиме
```
20% тегов меняются/сек:
  500 тегов:  100 изм/с × 90 байт = 9 KB/s   → незаметно
  1500 тегов: 300 изм/с × 90 байт = 27 KB/s  → незаметно

Burst (все теги, старт):
  500 тегов:  50 KB одним сообщением → ⚠️
  1500 тегов: 150 KB одним сообщением → ❌
```

### При 500 тегах: initial_snapshot нужен чанкинг ⚠️

---

## Слой 4 — Unity (PLCBridge.cs)

### Риски

| # | Риск | Описание | Фикс |
|---|------|----------|------|
| R-UNITY-1 | Static Tags dict — не потокобезопасен | WebSocket поток пишет, Unity main thread читает в Update() | ConcurrentQueue + Flush в Update |
| R-UNITY-2 | Polling в Update() | TrafficLight.cs читает тег каждый кадр (60 FPS) | TagRegistry с событиями — реакция только на изменение |
| R-UNITY-3 | Нет типов тегов | Всё — string, каждый компонент парсит сам | TagRegistry с типизацией |

---

## Итоговая оценка ёмкости

```
                    | 500 тегов, 1 ПЛК | 1500 тегов, 1 ПЛК
--------------------+-------------------+-------------------
Без изменений       | ✅ Работает       | ❌ 3 точки отказа
Быстрые правки      | ✅ Без ограничений| ✅ Стабильно
(1-2 дня Python)    |                   |
```

---

## Быстрые правки — ПРИМЕНЕНЫ 2026-03-22

### 1. Subscription chunking — R-OPC-1
```python
CHUNK = 500
for i in range(0, len(nodes), CHUNK):
    await sub.subscribe_data_change(nodes[i:i+CHUNK])
```

### 2. Batch JSON вместо N×M отправки — R-ASYNC-1
```python
# ws/server.py — вместо цикла for msg in messages: await ws.send(msg)
combined = json.dumps([json.loads(m) for m in messages])
await ws.send(combined)   # 1 await на клиента вместо N
```
Unity: `type: "batch_update"`, парсить массив.

### 3. Chunked initial_snapshot — R-WS-1
```python
CHUNK = 200
items = list(self._snapshot.items())
for i in range(0, len(items), CHUNK):
    await ws.send(InitialSnapshotMsg(tags=items[i:i+CHUNK]).to_json())
```

### 4. Dynamic namespace discovery — R-OPC-3
```python
# В _connect_once() перед get_node():
ns_idx = await client.get_namespace_index("urn:CODESYS3.5.17.30")
# Заменить ns=4 динамически
```

### 5. Rate limiting в tags.yaml — R-OPC-2 частично
```yaml
- id: motor_101.current
  max_update_ms: 500   # Bridge пропускает промежуточные значения
```

---

## Архитектура multi-PLC (если понадобится в будущем)

Текущий проект: 1 ПЛК — все интерфейсные модули на шине, ПЛК → OPC UA.
Если потребуется несколько ПЛК:

```yaml
plcs:
  - id: main
    endpoint: opc.tcp://localhost:4840
  - id: aux
    endpoint: opc.tcp://192.168.1.100:4840

tags:
  - id: main/pump_101.state
    plc: main
    node_id: "ns=4;s=..."
  - id: aux/fan_201.state
    plc: aux
    node_id: "ns=4;s=..."
```

Bridge запускает несколько `OpcUaSource`, маршрутизирует по prefix. Unity видит один WebSocket.

---

## Связанные файлы

- `python-bridge/bridge/source/opcua_source.py` — OPC UA клиент
- `python-bridge/bridge/ws/server.py` — WebSocket сервер + batch loop
- `python-bridge/tags.yaml` — реестр тегов
- `unity/AsutpEmulator/Assets/PLCBridge.cs` — Unity WebSocket клиент
