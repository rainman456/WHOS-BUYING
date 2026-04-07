<script lang="ts">
  /**
   * StatusBar.svelte
   *
   * Shows connection state and update latency.
   * Pure display component — reads from store, renders nothing else.
   */
  import { status, msSinceUpdate } from "../lib/stores/orderbook";

  const STATUS_LABEL: Record<string, string> = {
    connecting:   "Connecting...",
    connected:    "Live",
    disconnected: "Disconnected — reconnecting",
    error:        "Connection error",
  };
</script>

<div class="status-bar">
  <div class="left">
    <span class="indicator" data-status={$status} />
    <span class="label">{STATUS_LABEL[$status]}</span>
  </div>

  <div class="right">
    {#if $status === "connected"}
      <span class="latency">
        {$msSinceUpdate ?? "--"}ms
      </span>
    {/if}
    <span class="brand">Order Book · Stake Demo</span>
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 1rem;
    height: 36px;
    background: #0d1117;
    border-bottom: 1px solid #1e2530;
    font-family: monospace;
    font-size: 12px;
    color: #64748b;
    flex-shrink: 0;
  }

  .left, .right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4a5568;
    transition: background 0.3s;
  }

  .indicator[data-status="connected"]    { background: #00c896; box-shadow: 0 0 6px #00c896; }
  .indicator[data-status="connecting"]   { background: #f6e05e; animation: pulse 1s infinite; }
  .indicator[data-status="disconnected"] { background: #ff4d6d; }
  .indicator[data-status="error"]        { background: #ff4d6d; }

  .label    { color: #94a3b8; }
  .latency  { color: #00c896; }
  .brand    { color: #2d3748; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
</style>
