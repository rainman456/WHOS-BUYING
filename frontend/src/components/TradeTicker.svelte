<script lang="ts">
  /**
   * TradeTicker.svelte
   *
   * Scrolling feed of recent matched trades.
   * Each new trade flashes in from the top.
   *
   * Performance: capped at 30 items — no unbounded list growth.
   */
  import { snapshot } from "../lib/stores/orderbook";
  import type { TradeEvent } from "../lib/stores/orderbook";

  const MAX_DISPLAY = 30;

  // TradeEvent extended with a stable unique key for Svelte's keyed #each loop
  type DisplayTrade = TradeEvent & { _key: string };
  let displayed: DisplayTrade[] = [];
  let prevCount = 0;

  // When snapshot updates, prepend any new trades
  $: if ($snapshot?.trades) {
    const incoming = $snapshot.trades;
    if (incoming.length !== prevCount || incoming.length > 0) {
      // Create stable keys. Trades might share the exact same millisecond timestamp.
      // By mapping against the chronological array first, each trade gets a deterministic count suffix.
      const counts = new Map<number, number>();
      const mapped = incoming.map(trade => {
        const count = (counts.get(trade.ts) || 0) + 1;
        counts.set(trade.ts, count);
        return { ...trade, _key: `${trade.ts}-${count}` };
      });
      
      displayed = mapped.reverse().slice(0, MAX_DISPLAY);
      prevCount = incoming.length;
    }
  }

  function formatTime(ts: number): string {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

<div class="ticker">
  <div class="header">
    <span>Recent Trades</span>
    <span class="count">{displayed.length}</span>
  </div>

  <div class="col-labels">
    <span>Time</span>
    <span>Price</span>
    <span>Qty</span>
  </div>

  <div class="rows">
    {#each displayed as trade (trade._key)}
      <div class="row" class:buy={trade.price > 0}>
        <span class="time">{formatTime(trade.ts)}</span>
        <span class="price">${trade.price.toFixed(2)}</span>
        <span class="qty">{trade.quantity}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .ticker {
    width: 220px;
    background: #0d1117;
    border-left: 1px solid #1e2530;
    display: flex;
    flex-direction: column;
    font-family: monospace;
    font-size: 11px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #1e2530;
    color: #64748b;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .count {
    background: #1e2530;
    padding: 1px 6px;
    border-radius: 9999px;
    color: #94a3b8;
  }

  .col-labels {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.3rem 0.75rem;
    color: #2d3748;
    border-bottom: 1px solid #1e2530;
  }

  .rows {
    overflow-y: auto;
    flex: 1;
  }

  /* hide scrollbar but keep functionality */
  .rows::-webkit-scrollbar { width: 0; }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    padding: 0.25rem 0.75rem;
    border-bottom: 1px solid #0d1117;
    animation: fadeIn 0.3s ease;
    color: #64748b;
  }

  .row:hover { background: #111827; }

  .price { color: #00c896; }
  .time  { color: #2d3748; }
  .qty   { color: #94a3b8; text-align: right; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
</style>
