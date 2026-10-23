// Minimal 2D vector helpers. Mirrors vect2.h from elma-classic.
// Coordinate system matches the original: +y is UP.

export const v = (x = 0, y = 0) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const neg = (a) => ({ x: -a.x, y: -a.y });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y);
export const len2 = (a) => a.x * a.x + a.y * a.y;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// rotate_90deg: counter-clockwise, so rot90({1,0}) == {0,1}
export const rot90 = (a) => ({ x: -a.y, y: a.x });

export const unit = (a) => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
