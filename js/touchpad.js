// On-screen controls for touch devices.
//
// Pointers are tracked globally rather than per button. Capturing each
// pointer on the button it started on is the obvious approach and it feels
// broken: slide your thumb from gas to brake and nothing happens, because
// the gas button still owns the pointer. Here a pointer presses whatever
// button it is currently over, so sliding between them works — with a slop
// margin so a thumb that drifts a few pixels off the edge keeps holding.

const SLOP = 22; // px of tolerance around a button before it releases

export class Touchpad {
  /**
   * @param {object} handlers
   * @param {(code: string) => void} handlers.onPress    hold button pressed
   * @param {(code: string) => void} handlers.onRelease  hold button released
   * @param {(action: string) => void} handlers.onAction one-shot button tapped
   * @param {(e: PointerEvent) => void} [handlers.onTapAway] tap that missed every button
   * @param {() => boolean} handlers.isActive            whether input applies now
   */
  constructor({ onPress, onRelease, onAction, onTapAway, isActive }) {
    this.onPress = onPress;
    this.onRelease = onRelease;
    this.onAction = onAction;
    this.onTapAway = onTapAway;
    this.isActive = isActive;
    this.held = new Map(); // pointerId -> button element
    this.buttons = [];
  }

  attach(root = document) {
    this.buttons = [...root.querySelectorAll('.tbtn')];
    const opts = { passive: false };
    window.addEventListener('pointerdown', (e) => this.down(e), opts);
    window.addEventListener('pointermove', (e) => this.move(e), opts);
    window.addEventListener('pointerup', (e) => this.up(e), opts);
    window.addEventListener('pointercancel', (e) => this.up(e), opts);
    // Resting a thumb on a button makes iOS raise its text-selection loupe
    // and Android its context menu, right under the finger. Both gestures are
    // driven by the touch events, not the pointer ones, and WebKit ignores a
    // preventDefault on pointerdown — so the touch itself has to be cancelled.
    // Any visible button counts, even when input does not apply: a magnifier
    // over a dead button is just as wrong.
    window.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (this.hit(t.clientX, t.clientY, 0)) { e.preventDefault(); return; }
      }
    }, opts);
    window.addEventListener('contextmenu', (e) => {
      if (e.target instanceof Element && e.target.closest('.tbtn')) e.preventDefault();
    });
    // A tab switch mid-press would otherwise leave the throttle open.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    window.addEventListener('blur', () => this.releaseAll());
  }

  // Nearest button under the point, allowing `slop` pixels of overshoot.
  hit(x, y, slop) {
    let best = null;
    let bestDistance = Infinity;
    for (const btn of this.buttons) {
      if (!btn.offsetParent) continue; // hidden
      const r = btn.getBoundingClientRect();
      const dx = Math.max(r.left - x, 0, x - r.right);
      const dy = Math.max(r.top - y, 0, y - r.bottom);
      const distance = Math.hypot(dx, dy);
      if (distance <= slop && distance < bestDistance) {
        bestDistance = distance;
        best = btn;
      }
    }
    return best;
  }

  press(btn) {
    btn.classList.add('pressed');
    if (btn.dataset.code) this.onPress(btn.dataset.code);
    else if (btn.dataset.action) this.onAction(btn.dataset.action);
  }

  release(btn) {
    btn.classList.remove('pressed');
    if (btn.dataset.code) this.onRelease(btn.dataset.code);
  }

  // A code may be held by more than one finger; only release on the last.
  stillHeldElsewhere(btn, exceptPointerId) {
    for (const [id, other] of this.held) {
      if (id !== exceptPointerId && other === btn) return true;
    }
    return false;
  }

  setHeld(pointerId, btn) {
    const previous = this.held.get(pointerId) || null;
    if (previous === btn) return;
    if (previous) {
      this.held.delete(pointerId);
      if (!this.stillHeldElsewhere(previous, pointerId)) this.release(previous);
    }
    if (btn) {
      this.held.set(pointerId, btn);
      this.press(btn);
    } else {
      this.held.delete(pointerId);
    }
  }

  down(e) {
    if (!this.isActive()) return;
    const btn = this.hit(e.clientX, e.clientY, 0);
    if (!btn) {
      if (this.onTapAway) this.onTapAway(e);
      return;
    }
    e.preventDefault();
    this.claimed ??= new Set();
    this.claimed.add(e.pointerId);
    this.setHeld(e.pointerId, btn);
  }

  move(e) {
    if (!this.claimed || !this.claimed.has(e.pointerId)) return;
    e.preventDefault();
    // Action buttons do not re-fire when a finger slides back onto them.
    const btn = this.hit(e.clientX, e.clientY, SLOP);
    this.setHeld(e.pointerId, btn && btn.dataset.code ? btn : null);
  }

  up(e) {
    if (!this.claimed || !this.claimed.has(e.pointerId)) return;
    e.preventDefault();
    this.claimed.delete(e.pointerId);
    this.setHeld(e.pointerId, null);
  }

  releaseAll() {
    for (const [id] of [...this.held]) this.setHeld(id, null);
    if (this.claimed) this.claimed.clear();
  }
}
