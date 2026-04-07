"""
WebSocket Connection Manager.

Manages a set of active WebSocket connections.
Broadcasts the order book snapshot to every connected client.

Design decisions:
  - Uses a set (not list) for O(1) add/remove
  - Dead connections are removed silently — no server crash
  - One broadcast loop serves all connections (not one loop per client)
"""
from __future__ import annotations
import asyncio
import json
import logging
from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    __slots__ = ("_connections",)

    def __init__(self) -> None:
        # Set for O(1) add/discard
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        log.info("Client connected  | total=%d", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        log.info("Client disconnected | total=%d", len(self._connections))

    async def broadcast(self, payload: dict) -> None:
        """
        Send snapshot to all connected clients.

        We serialise JSON once, then send the same string to everyone.
        Avoids re-serialising per client — important at high broadcast rates.

        Dead connections are culled silently without interrupting others.
        """
        if not self._connections:
            return

        message = json.dumps(payload)
        dead: set[WebSocket] = set()

        # asyncio.gather sends to all clients concurrently
        results = await asyncio.gather(
            *[ws.send_text(message) for ws in self._connections],
            return_exceptions=True,
        )

        for ws, result in zip(self._connections, results):
            if isinstance(result, Exception):
                dead.add(ws)

        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._connections)
