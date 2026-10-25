// Level editor. Draws polygons and places objects straight into the same
// Level structure the physics runs on, so testing is instant.

import { Level } from './level.js';
import { OBJ, GRAVITY_DIR, OBJECT_RADIUS } from './constants.js';

const GRAVITY_CYCLE = [undefined, GRAVITY_DIR.UP, GRAVITY_DIR.DOWN, GRAVITY_DIR.LEFT, GRAVITY_DIR.RIGHT];

export const TOOLS = {
  POLY: 'poly',
  EDIT: 'edit',
  START: OBJ.START,
  HIVE: OBJ.APPLE,
  WASPS: OBJ.KILLER,
  EXIT: OBJ.EXIT,
};

export class Editor {
  constructor(renderer) {
    this.renderer = renderer;
    this.level = null;
    this.tool = TOOLS.POLY;
    this.draft = null; // points of the polygon being drawn
    this.grass = false;
    this.snap = true;
    this.gridSize = 0.5;
    this.drag = null;
    this.panning = null;
    this.hover = null;
    this.mouse = { x: 0, y: 0 };
  }

  load(level) {
    this.level = level;
    this.renderer.horizonY = level.bounds.maxY * 0.55 + level.bounds.minY * 0.45;
    this.draft = null;
    this.drag = null;
  }

  snapped(p) {
    if (!this.snap) return p;
    const g = this.gridSize;
    return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
  }

  worldFromEvent(e) {
    const rect = this.renderer.canvas.getBoundingClientRect();
    return {
      x: this.renderer.wx(e.clientX - rect.left),
      y: this.renderer.wy(e.clientY - rect.top),
    };
  }

  // --- hit testing -------------------------------------------------------

  findVertex(p, radius) {
    for (let pi = 0; pi < this.level.polygons.length; pi++) {
      const pts = this.level.polygons[pi].points;
      for (let vi = 0; vi < pts.length; vi++) {
        if (Math.hypot(pts[vi].x - p.x, pts[vi].y - p.y) < radius) {
          return { polygon: pi, vertex: vi };
        }
      }
    }
    return null;
  }

  findObject(p) {
    for (let i = this.level.objects.length - 1; i >= 0; i--) {
      const o = this.level.objects[i];
      if (Math.hypot(o.x - p.x, o.y - p.y) < OBJECT_RADIUS * 1.2) return i;
    }
    return null;
  }

  // Closest point on any polygon edge, for inserting a vertex.
  findEdge(p, radius) {
    let best = null;
    for (let pi = 0; pi < this.level.polygons.length; pi++) {
      const pts = this.level.polygons[pi].points;
      for (let vi = 0; vi < pts.length; vi++) {
        const a = pts[vi];
        const b = pts[(vi + 1) % pts.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        if (l2 < 1e-9) continue;
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;
        const d = Math.hypot(cx - p.x, cy - p.y);
        if (d < radius && (!best || d < best.d)) {
          best = { polygon: pi, after: vi, point: { x: cx, y: cy }, d };
        }
      }
    }
    return best;
  }

  // --- input -------------------------------------------------------------

  onPointerDown(e) {
    const p = this.worldFromEvent(e);
    const pickRadius = 10 / this.renderer.scale;

    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      this.panning = { screen: { x: e.clientX, y: e.clientY }, cam: { ...this.renderer.cam } };
      return;
    }

    if (this.tool === TOOLS.POLY) {
      const sp = this.snapped(p);
      if (!this.draft) {
        this.draft = [sp];
      } else {
        const first = this.draft[0];
        if (this.draft.length > 2 && Math.hypot(first.x - sp.x, first.y - sp.y) < pickRadius * 1.5) {
          this.commitDraft();
        } else {
          this.draft.push(sp);
        }
      }
      return;
    }

    if (this.tool === TOOLS.EDIT) {
      const obj = this.findObject(p);
      if (obj !== null) {
        if (e.altKey) {
          const o = this.level.objects[obj];
          if (o.type === OBJ.APPLE) {
            const idx = GRAVITY_CYCLE.indexOf(o.gravity);
            const next = GRAVITY_CYCLE[(idx + 1) % GRAVITY_CYCLE.length];
            if (next === undefined) delete o.gravity;
            else o.gravity = next;
          }
          return;
        }
        this.drag = { kind: 'object', index: obj };
        return;
      }
      const vertex = this.findVertex(p, pickRadius);
      if (vertex) {
        this.drag = { kind: 'vertex', ...vertex };
        return;
      }
      const edge = this.findEdge(p, pickRadius);
      if (edge) {
        this.level.polygons[edge.polygon].points.splice(edge.after + 1, 0, edge.point);
        this.level.rebuild();
        this.drag = { kind: 'vertex', polygon: edge.polygon, vertex: edge.after + 1 };
      }
      return;
    }

    // Object tools
    const sp = this.snapped(p);
    if (this.tool === TOOLS.START) {
      const existing = this.level.objects.find((o) => o.type === OBJ.START);
      if (existing) { existing.x = sp.x; existing.y = sp.y; return; }
    }
    this.level.objects.push({ type: this.tool, x: sp.x, y: sp.y });
  }

  onPointerMove(e) {
    this.mouse = this.worldFromEvent(e);

    if (this.panning) {
      const dx = (e.clientX - this.panning.screen.x) / this.renderer.scale;
      const dy = (e.clientY - this.panning.screen.y) / this.renderer.scale;
      this.renderer.cam.x = this.panning.cam.x - dx;
      this.renderer.cam.y = this.panning.cam.y + dy;
      return;
    }

    if (!this.drag) {
      this.hover = this.findObject(this.mouse);
      return;
    }

    const sp = this.snapped(this.mouse);
    if (this.drag.kind === 'vertex') {
      const pt = this.level.polygons[this.drag.polygon].points[this.drag.vertex];
      pt.x = sp.x;
      pt.y = sp.y;
      this.level.rebuild();
    } else if (this.drag.kind === 'object') {
      const o = this.level.objects[this.drag.index];
      o.x = sp.x;
      o.y = sp.y;
    }
  }

  onPointerUp() {
    this.drag = null;
    this.panning = null;
  }

  onWheel(e) {
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    this.renderer.scale = Math.max(8, Math.min(220, this.renderer.scale * factor));
  }

  onKeyDown(e) {
    if (e.code === 'Enter' && this.draft && this.draft.length > 2) {
      this.commitDraft();
      return true;
    }
    if (e.code === 'Escape' && this.draft) {
      this.draft = null;
      return true;
    }
    if (e.code === 'Backspace' && this.draft && this.draft.length) {
      this.draft.pop();
      if (!this.draft.length) this.draft = null;
      return true;
    }
    if (e.code === 'Delete' || (e.code === 'Backspace' && !this.draft)) {
      const pickRadius = 10 / this.renderer.scale;
      const obj = this.findObject(this.mouse);
      if (obj !== null) {
        this.level.objects.splice(obj, 1);
        return true;
      }
      const vertex = this.findVertex(this.mouse, pickRadius);
      if (vertex) {
        const poly = this.level.polygons[vertex.polygon];
        if (poly.points.length <= 3) this.level.polygons.splice(vertex.polygon, 1);
        else poly.points.splice(vertex.vertex, 1);
        this.level.rebuild();
        return true;
      }
    }
    return false;
  }

  commitDraft() {
    if (this.draft && this.draft.length > 2) {
      this.level.polygons.push({ grass: this.grass, points: this.draft });
      this.level.rebuild();
    }
    this.draft = null;
  }

  // --- drawing -----------------------------------------------------------

  render(wallClock) {
    const r = this.renderer;
    r.setBiome(this.level.biome);
    r.clear();
    this.drawGrid();
    r.drawTerrain(this.level);
    r.drawObjects(this.level, wallClock);
    this.drawOverlay();
  }

  drawGrid() {
    const r = this.renderer;
    const ctx = r.ctx;
    const step = r.scale * this.gridSize >= 12 ? this.gridSize : this.gridSize * 10;
    const x0 = Math.floor(r.wx(0) / step) * step;
    const x1 = r.wx(r.w);
    const y0 = Math.floor(r.wy(r.h) / step) * step;
    const y1 = r.wy(0);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += step) {
      ctx.moveTo(r.sx(x), 0);
      ctx.lineTo(r.sx(x), r.h);
    }
    for (let y = y0; y <= y1; y += step) {
      ctx.moveTo(0, r.sy(y));
      ctx.lineTo(r.w, r.sy(y));
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(r.sx(0), 0); ctx.lineTo(r.sx(0), r.h);
    ctx.moveTo(0, r.sy(0)); ctx.lineTo(r.w, r.sy(0));
    ctx.stroke();
  }

  drawOverlay() {
    const r = this.renderer;
    const ctx = r.ctx;

    // Vertices
    ctx.fillStyle = '#ffd166';
    for (const poly of this.level.polygons) {
      for (const p of poly.points) {
        ctx.fillRect(r.sx(p.x) - 3, r.sy(p.y) - 3, 6, 6);
      }
    }

    // Draft polygon
    if (this.draft && this.draft.length) {
      ctx.strokeStyle = '#66ffcc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r.sx(this.draft[0].x), r.sy(this.draft[0].y));
      for (const p of this.draft.slice(1)) ctx.lineTo(r.sx(p.x), r.sy(p.y));
      const m = this.snapped(this.mouse);
      ctx.lineTo(r.sx(m.x), r.sy(m.y));
      ctx.stroke();
      ctx.fillStyle = '#66ffcc';
      for (const p of this.draft) ctx.fillRect(r.sx(p.x) - 3, r.sy(p.y) - 3, 6, 6);
    }

    // Start marker
    const startObj = this.level.objects.find((o) => o.type === OBJ.START);
    if (startObj) {
      ctx.strokeStyle = '#66ff88';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.sx(startObj.x), r.sy(startObj.y), 0.4 * r.scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r.sx(startObj.x) - 0.85 * r.scale, r.sy(startObj.y - 1.0));
      ctx.lineTo(r.sx(startObj.x) + 0.85 * r.scale, r.sy(startObj.y - 1.0));
      ctx.stroke();
    }

    // Cursor crosshair
    const m = this.snapped(this.mouse);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(r.sx(m.x) - 8, r.sy(m.y)); ctx.lineTo(r.sx(m.x) + 8, r.sy(m.y));
    ctx.moveTo(r.sx(m.x), r.sy(m.y) - 8); ctx.lineTo(r.sx(m.x), r.sy(m.y) + 8);
    ctx.stroke();
  }
}

export function emptyLevel(name = 'Ny bana') {
  return new Level({
    name,
    polygons: [
      { grass: false, points: [[0, 0], [40, 0], [40, 16], [0, 16]] },
    ],
    objects: [
      { type: OBJ.START, x: 4, y: 1.1 },
      { type: OBJ.APPLE, x: 20, y: 0.6 },
      { type: OBJ.EXIT, x: 36, y: 0.6 },
    ],
  });
}
