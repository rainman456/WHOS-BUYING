"""
FastAPI entry point.

Architecture:
  - Single MatchingEngine instance (shared state)
  - Single ConnectionManager instance
  - Two background tasks:
      1. TickSimulator  — generates orders
      2. Broadcaster    — pushes snapshots to WebSocket clients
  - lifespan context manager handles clean startup/shutdown
"""
from __future__ import annotations
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .engine import MatchingEngine, TickSimulator
from .ws import ConnectionManager

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
log = logging.getLogger(__name__)

# ── Shared singletons ──────────────────────────────────────────────────────
engine    = MatchingEngine()
simulator = TickSimulator(engine, start_price=150.0, tick_interval=0.08)
manager   = ConnectionManager()


# ── Background broadcaster ─────────────────────────────────────────────────
async def broadcaster(interval: float = 0.1) -> None:
    """
    Broadcast loop: every `interval` seconds, snapshot the engine
    and push to all connected WebSocket clients.

    100ms interval = 10 updates/second
    Decoupled from the simulator so each runs at its own rate.
    """
    while True:
        if manager.count > 0:
            snapshot = engine.snapshot()
            await manager.broadcast(snapshot)
        await asyncio.sleep(interval)


# ── Lifespan ───────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Start background tasks on app startup.
    Cancel them cleanly on shutdown.
    asyncio tasks — no threads, no subprocesses.
    """
    sim_task   = asyncio.create_task(simulator.run())
    bcast_task = asyncio.create_task(broadcaster())
    log.info("Simulator and broadcaster started")

    yield  # app runs here

    sim_task.cancel()
    bcast_task.cancel()
    await asyncio.gather(sim_task, bcast_task, return_exceptions=True)
    log.info("Background tasks stopped")


# ── App ────────────────────────────────────────────────────────────────────
app = FastAPI(title="Order Book API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "clients": manager.count}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        # Keep the connection open — listen for client messages
        # (e.g. future filter commands like "watch AAPL only")
        while True:
            data = await ws.receive_text()
            log.debug("Message from client: %s", data)
    except WebSocketDisconnect:
        manager.disconnect(ws)
