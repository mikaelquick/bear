import { Level } from './level.js';
import { LEVELS } from './levels.js';
import { Renderer } from './render.js';
import { Effects } from './effects.js';
import { Sfx } from './audio.js';
import { Demo } from './demo.js';
import { Game, STATE, formatTime } from './game.js';
import { Editor, TOOLS, emptyLevel } from './editor.js';
import { Touchpad } from './touchpad.js';
import { OBJ, MS_TO_PHYS_TIME, TIME_TO_CENTISECONDS } from './constants.js';
import { loadGhost, levelFingerprint, REPLAY_VERSION } from './replay.js';

// Fullscreen is a nice-to-have, and its module is exactly the sort of file a
// content blocker swallows. Loaded dynamically behind a no-op fallback so a
// blocked request costs the feature rather than the entire game.
const FULLSCREEN_UNAVAILABLE = {
  isSupported: () => false,
  isActive: () => false,
  isStandalone: () => false,
  request: async () => false,
  exit: async () => {},
  toggle: async () => false,
  onChange: () => {},
};

let fullscreen = FULLSCREEN_UNAVAILABLE;
try {
  fullscreen = await import('./screenmode.js');
} catch {
  /* blocked or unreachable — carry on without it */
}

const TIMES_KEY = 'bjorn.times';
const LEVELS_KEY = 'bjorn.levels';
const REPLAYS_KEY = 'bjorn.replays';
const SETTINGS_KEY = 'bjorn.settings';

// Simulation time advances this much per real second. Playback uses it to
// run a recording at the speed it was driven at.
const SIM_PER_REAL_SECOND = 1000 * MS_TO_PHYS_TIME;

const $ = (id) => document.getElementById(id);

const canvas = $('view');
const renderer = new Renderer(canvas);
const effects = new Effects();
const sfx = new Sfx(false); // muted until we have proper sounds
const game = new Game(renderer, sfx, effects);
const editor = new Editor(renderer);
let demo = null;

let mode = 'menu'; // 'menu' | 'play' | 'editor' | 'replay'
let returnToEditor = false;
let currentIndex = 0;
let customLevels = loadCustom();
let replay = null;
let toastTimer = null;
const settings = loadSettings();

// ---------------------------------------------------------------- storage

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

// Function declarations, not arrows: these are called from the module's
// top-level state initialisation above, which runs before const bindings in
// this section would exist.
function loadTimes() { return readJson(TIMES_KEY, {}); }
function loadCustom() { return readJson(LEVELS_KEY, []); }
function loadReplays() { return readJson(REPLAYS_KEY, {}); }
function saveCustom() { return writeJson(LEVELS_KEY, customLevels); }

function loadSettings() {
  // `fullscreen` stays undefined until the player is asked, which is how we
  // know to ask exactly once.
  return { ghost: true, sound: false, ...readJson(SETTINGS_KEY, {}) };
}
function saveSettings() {
  writeJson(SETTINGS_KEY, settings);
}

function saveTime(name, centiseconds) {
  const times = loadTimes();
  const prev = times[name];
  if (prev === undefined || centiseconds < prev) {
    times[name] = centiseconds;
    writeJson(TIMES_KEY, times);
    return true;
  }
  return false;
}

// Stores the run as input, not positions — a minute is a few kilobytes.
// Silently gives up if the recording is too long or storage is full; the time
// is still kept either way.
function saveReplay(level, centiseconds, recorder) {
  const frames = recorder.encode();
  if (!frames) return false;
  const replays = loadReplays();
  replays[level.name] = {
    v: REPLAY_VERSION,
    time: centiseconds,
    fingerprint: levelFingerprint(level),
    frames,
  };
  return writeJson(REPLAYS_KEY, replays);
}

function hasReplay(name) {
  const stored = loadReplays()[name];
  return !!stored && stored.v === REPLAY_VERSION;
}

// ---------------------------------------------------------------- menu

const allLevels = () => [
  ...LEVELS.map((data) => ({ data, custom: false })),
  ...customLevels.map((data) => ({ data, custom: true })),
];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const hiveCount = (data) => (data.objects || []).filter((o) => o.type === OBJ.APPLE).length;

// The scale runs to 7 so the second half of the game has somewhere to go.
const MAX_DIFFICULTY = 7;

function difficultyDots(n) {
  if (!n) return '';
  let html = `<span class="dots" title="Svårighetsgrad ${n} av ${MAX_DIFFICULTY}">`;
  for (let i = 1; i <= MAX_DIFFICULTY; i++) html += `<i class="${i <= n ? 'on' : ''}"></i>`;
  return html + '</span>';
}

function levelRow(entry, index, times) {
  const best = times[entry.data.name];
  const done = best !== undefined;
  const li = document.createElement('li');
  if (done) li.classList.add('done');
  li.innerHTML = `
    <span class="num">${done ? '✓' : index + 1}</span>
    <span class="name">
      ${escapeHtml(entry.data.name)}
      <div class="meta">${hiveCount(entry.data)} kupor${difficultyDots(entry.data.difficulty)}</div>
    </span>
    <span class="time ${done ? '' : 'none'}">${done ? formatTime(best) : '–'}</span>
  `;
  li.addEventListener('click', () => startLevel(index));

  if (hasReplay(entry.data.name)) {
    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = '▶';
    play.title = 'Se reprisen av ditt rekord';
    play.addEventListener('click', (e) => { e.stopPropagation(); startReplay(index); });
    li.appendChild(play);
  }
  return li;
}

function renderLevelList() {
  const times = loadTimes();
  const entries = allLevels();

  const builtIn = $('levelList');
  builtIn.innerHTML = '';
  entries.forEach((entry, index) => {
    if (!entry.custom) builtIn.appendChild(levelRow(entry, index, times));
  });

  const custom = $('customList');
  custom.innerHTML = '';
  entries.forEach((entry, index) => {
    if (!entry.custom) return;
    const li = levelRow(entry, index, times);
    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = 'Ta bort banan';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = customLevels.indexOf(entry.data);
      if (i >= 0) { customLevels.splice(i, 1); saveCustom(); renderLevelList(); }
    });
    li.appendChild(del);
    custom.appendChild(li);
  });
  $('customEmpty').classList.toggle('hidden', customLevels.length > 0);

  const cleared = LEVELS.filter((l) => times[l.name] !== undefined).length;
  $('progressFill').style.width = `${(cleared / LEVELS.length) * 100}%`;
  $('progressText').textContent = `${cleared} av ${LEVELS.length} banor klarade`;
}

// ---------------------------------------------------------------- modes

const hideAll = (...ids) => ids.forEach((id) => $(id).classList.add('hidden'));
const show = (...ids) => ids.forEach((id) => $(id).classList.remove('hidden'));

function showMenu() {
  mode = 'menu';
  returnToEditor = false;
  replay = null;
  document.body.classList.remove('playing');
  sfx.silenceEngine();
  renderLevelList();
  renderer.fitScale();
  if (!demo) demo = new Demo(renderer, effects);
  show('menu');
  hideAll('hud', 'dialog', 'pause', 'editorBar', 'editorHint', 'startHint',
          'touch', 'touchTop', 'replayBadge');
  hideToast();
}

function startLevel(index) {
  const entries = allLevels();
  if (!entries[index]) return;
  currentIndex = index;
  replay = null;
  sfx.ensure();
  renderer.fitScale();

  const level = new Level(entries[index].data);
  game.load(level);
  game.setGhost(settings.ghost ? loadGhost(level, loadReplays()[level.name]) : null);

  mode = 'play';
  document.body.classList.add('playing');
  hideAll('menu', 'dialog', 'pause', 'editorBar', 'editorHint', 'replayBadge');
  show('hud', 'startHint', 'touch', 'touchTop');
  $('hudLevel').textContent = level.name;
  const best = loadTimes()[level.name];
  $('hudBest').textContent = best === undefined ? 'inget rekord än' : 'bäst ' + formatTime(best);
  $('hudGhost').textContent = '';
  hideToast();
  applyFullscreenPreference();
}

// Plays back the stored record. Nothing is simulated live: the recording is
// re-run once up front and this just walks the resulting trajectory.
function startReplay(index) {
  const entries = allLevels();
  const entry = entries[index];
  if (!entry) return;

  const level = new Level(entry.data);
  const ghost = loadGhost(level, loadReplays()[entry.data.name]);
  if (!ghost) {
    toast('Ingen inspelning sparad för den banan.');
    return;
  }

  currentIndex = index;
  renderer.fitScale();
  renderer.horizonY = level.bounds.maxY * 0.55 + level.bounds.minY * 0.45;
  renderer.lead = { x: 0, y: 0 };
  renderer.camInit = false;
  effects.clear();
  sfx.silenceEngine();

  replay = { level, ghost, time: 0, hold: 0, lastPos: null };
  mode = 'replay';
  document.body.classList.remove('playing');
  hideAll('menu', 'dialog', 'pause', 'editorBar', 'editorHint', 'startHint', 'touch');
  show('hud', 'replayBadge', 'touchTop');
  $('hudLevel').textContent = entry.data.name;
  $('hudBest').textContent = formatTime(ghost.centiseconds);
  $('hudGhost').textContent = 'Esc för att stänga';
  hideToast();
}

function openEditor(level) {
  mode = 'editor';
  replay = null;
  document.body.classList.remove('playing');
  sfx.silenceEngine();
  editor.load(level || emptyLevel());
  $('edName').value = editor.level.name;
  renderer.scale = 26;
  renderer.cam = { x: 20, y: 8 };
  renderer.lead = { x: 0, y: 0 };
  renderer.shakeX = 0;
  renderer.shakeY = 0;
  renderer.camInit = true;
  hideAll('menu', 'hud', 'dialog', 'pause', 'startHint', 'touch', 'touchTop', 'replayBadge');
  show('editorBar', 'editorHint');
  hideToast();
}

function testEditorLevel() {
  editor.level.name = $('edName').value || 'Testbana';
  editor.level.rebuild();
  if (!editor.level.objects.some((o) => o.type === OBJ.START)) {
    toast('Banan behöver ett startobjekt.');
    return;
  }
  if (!editor.level.objects.some((o) => o.type === OBJ.EXIT)) {
    toast('Banan behöver en honungskruka.');
    return;
  }
  sfx.ensure();
  renderer.fitScale();
  // Play the editor's own Level object, so edits carry straight over.
  game.load(editor.level);
  game.setGhost(null);
  mode = 'play';
  returnToEditor = true;
  document.body.classList.add('playing');
  hideAll('editorBar', 'editorHint', 'replayBadge');
  show('hud', 'startHint', 'touch', 'touchTop');
  $('hudLevel').textContent = editor.level.name + ' (test)';
  $('hudBest').textContent = 'testläge — Esc tillbaka till editorn';
  $('hudGhost').textContent = '';
}

function toast(message, ms = 2600) {
  const el = $('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(hideToast, ms);
}
function hideToast() {
  $('toast').classList.add('hidden');
  clearTimeout(toastTimer);
}

// ---------------------------------------------------------------- dialogs

function showResult() {
  const entries = allLevels();
  const name = game.level.name;
  const time = game.finalTime;
  const isRecord = returnToEditor ? false : saveTime(name, time);

  let replaySaved = false;
  if (isRecord) replaySaved = saveReplay(game.level, time, game.recorder);
  const best = loadTimes()[name];

  $('dialogTitle').textContent = isRecord ? 'Nytt rekord!' : 'Klarat!';
  $('dialogText').innerHTML =
    `<span class="result-time">${formatTime(time)}</span>` +
    (returnToEditor
      ? '<span class="fine">Testläge — tiden sparas inte.</span>'
      : isRecord
        ? '<span class="record-badge">personbästa</span>'
        : `<span class="fine">Ditt rekord: ${formatTime(best)}</span>`);

  const buttons = $('dialogButtons');
  buttons.innerHTML = '';
  if (returnToEditor) {
    addButton(buttons, 'Tillbaka till editorn', () => openEditor(editor.level));
    addButton(buttons, 'Kör igen', restartRun, true);
  } else {
    const hasNext = currentIndex + 1 < entries.length;
    if (hasNext) addButton(buttons, 'Nästa bana →', () => startLevel(currentIndex + 1));
    addButton(buttons, 'Kör igen', restartRun, hasNext);
    if (replaySaved || hasReplay(name)) {
      addButton(buttons, 'Se reprisen', () => startReplay(currentIndex), true);
    }
    addButton(buttons, 'Meny', showMenu, true);
  }
  $('dialog').classList.remove('hidden');
}

function restartRun() {
  hideAll('dialog', 'pause');
  hideToast();
  game.restart();
  show('startHint');
}

function addButton(parent, label, onClick, secondary = false) {
  const b = document.createElement('button');
  b.textContent = label;
  if (secondary) b.className = 'secondary';
  b.addEventListener('click', onClick);
  parent.appendChild(b);
}

function setPaused(paused) {
  $('pause').classList.toggle('hidden', !paused);
  if (paused) $('startHint').classList.add('hidden');
}

function leavePlay() {
  if (returnToEditor) openEditor(editor.level);
  else showMenu();
}

// ---------------------------------------------------------------- settings

function applySettings() {
  $('optGhost').checked = settings.ghost;
  $('optSound').checked = settings.sound;
  game.showGhost = settings.ghost;
  sfx.setEnabled(settings.sound);
  syncFullscreenUi();
  // Nothing to offer when the API is missing, or when the game was launched
  // from the home screen and is already chrome-free.
  $('optFullscreenWrap').classList.toggle(
    'hidden', !fullscreen.isSupported() || fullscreen.isStandalone()
  );
}

function syncFullscreenUi() {
  const active = fullscreen.isActive();
  $('optFullscreen').checked = active;
  const btn = document.querySelector('.tbtn[data-action="fullscreen"]');
  if (btn) btn.classList.toggle('on', active);
}
fullscreen.onChange(syncFullscreenUi);

const fsPromptOpen = () => !$('fsPrompt').classList.contains('hidden');

function shouldAskFullscreen() {
  return settings.fullscreen === undefined
    && fullscreen.isSupported()
    && !fullscreen.isStandalone();
}

// The click that answered the prompt is itself the user gesture the browser
// requires, so the request has to happen straight out of the handler.
function answerFullscreen(yes) {
  settings.fullscreen = yes;
  saveSettings();
  $('fsPrompt').classList.add('hidden');
  if (yes) fullscreen.request();
}

// Called from level starts, which always run inside a click or key handler.
function applyFullscreenPreference() {
  if (shouldAskFullscreen()) {
    $('fsPrompt').classList.remove('hidden');
    return;
  }
  if (settings.fullscreen && !fullscreen.isActive()) fullscreen.request();
  maybeSuggestHomeScreen();
}

// iPhone has no fullscreen button to offer, so point at the one route that
// does work there. Shown once, then never again.
function maybeSuggestHomeScreen() {
  if (settings.homeScreenTipSeen) return;
  if (fullscreen.isSupported() || fullscreen.isStandalone()) return;
  if (!document.body.classList.contains('touch')) return;
  settings.homeScreenTipSeen = true;
  saveSettings();
  toast('Tips: Dela → Lägg till på hemskärmen ger fullskärm.', 5000);
}

function setGhostEnabled(on) {
  settings.ghost = on;
  saveSettings();
  game.showGhost = on;
  $('optGhost').checked = on;
  if (on && mode === 'play' && !game.ghost && game.level) {
    game.setGhost(loadGhost(game.level, loadReplays()[game.level.name]));
  }
}

async function toggleFullscreen() {
  const active = await fullscreen.toggle();
  settings.fullscreen = active;
  saveSettings();
  syncFullscreenUi();
}

function setSoundEnabled(on) {
  settings.sound = on;
  saveSettings();
  sfx.setEnabled(on);
  $('optSound').checked = on;
  if (on) sfx.ensure();
}

// ---------------------------------------------------------------- input

const BLOCKED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'Backspace',
]);

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (BLOCKED.has(e.code)) e.preventDefault();

  // The prompt is modal: do not let the bear set off behind it.
  if (fsPromptOpen()) {
    if (e.code === 'Escape') answerFullscreen(false);
    return;
  }
  if (e.code === 'KeyF' && !e.repeat) { toggleFullscreen(); return; }

  if (mode === 'menu') return;

  if (mode === 'replay') {
    if (e.code === 'Escape' || e.code === 'Enter') showMenu();
    return;
  }

  if (mode === 'editor') {
    if (e.code === 'Escape' && !editor.draft) { showMenu(); return; }
    if (editor.onKeyDown(e)) return;
    const toolKeys = {
      Digit1: TOOLS.POLY, Digit2: TOOLS.EDIT, Digit3: TOOLS.START,
      Digit4: TOOLS.HIVE, Digit5: TOOLS.WASPS, Digit6: TOOLS.EXIT,
    };
    if (toolKeys[e.code]) setTool(toolKeys[e.code]);
    if (e.code === 'KeyT') testEditorLevel();
    return;
  }

  // Playing
  if (e.code === 'Escape') {
    if (game.paused) { game.togglePause(); setPaused(false); return; }
    leavePlay();
    return;
  }
  if (e.repeat) {
    if (!BLOCKED.has(e.code)) return;
  } else {
    if (e.code === 'KeyP') { setPaused(game.togglePause()); return; }
    if (e.code === 'KeyG') {
      setGhostEnabled(!settings.ghost);
      toast(settings.ghost ? 'Ghost på' : 'Ghost av', 1200);
      return;
    }
    if (e.code === 'KeyM') {
      setSoundEnabled(!settings.sound);
      toast(settings.sound ? 'Ljud på' : 'Ljud av', 1200);
      return;
    }
  }
  if (e.code === 'Enter' || e.code === 'KeyR') { restartRun(); return; }
  if (game.paused || e.repeat) return;
  sfx.ensure();
  game.keyDown(e.code);
  if (game.state === STATE.PLAYING) $('startHint').classList.add('hidden');
});

window.addEventListener('keyup', (e) => {
  if (mode === 'play') game.keyUp(e.code);
});

window.addEventListener('blur', () => game.keys.clear());

// ---------------------------------------------------------------- touch

function enableTouchUI() {
  document.body.classList.add('touch');
}
// `?touch=1` forces the on-screen controls on a desktop browser, which is how
// tools/mobile-preview.html can show the real thing in an iframe.
const forceTouch = new URLSearchParams(location.search).get('touch') === '1';
if (forceTouch) enableTouchUI();
if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouchUI();
window.addEventListener('touchstart', enableTouchUI, { once: true, passive: true });

const touchpad = new Touchpad({
  onPress: (code) => {
    sfx.ensure();
    game.keyDown(code);
    if (game.state === STATE.PLAYING) $('startHint').classList.add('hidden');
  },
  onRelease: (code) => game.keyUp(code),
  onAction: (action) => {
    if (action === 'fullscreen') { toggleFullscreen(); return; }
    if (mode === 'replay') { showMenu(); return; }
    if (action === 'restart') restartRun();
    else setPaused(game.togglePause());
  },
  // Dead is the state you spend most of your time in. One tap anywhere
  // retries, rather than aiming for a small button at the top of the screen.
  onTapAway: () => {
    if (fsPromptOpen()) return;
    if (mode === 'play' && game.state === STATE.DEAD) restartRun();
  },
  isActive: () => document.body.classList.contains('touch')
    && (mode === 'play' || mode === 'replay'),
});
touchpad.attach();

// Portrait is blocked outright on touch devices. Pause rather than just
// covering the screen, or the bear keeps riding behind the overlay.
const portrait = window.matchMedia
  ? matchMedia('(orientation: portrait)')
  : { matches: false, addEventListener() {} };

const orientationBlocked = () =>
  document.body.classList.contains('touch') && portrait.matches;

function handleOrientation() {
  if (!orientationBlocked()) return;
  touchpad.releaseAll();
  game.keys.clear();
  if (mode === 'play' && !game.paused) setPaused(game.togglePause());
}
portrait.addEventListener('change', handleOrientation);

// Switching away mid-press would otherwise leave the throttle open.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  touchpad.releaseAll();
  game.keys.clear();
  if (mode === 'play' && !game.paused && game.state === STATE.PLAYING) {
    setPaused(game.togglePause());
  }
});

// ---------------------------------------------------------------- editor UI

function setTool(tool) {
  editor.tool = tool;
  document.querySelectorAll('#editorBar .tools button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}

document.querySelectorAll('#editorBar .tools button').forEach((b) => {
  b.addEventListener('click', () => setTool(b.dataset.tool));
});

$('edGrass').addEventListener('change', (e) => { editor.grass = e.target.checked; });
$('edSnap').addEventListener('change', (e) => { editor.snap = e.target.checked; });
$('edName').addEventListener('input', (e) => { editor.level.name = e.target.value; });
$('edTest').addEventListener('click', testEditorLevel);
$('edExit').addEventListener('click', showMenu);
$('edNew').addEventListener('click', () => openEditor(emptyLevel()));

$('edSave').addEventListener('click', () => {
  editor.level.name = $('edName').value || 'Namnlös bana';
  const json = editor.level.toJSON();
  const existing = customLevels.findIndex((l) => l.name === json.name);
  if (existing >= 0) customLevels[existing] = json;
  else customLevels.push(json);
  saveCustom();
  toast(`"${json.name}" sparad.`);
});

$('edExport').addEventListener('click', () => {
  editor.level.name = $('edName').value || 'Namnlös bana';
  const blob = new Blob([JSON.stringify(editor.level.toJSON(), null, 2)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = editor.level.name.replace(/[^\w\-åäöÅÄÖ ]+/g, '') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('btnEditor').addEventListener('click', () => openEditor(emptyLevel()));
$('btnImport').addEventListener('click', () => $('fileInput').click());
$('btnResume').addEventListener('click', () => { game.togglePause(); setPaused(false); });
$('btnPauseRestart').addEventListener('click', restartRun);
$('btnPauseMenu').addEventListener('click', () => { game.paused = false; leavePlay(); });
$('optGhost').addEventListener('change', (e) => setGhostEnabled(e.target.checked));
$('optFullscreen').addEventListener('change', toggleFullscreen);
$('fsYes').addEventListener('click', () => answerFullscreen(true));
$('fsNo').addEventListener('click', () => answerFullscreen(false));
$('optSound').addEventListener('change', (e) => setSoundEnabled(e.target.checked));

$('btnReset').addEventListener('click', () => {
  try {
    localStorage.removeItem(TIMES_KEY);
    localStorage.removeItem(REPLAYS_KEY);
  } catch { /* ignore */ }
  renderLevelList();
  toast('Alla rekord och repriser nollställda.');
});

$('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.polygons) || !Array.isArray(data.objects)) {
      throw new Error('saknar polygons eller objects');
    }
    customLevels.push(data);
    saveCustom();
    renderLevelList();
    toast(`"${data.name || 'Bana'}" importerad.`);
  } catch (err) {
    toast('Kunde inte läsa filen: ' + err.message);
  }
  e.target.value = '';
});

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.tabpane').forEach((p) => {
      p.classList.toggle('hidden', p.dataset.pane !== tab.dataset.tab);
    });
  });
});

// Canvas pointer events only matter in the editor.
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'editor') return;
  canvas.setPointerCapture(e.pointerId);
  editor.onPointerDown(e);
});
canvas.addEventListener('pointermove', (e) => { if (mode === 'editor') editor.onPointerMove(e); });
canvas.addEventListener('pointerup', (e) => { if (mode === 'editor') editor.onPointerUp(e); });
canvas.addEventListener('wheel', (e) => {
  if (mode !== 'editor') return;
  e.preventDefault();
  editor.onWheel(e);
}, { passive: false });

// ---------------------------------------------------------------- loop

function updateGhostReadout() {
  const el = $('hudGhost');
  const lead = game.ghostLead;
  if (lead === null) {
    if (el.textContent) { el.textContent = ''; el.className = 'hud-sub'; }
    return;
  }
  // Stated from the player's point of view: a ghost that is ahead means you
  // are behind.
  if (Math.abs(lead) < 0.15) {
    el.textContent = 'i jämnhöjd med ghost';
    el.className = 'hud-sub';
    return;
  }
  const behind = lead > 0;
  el.textContent = `${Math.abs(lead).toFixed(1)} m ${behind ? 'efter' : 'före'} ghost`;
  el.className = 'hud-sub ' + (behind ? 'behind' : 'ahead');
}

function renderReplay(dtSeconds, wallClock) {
  const r = renderer;
  const dtSim = dtSeconds * SIM_PER_REAL_SECOND;
  const duration = replay.ghost.duration;

  if (replay.time < duration) replay.time = Math.min(replay.time + dtSim, duration);
  else {
    replay.hold += dtSeconds;
    if (replay.hold > 1.6) { replay.time = 0; replay.hold = 0; replay.ghost.rewind(); }
  }

  const pose = replay.ghost.poseAt(replay.time);
  if (!pose) return;

  // Velocity for the camera look-ahead, derived from the trajectory.
  let velocity = null;
  if (replay.lastPos && dtSim > 1e-9) {
    velocity = {
      x: (pose.bike.r.x - replay.lastPos.x) / dtSim,
      y: (pose.bike.r.y - replay.lastPos.y) / dtSim,
    };
  }
  replay.lastPos = { x: pose.bike.r.x, y: pose.bike.r.y };

  replay.ghost.applyPickups(replay.level, replay.time);
  const armed = replay.level.objects.every((o) => o.type !== OBJ.APPLE || o.taken);

  effects.update(dtSeconds);
  r.shakeX = 0;
  r.shakeY = 0;
  r.followCamera(pose.bike.r, dtSeconds, false, velocity);
  r.clear();
  r.drawTerrain(replay.level);
  r.drawObjects(replay.level, wallClock, armed);
  r.drawBike(pose, false);
  r.drawOverlays(effects);

  $('hudTime').textContent = formatTime(replay.time * TIME_TO_CENTISECONDS);
  $('hudHives').textContent = replay.level.objects.filter(
    (o) => o.type === OBJ.APPLE && !o.taken
  ).length;
}

let lastFrame = performance.now();

function frame(now) {
  // Rounded to float32 so the value a replay stores is exactly the one the
  // simulation consumed.
  const dtMs = Math.fround(Math.min(now - lastFrame, 250));
  lastFrame = now;
  const wallClock = now / 1000;

  if (mode === 'play') {
    // Checked per frame rather than only on the orientation event, so a
    // level started while already in portrait does not run behind the gate.
    if (orientationBlocked() && !game.paused) handleOrientation();
    game.step(dtMs);
    game.render(dtMs / 1000, wallClock);
    $('hudTime').textContent = formatTime(game.displayTime);
    $('hudHives').textContent = game.applesLeft;
    updateGhostReadout();

    if (game.state === STATE.DEAD && $('toast').classList.contains('hidden')) {
      $('startHint').classList.add('hidden');
      toast(document.body.classList.contains('touch')
        ? 'Aj! Huvudet tog i. Tryck var som helst för att börja om.'
        : 'Aj! Huvudet tog i. Tryck Enter för att börja om.', 0);
    }
    if (game.canShowResult && $('dialog').classList.contains('hidden')) showResult();
  } else if (mode === 'replay' && replay) {
    renderReplay(dtMs / 1000, wallClock);
  } else if (mode === 'editor') {
    editor.render(wallClock);
  } else if (demo) {
    demo.step(dtMs);
    demo.render(dtMs / 1000, wallClock);
    $('demoLabel').textContent = `Demo: ${demo.levelName}`;
  }

  requestAnimationFrame(frame);
}

// Handy from the devtools console, and what the automated checks drive.
window.bjorn = {
  get mode() { return mode; },
  get demo() { return demo; },
  get replay() { return replay; },
  game, editor, renderer, effects, sfx, settings,
  startLevel, startReplay, showMenu, openEditor,
  levels: LEVELS,
};

function relayout() {
  renderer.resize();
  // The editor has its own zoom, set by the user scrolling.
  if (mode !== 'editor') renderer.fitScale();
  handleOrientation();
}

window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', relayout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
renderer.resize();
renderer.fitScale();
applySettings();
showMenu();
requestAnimationFrame(frame);
