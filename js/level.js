// Level geometry: polygons -> line segments -> a spatial grid for collision
// queries. Mirrors src/level/segments.cpp in spirit: the original also buckets
// segments into a collision grid and only tests the cell the circle sits in.

import { OBJ } from './constants.js';
import { DEFAULT_BIOME, biomeOf } from './biomes.js';

const CELL_SIZE = 2.0; // metres

export class Level {
  constructor(data) {
    this.name = data.name || 'Namnlös';
    // Which world this belongs to. The chooser groups by it and the renderer
    // paints by it; the simulation does not care.
    // A level may stand in more than one world; the one being played is
    // always its home, since that is the only one the palette can follow.
    this.biome = biomeOf(data);
    // How much bite the wheels get on the ground. 1 is normal, and is what
    // every level written before ice existed gets. Less than 1 is an icy
    // level: see simulateBikePhysics, which is the only place it is read.
    this.grip = data.grip === undefined ? 1 : data.grip;
    // Which machines this level may be ridden on. Most levels say nothing
    // and mean "any of them"; a level built around the car's air jet names
    // the car, because it cannot be done without one and the chooser
    // should not offer a machine that cannot finish it.
    this.vehicles = data.vehicles || null;
    // Which world's colours to paint it in. Defaults to the world it is
    // filed under, and differs only while a level is parked somewhere it
    // does not belong: a snow level sitting in Beta should already look
    // like snow, so that moving it later changes nothing a player sees.
    this.theme = data.theme || this.biome;
    // { grass: bool, points: [{x, y}, ...] }
    this.polygons = (data.polygons || []).map((p) => ({
      grass: !!p.grass,
      points: p.points.map((pt) =>
        Array.isArray(pt) ? { x: pt[0], y: pt[1] } : { x: pt.x, y: pt.y }
      ),
    }));
    // { type, x, y, gravity }
    this.objects = (data.objects || []).map((o) => ({ ...o }));
    this.rebuild();
  }

  rebuild() {
    this.segments = [];
    for (const poly of this.polygons) {
      if (poly.grass) continue; // grass polygons are decoration only
      const n = poly.points.length;
      if (n < 2) continue;
      for (let i = 0; i < n; i++) {
        const a = poly.points[i];
        const b = poly.points[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 1e-9) continue;
        this.segments.push({
          r: { x: a.x, y: a.y },
          unit: { x: dx / length, y: dy / length },
          length,
        });
      }
    }
    this.buildGrid();
    this.computeBounds();
  }

  buildGrid() {
    this.grid = new Map();
    // A segment is registered in every cell its (padded) bounding box covers.
    // The pad covers the largest collider radius so a circle centred in a cell
    // can never miss a segment it overlaps.
    const pad = 0.5;
    for (const seg of this.segments) {
      const x0 = seg.r.x;
      const y0 = seg.r.y;
      const x1 = seg.r.x + seg.unit.x * seg.length;
      const y1 = seg.r.y + seg.unit.y * seg.length;
      const minX = Math.floor((Math.min(x0, x1) - pad) / CELL_SIZE);
      const maxX = Math.floor((Math.max(x0, x1) + pad) / CELL_SIZE);
      const minY = Math.floor((Math.min(y0, y1) - pad) / CELL_SIZE);
      const maxY = Math.floor((Math.max(y0, y1) + pad) / CELL_SIZE);
      for (let cx = minX; cx <= maxX; cx++) {
        for (let cy = minY; cy <= maxY; cy++) {
          const key = cx + ',' + cy;
          let list = this.grid.get(key);
          if (!list) this.grid.set(key, (list = []));
          list.push(seg);
        }
      }
    }
  }

  computeBounds() {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const poly of this.polygons) {
      for (const p of poly.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
    if (!isFinite(minX)) {
      minX = minY = 0;
      maxX = maxY = 10;
    }
    this.bounds = { minX, minY, maxX, maxY };
  }

  segmentsNear(r) {
    const key =
      Math.floor(r.x / CELL_SIZE) + ',' + Math.floor(r.y / CELL_SIZE);
    return this.grid.get(key) || EMPTY;
  }

  get start() {
    return this.objects.find((o) => o.type === OBJ.START) || { x: 0, y: 0 };
  }

  get totalApples() {
    return this.objects.filter((o) => o.type === OBJ.APPLE).length;
  }

  toJSON() {
    return {
      name: this.name,
      ...(this.biome !== DEFAULT_BIOME ? { biome: this.biome } : {}),
      ...(this.grip !== 1 ? { grip: this.grip } : {}),
      ...(this.vehicles ? { vehicles: [...this.vehicles] } : {}),
      ...(this.theme !== this.biome ? { theme: this.theme } : {}),
      polygons: this.polygons.map((p) => ({
        grass: p.grass,
        points: p.points.map((pt) => [round(pt.x), round(pt.y)]),
      })),
      objects: this.objects.map((o) => ({
        type: o.type,
        x: round(o.x),
        y: round(o.y),
        ...(o.gravity !== undefined ? { gravity: o.gravity } : {}),
      })),
    };
  }
}

const EMPTY = [];
const round = (n) => Math.round(n * 1000) / 1000;

