<script lang="ts">
  /**
   * DepthChart.svelte
   *
   * The bridge between:
   *   - Svelte's reactive store (data layer)
   *   - PixiJS renderer        (visual layer)
   *
   * Svelte owns the canvas element lifecycle.
   * PixiJS owns everything drawn inside it.
   * They communicate via the `update()` call below — clean separation.
   */
  import { onMount, onDestroy } from "svelte";
  import { OrderBookRenderer } from "../lib/pixi/renderer";
  import { snapshot, maxQuantity } from "../lib/stores/orderbook";

  let canvas: HTMLCanvasElement;
  let renderer: OrderBookRenderer;

  onMount(async () => {
    renderer = new OrderBookRenderer(canvas);
    await renderer.init();

    // Resize handler — keeps PixiJS canvas in sync with container
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      renderer.resize(width, height);
    });
    ro.observe(canvas.parentElement!);

    // Subscribe to store — feed new data to PixiJS every time it arrives
    const unsubSnap = snapshot.subscribe((snap) => {
      if (snap && renderer) {
        renderer.update(snap, $maxQuantity);
      }
    });

    return () => {
      unsubSnap();
      ro.disconnect();
    };
  });

  onDestroy(() => {
    renderer?.destroy();
  });

  // Reactive: whenever maxQuantity changes, re-feed the latest snapshot
  $: if (renderer && $snapshot) {
    renderer.update($snapshot, $maxQuantity);
  }
</script>

<canvas bind:this={canvas} class="depth-canvas" />

<style>
  .depth-canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
