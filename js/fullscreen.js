// Fullscreen, with the platform caveats kept in one place.
//
// iPhone Safari does not implement the Fullscreen API for ordinary elements
// (iPad has since iPadOS 16.4). So every call here is best effort: ask, and
// carry on regardless of the answer. The real route to a chrome-free game on
// iPhone is Add to Home Screen, which the web manifest covers.

export function isSupported() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// Launched from the home screen there is no browser chrome to hide, so the
// question is moot and we should not ask it.
export function isStandalone() {
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches)
    || window.navigator.standalone === true;
}

// Must be called from inside a user gesture, or the browser refuses.
export async function request(element = document.documentElement) {
  if (isActive()) return true;
  const fn = element.requestFullscreen || element.webkitRequestFullscreen;
  if (!fn) return false;
  try {
    await fn.call(element, { navigationUI: 'hide' });
  } catch {
    return false;
  }
  lockLandscape();
  return isActive();
}

export async function exit() {
  if (!isActive()) return;
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  try { await fn.call(document); } catch { /* already out */ }
}

export async function toggle(element) {
  if (isActive()) {
    await exit();
    return false;
  }
  return request(element);
}

// Only allowed while fullscreen, and only on some platforms. Where it works
// the portrait gate never has to appear at all.
async function lockLandscape() {
  try {
    await screen.orientation.lock('landscape');
  } catch {
    /* not supported, or not permitted — the portrait gate still covers us */
  }
}

export function onChange(handler) {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
}
