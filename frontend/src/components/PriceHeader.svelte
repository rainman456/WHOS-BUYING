<script lang="ts">
  /**
   * PriceHeader.svelte
   *
   * The top bar showing the key numbers a trader looks at first:
   *   - Last trade price (the market price)
   *   - Best bid / best ask
   *   - Spread
   *
   * Uses a simple price direction tracker to colour
   * the last price green (up) or red (down).
   */
  import { snapshot } from "../lib/stores/orderbook";

  let prevPrice: number | null = null;
  let direction: "up" | "down" | "flat" = "flat";

  $: lastPrice = $snapshot?.last_trade?.price ?? null;

  $: if (lastPrice !== null && prevPrice !== null) {
    direction = lastPrice > prevPrice ? "up" : lastPrice < prevPrice ? "down" : "flat";
    prevPrice = lastPrice;
  } else if (lastPrice !== null && prevPrice === null) {
    prevPrice = lastPrice;
  }

  $: bestBid = $snapshot?.bids[0]?.price ?? null;
  $: bestAsk = $snapshot?.asks[0]?.price ?? null;
  $: spread  = bestBid && bestAsk ? (bestAsk - bestBid).toFixed(2) : "--";
</script>

<div class="header">
  <div class="symbol">
    <span class="ticker-name">DEMO</span>
    <span class="subtitle">Simulated · FIFO Matching</span>
  </div>

  <div class="price-block">
    <span class="last-price" data-dir={direction}>
      {lastPrice != null ? `$${lastPrice.toFixed(2)}` : "--"}
    </span>
    <span class="dir-arrow">
      {direction === "up" ? "▲" : direction === "down" ? "▼" : ""}
    </span>
  </div>

  <div class="metrics">
    <div class="metric">
      <span class="metric-label">Bid</span>
      <span class="metric-value bid">{bestBid != null ? `$${bestBid.toFixed(2)}` : "--"}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Ask</span>
      <span class="metric-value ask">{bestAsk != null ? `$${bestAsk.toFixed(2)}` : "--"}</span>
    </div>
    <div class="metric">
      <span class="metric-label">Spread</span>
      <span class="metric-value">${spread}</span>
    </div>
  </div>
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 0.75rem 1.25rem;
    background: #0d1117;
    border-bottom: 1px solid #1e2530;
    flex-shrink: 0;
  }

  .symbol {
    display: flex;
    flex-direction: column;
  }

  .ticker-name {
    font-family: monospace;
    font-size: 18px;
    font-weight: 700;
    color: #e2e8f0;
    letter-spacing: 0.05em;
  }

  .subtitle {
    font-size: 10px;
    color: #2d3748;
    font-family: monospace;
  }

  .price-block {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }

  .last-price {
    font-family: monospace;
    font-size: 28px;
    font-weight: 700;
    color: #e2e8f0;
    transition: color 0.2s;
  }

  .last-price[data-dir="up"]   { color: #00c896; }
  .last-price[data-dir="down"] { color: #ff4d6d; }

  .dir-arrow {
    font-size: 14px;
    color: #64748b;
  }

  .metrics {
    display: flex;
    gap: 1.5rem;
    margin-left: auto;
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .metric-label {
    font-size: 10px;
    color: #2d3748;
    font-family: monospace;
    text-transform: uppercase;
  }

  .metric-value {
    font-size: 13px;
    font-family: monospace;
    color: #94a3b8;
  }

  .metric-value.bid { color: #00c896; }
  .metric-value.ask { color: #ff4d6d; }
</style>
