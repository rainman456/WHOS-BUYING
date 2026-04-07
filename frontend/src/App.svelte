<script lang="ts">
  /**
   * App.svelte — root component
   *
   * Layout:
   *   ┌─────────────────────────────────┐
   *   │ StatusBar                       │
   *   ├─────────────────────────────────┤
   *   │ PriceHeader                     │
   *   ├────────────────────┬────────────┤
   *   │ DepthChart (PixiJS)│TradeTicker │
   *   └────────────────────┴────────────┘
   *
   * WebSocket connection is initiated here — once — on mount.
   */
  import { onMount, onDestroy } from "svelte";
  import { connect, disconnect } from "./lib/stores/orderbook";

  import StatusBar    from "./components/StatusBar.svelte";
  import PriceHeader  from "./components/PriceHeader.svelte";
  import DepthChart   from "./components/DepthChart.svelte";
  import TradeTicker  from "./components/TradeTicker.svelte";

  onMount(() => connect());
  onDestroy(() => disconnect());
</script>

<div class="app">
  <StatusBar />
  <PriceHeader />

  <div class="body">
    <div class="chart-area">
      <DepthChart />
    </div>
    <TradeTicker />
  </div>
</div>

<style>
  :global(*, *::before, *::after) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    background: #0d1117;
    color: #e2e8f0;
    overflow: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: #0d1117;
  }

  .body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .chart-area {
    flex: 1;
    position: relative;
    overflow: hidden;
  }
</style>
