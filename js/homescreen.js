// "Lägg till på hemskärmen" — and the three different stories the platforms
// tell about it.
//
// There is no one API. Chrome hands us a deferred event and lets us open the
// real install dialog; Safari on iPhone has no API whatsoever and the only
// route is the Share sheet, which means we can only explain it; everything
// else gets browser-menu wording. So this module answers two questions: can
// we ask outright, and if not, what should the player be told.
//
// Named homescreen rather than install for the same reason screenmode is not
// called fullscreen — see that file. It is imported dynamically behind a
// fallback, so a blocked request costs the install helper, not the game.

let deferred = null;

// Chrome fires this once, early, and only when the site qualifies as
// installable. Preventing the default keeps Chrome's own banner out of the
// way so our button is the only thing asking.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  window.dispatchEvent(new CustomEvent('bjorn:installable'));
});

window.addEventListener('appinstalled', () => {
  deferred = null;
  window.dispatchEvent(new CustomEvent('bjorn:installed'));
});

export function canPrompt() {
  return deferred !== null;
}

// Resolves to whether the player accepted. The event is single use: once
// prompted it is spent, whatever the answer.
export async function prompt() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

// Which set of instructions to show. Deliberately coarse: it picks wording,
// nothing more, so being wrong costs a confusing sentence rather than a
// broken feature.
export function platform() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua)
    // iPadOS 13 and later claim to be a Mac. The touch points give it away.
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    // Only Safari can add to the home screen on iOS; the other browsers are
    // Safari underneath but are not given the hook.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  }
  if (/Android/.test(ua)) return 'android';
  return 'other';
}
