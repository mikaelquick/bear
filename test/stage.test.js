// Proves the stage always ends up landscape.
//
// This exists because the bug it covers cannot be reproduced here. "The
// installed app still goes portrait sometimes" happens on a phone, mid
// rotation, when iOS reports an orientation angle that disagrees with the
// viewport it has already resized. There is no phone at this desk and no
// way to make a desktop browser lie in that particular way — so the
// decision was pulled out of the DOM into js/stage.js, and what is checked
// here is the arithmetic, exhaustively, including every way the two
// readings can disagree.
//
// The invariant: for a touch device outside the editor, whatever is
// reported, the stage comes out wider than it is tall.

import assert from 'node:assert/strict';
import { stageTurn, isUpright, quartered } from '../js/stage.js';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message}`);
  }
}

console.log('stage orientation');

const PHONE = { w: 393, h: 852 };           // portrait viewport
const PHONE_SIDE = { w: 852, h: 393 };      // the same phone, turned

const view = (over) => ({
  touch: true, standalone: false, editor: false,
  angle: 0, portrait: true, width: PHONE.w, height: PHONE.h,
  ...over,
});

// Every combination of launch route and reported angle, with the viewport
// that genuinely goes with that angle.
test('a truthful reading always lands the stage landscape', () => {
  for (const standalone of [false, true]) {
    for (const angle of [0, 90, 180, 270]) {
      const upright = angle === 0 || angle === 180;
      const size = upright ? PHONE : PHONE_SIDE;
      const turn = stageTurn(view({
        standalone, angle, portrait: upright, width: size.w, height: size.h,
      }));
      assert.ok(
        !isUpright(turn, size.w, size.h),
        `standalone=${standalone} angle=${angle}: turn ${turn} leaves the stage upright`
      );
    }
  }
});

// The bug itself: the angle has not caught up with the viewport, or the
// viewport has not caught up with the angle. Either way the rule holds.
test('a stale angle still lands the stage landscape', () => {
  for (const standalone of [false, true]) {
    for (const angle of [0, 90, 180, 270]) {
      for (const size of [PHONE, PHONE_SIDE]) {
        for (const portrait of [false, true]) {
          const turn = stageTurn(view({
            standalone, angle, portrait, width: size.w, height: size.h,
          }));
          assert.ok(
            !isUpright(turn, size.w, size.h),
            `standalone=${standalone} angle=${angle} portrait=${portrait} `
            + `viewport=${size.w}x${size.h}: turn ${turn} leaves the stage upright`
          );
          assert.ok([0, 90, 180, 270].includes(turn), `turn ${turn} is not a quarter`);
        }
      }
    }
  }
});

// Named on its own so the sweep above cannot quietly become vacuous: this
// is the exact reading the bug produces, and the exact turn it must give.
test('the correction fires when the angle says landscape and the viewport says otherwise', () => {
  const stale = view({
    standalone: true, angle: 90,            // the system says it is on its side
    portrait: true, width: PHONE.w, height: PHONE.h,  // the viewport says upright
  });
  // Trusting the angle alone would give 0, which leaves the game standing
  // upright with no further event coming to fix it.
  assert.equal((90 - 90 + 360) % 360, 0, 'the uncorrected answer is 0');
  assert.equal(stageTurn(stale), 90);
});

// The correction must not cost the installed app what it is for: with
// honest readings the picture stays put on the glass whichever way the
// phone is held, which is what "turn the phone and nothing moves" means.
test('installed, the picture stays put on the glass', () => {
  // Turning the phone by some angle must turn the stage back by the same
  // amount, so the two cancel and the pixels never move.
  for (const [angle, size, expected] of [
    [90, PHONE_SIDE, 0],
    [0, PHONE, 90],
    [270, PHONE_SIDE, 180],
    [180, PHONE, 270],
  ]) {
    const turn = stageTurn(view({
      standalone: true, angle, portrait: size === PHONE,
      width: size.w, height: size.h,
    }));
    assert.equal(turn, expected, `angle ${angle} should give turn ${expected}`);
  }
});

test('in a browser the stage only turns when the viewport is portrait', () => {
  assert.equal(stageTurn(view({ portrait: true, width: PHONE.w, height: PHONE.h })), 90);
  assert.equal(
    stageTurn(view({ portrait: false, width: PHONE_SIDE.w, height: PHONE_SIDE.h })),
    0
  );
});

test('the editor and the desktop are never turned', () => {
  // The editor maps pointer coordinates onto an untransformed canvas, so a
  // quarter turn would put every click in the wrong place.
  assert.equal(stageTurn(view({ editor: true })), 0);
  assert.equal(stageTurn(view({ editor: true, standalone: true, angle: 0 })), 0);
  // A desktop window taller than it is wide is the player's business.
  assert.equal(stageTurn(view({ touch: false, width: 600, height: 900 })), 0);
});

test('quartered says which turns swap the stage dimensions', () => {
  assert.equal(quartered(0), false);
  assert.equal(quartered(90), true);
  assert.equal(quartered(180), false);
  assert.equal(quartered(270), true);
});

console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
process.exit(failures ? 1 : 0);
