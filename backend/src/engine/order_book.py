"""
Order Book — the live state of all resting orders.

Data structure choice:
  Bids (buy side)  → max-heap  (we always want the HIGHEST buyer first)
  Asks (sell side) → min-heap  (we always want the LOWEST seller first)

Python's heapq is a min-heap only.
For the bid side we negate prices to simulate a max-heap.

Complexity:
  push  → O(log n)
  peek  → O(1)   — heap[0] is always the best
  pop   → O(log n)
"""
from __future__ import annotations
import heapq
from typing import NamedTuple
from .models import Order, Side


class PriceLevel(NamedTuple):
    """
    What the heap actually stores.
    NamedTuple is faster and lighter than a dataclass for heap entries.

    key      — the sort key  (negated price for bids, raw price for asks)
    order_id — tiebreaker: FIFO (lower id = earlier arrival)
    order    — the actual Order object
    """
    key:      float
    order_id: int
    order:    Order


class OrderBook:
    """
    Holds all resting (unmatched) orders.
    Separate heaps for each side.
    """
    __slots__ = ("_bids", "_asks", "_order_map")

    def __init__(self) -> None:
        self._bids: list[PriceLevel] = []   # max-heap via negated keys
        self._asks: list[PriceLevel] = []   # min-heap
        # Fast O(1) lookup: order_id → is it still active?
        # Orders can be partially filled; we track remaining quantity here
        self._order_map: dict[int, int] = {}

    # ──────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────

    def add(self, order: Order) -> None:
        """Insert a resting order into the correct side."""
        self._order_map[order.id] = order.quantity

        if order.side == Side.BUY:
            # Negate price → highest price becomes lowest key → max-heap
            heapq.heappush(self._bids, PriceLevel(-order.price, order.id, order))
        else:
            heapq.heappush(self._asks, PriceLevel(order.price, order.id, order))

    def best_bid(self) -> Order | None:
        """Peek at the highest resting buy order. O(1)."""
        self._drain_stale(self._bids)
        return self._bids[0].order if self._bids else None

    def best_ask(self) -> Order | None:
        """Peek at the lowest resting sell order. O(1)."""
        self._drain_stale(self._asks)
        return self._asks[0].order if self._asks else None

    def pop_best_bid(self) -> Order | None:
        """Remove and return the highest buy order. O(log n)."""
        self._drain_stale(self._bids)
        if not self._bids:
            return None
        entry = heapq.heappop(self._bids)
        self._order_map.pop(entry.order.id, None)
        return entry.order

    def pop_best_ask(self) -> Order | None:
        """Remove and return the lowest sell order. O(log n)."""
        self._drain_stale(self._asks)
        if not self._asks:
            return None
        entry = heapq.heappop(self._asks)
        self._order_map.pop(entry.order.id, None)
        return entry.order

    def reduce_quantity(self, order_id: int, by: int) -> None:
        """
        Partially fill an order.
        We use lazy deletion — we don't remove from the heap immediately
        (that would be O(n)). Instead we update the map and drain stale
        entries on next peek/pop.
        """
        if order_id in self._order_map:
            self._order_map[order_id] -= by
            if self._order_map[order_id] <= 0:
                del self._order_map[order_id]

    def snapshot(self, depth: int = 10) -> dict:
        """
        Return a serialisable snapshot of the top `depth` price levels
        on each side. Used by the WebSocket broadcaster.

        We must NOT mutate the heaps here — iterate a copy.
        """
        bids = self._aggregate(self._bids, negate=True,  depth=depth)
        asks = self._aggregate(self._asks, negate=False, depth=depth)
        return {"bids": bids, "asks": asks}

    # ──────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────

    def _drain_stale(self, heap: list[PriceLevel]) -> None:
        """
        Lazy deletion: remove heap entries whose order has been
        fully filled or cancelled (not in _order_map anymore).
        """
        while heap and heap[0].order.id not in self._order_map:
            heapq.heappop(heap)

    def _aggregate(
        self,
        heap: list[PriceLevel],
        negate: bool,
        depth: int,
    ) -> list[dict]:
        """
        Walk the heap (without modifying it) and bucket quantities
        by price level, returning the top `depth` levels.
        """
        levels: dict[float, int] = {}

        for entry in heap:
            # Skip stale entries
            remaining = self._order_map.get(entry.order.id)
            if remaining is None or remaining <= 0:
                continue

            price = entry.order.price
            levels[price] = levels.get(price, 0) + remaining

        # Sort: bids descending, asks ascending
        sorted_levels = sorted(levels.items(), reverse=negate)[:depth]

        return [
            {"price": round(price, 2), "quantity": qty}
            for price, qty in sorted_levels
        ]
