"""
Tick Simulator — generates synthetic market activity.

Uses a random walk model for the mid price
(same model used in basic quantitative finance —
 each tick, price moves up or down by a small random amount).

Generates a realistic mix of:
  - Limit orders (patient — rest in the book)
  - Market orders (aggressive — cross the spread to match immediately)
"""
from __future__ import annotations
import asyncio
import random
from .matching_engine import MatchingEngine
from .models import Side


class TickSimulator:
    __slots__ = (
        "engine",
        "_mid_price",
        "_tick_interval",
        "_running",
        "_spread",
        "_volatility",
    )

    def __init__(
        self,
        engine: MatchingEngine,
        start_price: float = 150.0,
        tick_interval: float = 0.08,   # 80ms between ticks ~12 orders/sec
    ) -> None:
        self.engine = engine
        self._mid_price = start_price
        self._tick_interval = tick_interval
        self._running = False
        self._spread = 0.50       # $0.50 between best bid and ask
        self._volatility = 0.10   # max price drift per tick

    async def run(self) -> None:
        """
        Main simulation loop.
        Runs as an asyncio task — yields control between ticks
        so the WebSocket broadcaster can run concurrently.
        """
        self._running = True
        self._seed_book()

        while self._running:
            self._tick()
            await asyncio.sleep(self._tick_interval)

    def stop(self) -> None:
        self._running = False

    # ──────────────────────────────────────────────
    # Internal
    # ──────────────────────────────────────────────

    def _seed_book(self) -> None:
        """
        Pre-populate the book with resting orders at multiple
        price levels so the depth chart looks full from the start.
        """
        for i in range(1, 11):
            # Bids: below mid price, stepping down
            bid_price = round(self._mid_price - (i * self._spread), 2)
            bid_qty   = random.randint(50, 400)
            self.engine.submit(Side.BUY, bid_price, bid_qty)

            # Asks: above mid price, stepping up
            ask_price = round(self._mid_price + (i * self._spread), 2)
            ask_qty   = random.randint(50, 400)
            self.engine.submit(Side.SELL, ask_price, ask_qty)

    def _tick(self) -> None:
        """
        One market tick:
          1. Drift the mid price slightly (random walk)
          2. Submit 1–3 random orders
        """
        # Random walk: price drifts up or down
        drift = random.uniform(-self._volatility, self._volatility)
        self._mid_price = round(self._mid_price + drift, 2)
        self._mid_price = max(100.0, self._mid_price)   # price floor

        # Generate 1–3 orders per tick
        for _ in range(random.randint(1, 3)):
            self._submit_random_order()

    def _submit_random_order(self) -> None:
        """
        Generate one order with realistic characteristics.

        80% limit orders  — placed near the mid, rest in book
        20% market orders — aggressive, cross the spread, cause trades
        """
        is_buy  = random.random() < 0.5
        side    = Side.BUY if is_buy else Side.SELL
        qty     = random.randint(10, 200)

        if random.random() < 0.80:
            # Limit order — placed within 5 spread-widths of mid
            offset = random.uniform(0.5, 5.0) * self._spread
            if is_buy:
                price = round(self._mid_price - offset, 2)
            else:
                price = round(self._mid_price + offset, 2)
        else:
            # Market order — aggressively cross the spread to guarantee a match
            if is_buy:
                # Buy at above mid → will hit resting asks
                price = round(self._mid_price + self._spread * 2, 2)
            else:
                # Sell below mid → will hit resting bids
                price = round(self._mid_price - self._spread * 2, 2)

        self.engine.submit(side, price, qty)
