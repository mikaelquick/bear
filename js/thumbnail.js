// A small picture of a level, for the chooser.
//
// Not a shrunken screenshot: the game renderer carries a camera, a bike and
// a parallax sky, none of which belong in a 200px tile. This draws the one
// thing a picture has to say — the shape of the cave, and where the hives,
// the wasps and the pot sit in it — so you can tell two levels apart before
// reading either name.
//
// Levels are holes cut out of solid rock, so the fill is the same trick the
// renderer uses: paint the whole tile, then subtract the polygons with the
// even-odd rule.
//
// This reads raw level data rather than a loaded Level, on purpose: a Level
// builds a collision grid, and the chooser has no use for twenty of those
// every time it redraws.

import { OBJ } from './constants.js';
import { PALETTE } from './render.js';

const WIDTH = 240;
const HEIGHT = 135; // 16:9, the shape of the screen the level is played on
const PAD = 7;      // px of tile left around the level's bounding box

// One canvas, reused: twenty tiles kept as live canvases is megabytes of
// backing store for pictures that never change. These become data URLs.
let scratch = null;

const cache = new Map();

function scratchContext() {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = WIDTH * 2;
    scratch.height = HEIGHT * 2;
  }
  const ctx = scratch.getContext('2d');
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  return ctx;
}

// Fit the level's bounding box into the tile without distorting it: a tall
// level should look tall, not stretched to fill a wide frame.
function projection(bounds) {
  const levelW = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const levelH = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const scale = Math.min((WIDTH - PAD * 2) / levelW, (HEIGHT - PAD * 2) / levelH);
  const offsetX = (WIDTH - levelW * scale) / 2;
  const offsetY = (HEIGHT - levelH * scale) / 2;
  return {
    scale,
    // y grows upwards in the world and downwards on a canvas.
    x: (wx) => (wx - bounds.minX) * scale + offsetX,
    y: (wy) => (bounds.maxY - wy) * scale + offsetY,
  };
}

// Level files write points either way round, and Level normalises them for
// the game. Here we are upstream of that.
const point = (pt) => (Array.isArray(pt) ? { x: pt[0], y: pt[1] } : pt);

function boundsOf(polygons) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygons) {
    for (const raw of poly.points) {
      const pt = point(raw);
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  return { minX, minY, maxX, maxY };
}

function tracePolygon(ctx, poly, p) {
  const pts = poly.points;
  if (pts.length < 2) return;
  const first = point(pts[0]);
  ctx.moveTo(p.x(first.x), p.y(first.y));
  for (let i = 1; i < pts.length; i++) {
    const pt = point(pts[i]);
    ctx.lineTo(p.x(pt.x), p.y(pt.y));
  }
  ctx.closePath();
}

function dot(ctx, p, obj, radius, fill, ring) {
  const x = p.x(obj.x);
  const y = p.y(obj.y);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (!ring) return;
  ctx.lineWidth = 1;
  ctx.strokeStyle = ring;
  ctx.stroke();
}

/**
 * @param {object} data raw level data: polygons and objects
 * @returns {string} a data URL, ready for an <img>
 */
export function levelThumbnail(data) {
  const level = { polygons: data.polygons || [], objects: data.objects || [] };
  const ctx = scratchContext();
  const p = projection(boundsOf(level.polygons));

  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, PALETTE.skyTop);
  sky.addColorStop(1, PALETTE.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // The rock: everything outside the polygons.
  const rock = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  rock.addColorStop(0, PALETTE.groundLight);
  rock.addColorStop(1, PALETTE.ground);
  ctx.beginPath();
  ctx.rect(0, 0, WIDTH, HEIGHT);
  for (const poly of level.polygons) {
    if (poly.grass) continue;
    tracePolygon(ctx, poly, p);
  }
  ctx.fillStyle = rock;
  ctx.fill('evenodd');

  // A lit rim, which is what makes the cave read as a shape rather than a
  // stain at this size.
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.edge;
  ctx.beginPath();
  for (const poly of level.polygons) {
    if (poly.grass) continue;
    tracePolygon(ctx, poly, p);
  }
  ctx.stroke();

  // Objects last, over the rock, biggest first so nothing important hides.
  for (const obj of level.objects) {
    if (obj.type === OBJ.KILLER) dot(ctx, p, obj, 2.6, PALETTE.wasp, PALETTE.waspDark);
  }
  for (const obj of level.objects) {
    if (obj.type === OBJ.APPLE) dot(ctx, p, obj, 2.6, PALETTE.honey, PALETTE.honeyDark);
  }
  for (const obj of level.objects) {
    if (obj.type === OBJ.EXIT) dot(ctx, p, obj, 4, PALETTE.honey, '#fff6e0');
    if (obj.type === OBJ.START) dot(ctx, p, obj, 3.4, PALETTE.frame, '#ffd5cf');
  }

  return scratch.toDataURL('image/png');
}

/**
 * The built-in levels never change, so their picture is drawn once per page
 * load. Custom levels are redrawn every time, because the editor may have
 * just changed one.
 */
export function cachedThumbnail(data, cacheable) {
  if (!cacheable) return levelThumbnail(data);
  let url = cache.get(data.name);
  if (url === undefined) {
    url = levelThumbnail(data);
    cache.set(data.name, url);
  }
  return url;
}
