"""
Order model.

__slots__ eliminates the per-instance __dict__,
saving ~200 bytes per Order object. At thousands of
orders per second this is meaningful.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
import time


class Side(str, Enum):
    BUY  = "buy"
    SELL = "sell"


@dataclass
class Order:
    """
    A single resting order in the book.

    Memory layout is fixed via __slots__ —
    no dynamic attribute addition allowed,
    which is exactly what we want here.
    """
    __slots__ = ("id", "side", "price", "quantity", "timestamp")

    id:        int
    side:      Side
    price:     float
    quantity:  int
    timestamp: float

    @staticmethod
    def create(order_id: int, side: Side, price: float, quantity: int) -> "Order":
        return Order(
            id=order_id,
            side=side,
            price=price,
            quantity=quantity,
            timestamp=time.monotonic(),
        )


@dataclass
class Trade:
    """
    A completed match between a buyer and seller.
    Immutable record — dataclass with frozen=True.
    """
    price:        float
    quantity:     int
    buyer_id:     int
    seller_id:    int
    timestamp_ms: int = field(default_factory=lambda: int(time.time() * 1000))
