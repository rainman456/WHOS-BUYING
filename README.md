# Order Book Depth Renderer

A real-time order book visualiser built on Stake's exact production stack.
Simulates a live stock exchange — matching engine, WebSocket broadcast, GPU-accelerated depth chart.

---

## Stack

| Layer      | Technology              | Why                                              |
|------------|-------------------------|--------------------------------------------------|
| Backend    | Python 3.12 + FastAPI   | Async-native, minimal overhead, typed            |
| Deps       | uv                      | 10–100× faster than pip, deterministic lockfile  |
| Frontend   | Svelte + TypeScript     | Reactive stores, zero virtual DOM overhead       |
| Renderer   | PixiJS 8 (WebGL)        | GPU-accelerated — handles 60fps bar animation    |
| Bundler    | Bun + Vite              | Sub-second cold starts, native TS support        |
| Components | Storybook 8             | Isolated component dev and documentation         |
| Runtime    | Docker Compose          | Reproducible environment, hot reload both sides  |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  BACKEND                                            │
│                                                     │
│  TickSimulator   →   MatchingEngine   →  OrderBook  │
│  (random walk)       (FIFO price-time)   (heapq)    │
│                            │                        │
│                       FastAPI /ws                   │
│                       broadcasts every 100ms        │
└────────────────────────────│────────────────────────┘
                             │ WebSocket
┌────────────────────────────│────────────────────────┐
│  FRONTEND                  │                        │
│                            ▼                        │
│                    Svelte store                     │
│                    (reactive state)                 │
│                            │                        │
│                    PixiJS Renderer                  │
│                    (lerped bar animation @ 60fps)   │
│                            │                        │
│                       Canvas / WebGL                │
└─────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### Matching Engine — heapq over sorted list
A sorted list gives O(n log n) inserts. A heap gives O(log n).
At 12+ orders/second this is the correct structure.
Lazy deletion avoids O(n) removal — stale entries are drained on next peek.

### WebSocket — one broadcast loop, not one per client
A single `asyncio` task snapshots the engine and fans out to all connections
via `asyncio.gather`. JSON is serialised once regardless of client count.

### PixiJS — object pooling + lerp
Bar `Graphics` objects are created once per price level and reused every frame.
Lerp (linear interpolation) smooths bar width changes between data ticks,
eliminating visual jarring at 10 updates/second.

### Svelte store as the single source of truth
PixiJS never touches the DOM or reads raw WebSocket data.
Svelte owns the data layer. PixiJS owns the visual layer.
Clean interface: `renderer.update(snapshot, maxQty)`.

### uv + bun
Both tools prioritise startup time and cache efficiency.
`uv sync` is roughly 80× faster than `pip install` on a cold build.
`bun install` is 3–25× faster than npm on equivalent packages.
In Docker this means meaningfully faster CI and image builds.

---

## Running locally

```bash
# Clone and start everything
docker compose up --build

# App:       http://localhost:5173
# API:       http://localhost:8000
# Storybook: bun run storybook (inside frontend container)
```

---

## Project structure

```
order-book/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml          # uv managed
│   └── src/
│       ├── main.py             # FastAPI app + lifespan
│       ├── engine/
│       │   ├── models.py       # Order, Trade — __slots__ for memory
│       │   ├── order_book.py   # heapq bid/ask book
│       │   ├── matching_engine.py  # FIFO price-time priority
│       │   └── simulator.py    # random walk tick generator
│       └── ws/
│           └── manager.py      # broadcast manager
└── frontend/
    ├── Dockerfile
    ├── package.json            # bun managed
    ├── vite.config.ts
    ├── .storybook/
    │   ├── main.ts
    │   └── preview.ts
    └── src/
        ├── App.svelte          # root layout
        ├── main.ts
        ├── lib/
        │   ├── pixi/
        │   │   └── renderer.ts # PixiJS depth bar renderer
        │   └── stores/
        │       └── orderbook.ts # WebSocket + reactive state
        └── components/
            ├── DepthChart.svelte       + .stories.ts
            ├── StatusBar.svelte        + .stories.ts
            ├── TradeTicker.svelte      + .stories.ts
            └── PriceHeader.svelte      + .stories.ts
```
