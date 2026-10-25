// Which way up the stage goes.
//
// Pulled out of main.js as a pure function for one reason: the bug it
// exists to fix only happens on a phone mid-rotation, and there is no
// phone here. A function that takes four numbers and returns a quarter
// turn can be proved at a desk — see test/stage.test.js, which walks every
// orientation on both launch routes and every way the readings can
// disagree. Nothing in here touches the DOM, and that is the point.
//
// The same arithmetic is spelled out a second time, by hand, in the inline
// script at the top of index.html. That is deliberate and not an oversight:
// that script has to be a classic script running before the first paint, so
// it cannot import this. If the two ever disagree the cost is one frame of
// the wrong rotation, which is the bug that script exists to prevent — so
// change them together.

/**
 * @param {object} view what the browser is currently telling us
 * @param {boolean} view.touch   is this a touch device at all
 * @param {boolean} view.standalone  launched from the home screen
 * @param {boolean} view.editor  the editor is open
 * @param {number}  view.angle   screen.orientation.angle, normalised to 0-359
 * @param {boolean} view.portrait  does the viewport read as portrait
 * @param {number}  view.width   window.innerWidth
 * @param {number}  view.height  window.innerHeight
 * @returns {0|90|180|270} degrees to turn the stage by
 */
export function stageTurn({ touch, standalone, editor, angle, portrait, width, height }) {
  // The editor maps pointer coordinates straight onto an untransformed
  // canvas, so a quarter turn would put every click in the wrong place.
  // There the old portrait gate still stands instead.
  if (!touch || editor) return 0;

  let turn;
  if (standalone) {
    // Installed, the game behaves like a landscape-locked app: the picture
    // never moves on the glass. Turn the phone and the pixels stay exactly
    // where they were — you are the one who turned, not the game. Undoing
    // the system's own rotation is what achieves it.
    turn = (90 - angle + 360) % 360;
  } else {
    // In a browser the chrome around us stays upright, so matching it is
    // the lesser evil: turn only when the viewport is portrait.
    turn = portrait ? 90 : 0;
  }

  // The angle and the viewport do not always agree. On iOS a resize can
  // arrive before `screen.orientation.angle` has caught up with it, or
  // after, and a turn computed from the stale one leaves the game standing
  // upright with no further event coming to correct it. Trusting the angle
  // harder cannot fix that, because the angle is the thing that is wrong.
  //
  // So the angle is a proposal, and this is the rule it is checked against:
  // the stage is landscape, always. That holds in every correct case — in a
  // quarter turn the stage is as wide as the viewport is tall, otherwise it
  // is the viewport — so a proposal that comes out portrait came from a
  // stale reading, and one more quarter turn is the answer. It costs two
  // numbers and needs nothing to be up to date except the viewport itself.
  if (isUpright(turn, width, height)) turn = (turn + 90) % 360;
  return turn;
}

// Would this quarter turn leave the stage taller than it is wide?
export function isUpright(turn, width, height) {
  return quartered(turn) ? width > height : height > width;
}

export const quartered = (turn) => turn === 90 || turn === 270;

// How far the system has turned the viewport away from the device's
// natural orientation. iOS rotates a home-screen web app whatever the
// manifest asks for, so this is how we find out and undo it.
export function systemAngle(portrait) {
  const o = typeof screen !== 'undefined' && screen.orientation;
  if (o && typeof o.angle === 'number') return ((o.angle % 360) + 360) % 360;
  if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
    return ((window.orientation % 360) + 360) % 360;
  }
  return portrait ? 0 : 90;
}
