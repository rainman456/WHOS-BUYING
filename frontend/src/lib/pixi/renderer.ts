/**
 * PixiJS Order Book Renderer
 *
 * Renders animated bid/ask depth bars using WebGL via PixiJS.
 *
 * Performance decisions:
 *   - Object pooling: Graphics objects are created once, reused every frame
 *     (avoids GC pressure from creating/destroying objects at 60fps)
 *   - Lerping: bars animate toward target width smoothly
 *     (avoids jarring jumps on each data update)
 *   - Single Application instance: one WebGL context for the whole canvas
 *   - Draw calls batched by PixiJS automatically
 */
import * as PIXI from "pixi.js";
import type { OrderBookSnapshot, PriceLevel } from "../stores/orderbook";

// ── Constants ──────────────────────────────────────────────────────────────

const DEPTH          = 10;          // price levels shown per side
const BAR_HEIGHT     = 28;
const BAR_GAP        = 4;
const LABEL_WIDTH    = 80;
const MAX_BAR_WIDTH  = 340;
const LERP_SPEED     = 0.18;        // 0–1: higher = snappier, lower = smoother

const COLOR_BID      = 0x00c896;    // green
const COLOR_ASK      = 0xff4d6d;    // red
const COLOR_BID_GLOW = 0x00ffb9;    // flash on increase
const COLOR_ASK_GLOW = 0xff8fa3;
const COLOR_TEXT     = 0xe2e8f0;
const COLOR_DIM      = 0x4a5568;
const COLOR_SPREAD   = 0xf6e05e;    // yellow spread label
const BG_COLOR       = 0x0d1117;

// ── Types ──────────────────────────────────────────────────────────────────

interface BarSlot {
  bar:         PIXI.Graphics;
  priceText:   PIXI.Text;
  quantityText:PIXI.Text;
  currentWidth:number;
  targetWidth: number;
  prevQuantity:number;
  flashTimer:  number;           // counts down from 1 to 0 on change
  isBid:       boolean;
}

// ── Renderer class ─────────────────────────────────────────────────────────

export class OrderBookRenderer {
  private app:      PIXI.Application;
  private bidSlots: BarSlot[] = [];
  private askSlots: BarSlot[] = [];
  private spreadText: PIXI.Text;
  private maxQty = 1;
  private _ready = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.app = new PIXI.Application();
    this.spreadText = new PIXI.Text();
  }

  async init(): Promise<void> {
    await this.app.init({
      canvas:          this.canvas,
      background:      BG_COLOR,
      antialias:       true,
      resolution:      window.devicePixelRatio || 1,
      autoDensity:     true,
      width:           this.canvas.clientWidth,
      height:          this.canvas.clientHeight,
    });

    this._buildSlots();
    this._buildSpreadLabel();
    this._ready = true;

    // Hook into PixiJS ticker — runs every frame (~60fps)
    this.app.ticker.add(this._onTick.bind(this));
  }

  /** Called by the Svelte component when new data arrives from the store */
  update(snapshot: OrderBookSnapshot, maxQuantity: number): void {
    if (!this._ready) return;
    this.maxQty = maxQuantity;

    // Set target widths from new data
    this._updateSide(this.bidSlots, snapshot.bids, true);
    this._updateSide(this.askSlots, snapshot.asks, false);

    // Update spread label
    const bestBid = snapshot.bids[0]?.price ?? 0;
    const bestAsk = snapshot.asks[0]?.price ?? 0;
    const spread  = (bestAsk - bestBid).toFixed(2);
    this.spreadText.text = `spread  $${spread}`;
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
    this._repositionAll();
  }

  destroy(): void {
    this.app.destroy(false, { children: true });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _buildSlots(): void {
    // Build DEPTH slots for each side
    // Ask slots: rendered top of canvas, reversed (closest ask at bottom)
    for (let i = 0; i < DEPTH; i++) {
      this.askSlots.push(this._makeSlot(false, i));
      this.bidSlots.push(this._makeSlot(true,  i));
    }
  }

  private _makeSlot(isBid: boolean, index: number): BarSlot {
    const bar          = new PIXI.Graphics();
    const priceText    = new PIXI.Text({ text: "", style: { fontSize: 12, fill: COLOR_TEXT, fontFamily: "monospace" } });
    const quantityText = new PIXI.Text({ text: "", style: { fontSize: 11, fill: COLOR_DIM,  fontFamily: "monospace" } });

    this.app.stage.addChild(bar, priceText, quantityText);

    const slot: BarSlot = {
      bar,
      priceText,
      quantityText,
      currentWidth: 0,
      targetWidth:  0,
      prevQuantity: 0,
      flashTimer:   0,
      isBid,
    };

    this._positionSlot(slot, index);
    return slot;
  }

  private _buildSpreadLabel(): void {
    this.spreadText = new PIXI.Text({
      text: "spread --",
      style: { fontSize: 12, fill: COLOR_SPREAD, fontFamily: "monospace" },
    });
    this.app.stage.addChild(this.spreadText);
  }

  private _updateSide(
    slots: BarSlot[],
    levels: PriceLevel[],
    isBid: boolean,
  ): void {
    for (let i = 0; i < DEPTH; i++) {
      const slot  = slots[i];
      const level = levels[i];

      if (!level) {
        slot.targetWidth = 0;
        slot.priceText.text    = "";
        slot.quantityText.text = "";
        continue;
      }

      const newWidth = (level.quantity / this.maxQty) * MAX_BAR_WIDTH;
      slot.targetWidth = newWidth;

      // Detect quantity change → trigger flash
      if (level.quantity !== slot.prevQuantity && slot.prevQuantity !== 0) {
        slot.flashTimer = 1.0;
      }
      slot.prevQuantity = level.quantity;

      slot.priceText.text    = `$${level.price.toFixed(2)}`;
      slot.quantityText.text = `${level.quantity}`;
    }
  }

  /** PixiJS ticker callback — runs every frame */
  private _onTick(ticker: PIXI.Ticker): void {
    const dt = ticker.deltaTime / 60;   // normalise to seconds

    this._animateSide(this.askSlots, dt);
    this._animateSide(this.bidSlots, dt);
    this._positionSpreadLabel();
  }

  private _animateSide(slots: BarSlot[], dt: number): void {
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      // Lerp current width toward target
      slot.currentWidth += (slot.targetWidth - slot.currentWidth) * LERP_SPEED;

      // Decay flash timer
      if (slot.flashTimer > 0) {
        slot.flashTimer = Math.max(0, slot.flashTimer - dt * 3);
      }

      this._drawBar(slot, i);
    }
  }

  private _drawBar(slot: BarSlot, index: number): void {
    const { bar, isBid, currentWidth, flashTimer } = slot;

    // Interpolate between normal color and flash (glow) color
    const baseColor  = isBid ? COLOR_BID  : COLOR_ASK;
    const glowColor  = isBid ? COLOR_BID_GLOW : COLOR_ASK_GLOW;
    const color      = flashTimer > 0
      ? lerpColor(baseColor, glowColor, flashTimer)
      : baseColor;

    bar.clear();

    if (currentWidth < 1) return;

    // Draw from the right edge for asks (mirrored)
    const x = isBid
      ? LABEL_WIDTH
      : LABEL_WIDTH + MAX_BAR_WIDTH - currentWidth;

    bar.roundRect(x, 0, currentWidth, BAR_HEIGHT, 3);
    bar.fill({ color, alpha: 0.75 });
  }

  private _positionSlot(slot: BarSlot, index: number): void {
    // Positioned in _repositionAll
  }

  private _repositionAll(): void {
    const midY    = this.app.screen.height / 2;
    const rowStep = BAR_HEIGHT + BAR_GAP;

    // Asks above mid (reversed — closest ask nearest to mid)
    for (let i = 0; i < DEPTH; i++) {
      const slot = this.askSlots[i];
      const y    = midY - (i + 1) * rowStep;
      slot.bar.y          = y;
      slot.priceText.y    = y + 7;
      slot.priceText.x    = 4;
      slot.quantityText.y = y + 7;
      slot.quantityText.x = LABEL_WIDTH + MAX_BAR_WIDTH + 6;
    }

    // Bids below mid
    for (let i = 0; i < DEPTH; i++) {
      const slot = this.bidSlots[i];
      const y    = midY + 26 + i * rowStep;  // 26 = spread label height
      slot.bar.y          = y;
      slot.priceText.y    = y + 7;
      slot.priceText.x    = 4;
      slot.quantityText.y = y + 7;
      slot.quantityText.x = LABEL_WIDTH + MAX_BAR_WIDTH + 6;
    }
  }

  private _positionSpreadLabel(): void {
    const midY = this.app.screen.height / 2;
    this.spreadText.x = 4;
    this.spreadText.y = midY + 4;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Linear interpolation between two hex colors.
 * Used for the flash effect when quantity changes.
 */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r  = Math.round(ar + (br - ar) * t);
  const g  = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bv;
}
