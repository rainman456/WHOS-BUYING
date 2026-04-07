/**
 * Order Book Store
 *
 * Single source of truth for all order book data.
 * Manages the WebSocket connection lifecycle.
 * PixiJS reads from this store on each frame.
 *
 * Svelte stores are reactive by design —
 * any component that subscribes auto-updates when data changes.
 */
import { writable, derived, get } from "svelte/store";

// ── Types ──────────────────────────────────────────────────────────────────

export interface PriceLevel {
  price: number;
  quantity: number;
}

export interface TradeEvent {
  price: number;
  quantity: number;
  ts: number;
}

export interface OrderBookSnapshot {
  bids: PriceLevel[];
  asks: PriceLevel[];
  last_trade: TradeEvent | null;
  trades: TradeEvent[];
}

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

// ── Internal writable stores ───────────────────────────────────────────────

const _snapshot   = writable<OrderBookSnapshot | null>(null);
const _status     = writable<ConnectionStatus>("disconnected");
const _lastUpdate = writable<number>(0);

// ── Public readable stores (derived) ──────────────────────────────────────

/** Current full snapshot — PixiJS renderer subscribes to this */
export const snapshot = { subscribe: _snapshot.subscribe };

/** WebSocket connection status — shown in the UI header */
export const status = { subscribe: _status.subscribe };

/** Milliseconds since last server update — for latency display */
export const msSinceUpdate = derived(
  _lastUpdate,
  ($ts) => ($ts === 0 ? null : Date.now() - $ts)
);

// ── Max quantity across all levels — used to normalise bar widths ──────────
export const maxQuantity = derived(_snapshot, ($snap) => {
  if (!$snap) return 1;
  const all = [...$snap.bids, ...$snap.asks].map((l) => l.quantity);
  return Math.max(...all, 1);
});

// ── WebSocket management ───────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connect(url: string = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`): void {
  if (socket?.readyState === WebSocket.OPEN) return;

  _status.set("connecting");
  socket = new WebSocket(url);

  socket.onopen = () => {
    _status.set("connected");
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  socket.onmessage = (event: MessageEvent) => {
    const data: OrderBookSnapshot = JSON.parse(event.data);
    _snapshot.set(data);
    _lastUpdate.set(Date.now());
  };

  socket.onerror = () => {
    _status.set("error");
  };

  socket.onclose = () => {
    _status.set("disconnected");
    socket = null;
    // Auto-reconnect after 2s
    reconnectTimer = setTimeout(() => connect(url), 2000);
  };
}

export function disconnect(): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
  _status.set("disconnected");
}
