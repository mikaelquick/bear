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
import { cachedThumbnail } from './thumbnail.js';
import { BIOMES, DEFAULT_BIOME, biomeOf, findBiome } from './biomes.js';
import { VEHICLES, DEFAULT_VEHICLE, findVehicle } from './vehicles.js';

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

// Same treatment for the home screen helper: if it never arrives the player
// still gets the generic instructions, which is most of its value anyway.
const HOMESCREEN_UNAVAILABLE = {
  canPrompt: () => false,
  prompt: async () => false,
  platform: () => 'other',
};

let homescreen = HOMESCREEN_UNAVAILABLE;
try {
  homescreen = await import('./homescreen.js');
} catch {
  /* blocked or unreachable — the written instructions still work */
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
let currentVehicle = DEFAULT_VEHICLE;
let customLevels = loadCustom();
let replay = null;
let toastTimer = null;
const settings = loadSettings();

// `play/` redirects here with ?web. It is the bookmarkable way in for
// someone who only ever wants the browser, so arriving that way answers the
// question rather than raising it. An existing choice is left alone.
if (new URLSearchParams(location.search).has('web')) {
  settings.launch ??= 'web';
  saveSettings();
}

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
  // know to ask exactly once. Ghost starts off: a translucent second bear
  // riding alongside is confusing unless you went looking for it, and
  // whoever wants it knows where the switch is. Anyone who already turned
  // it on keeps it — this only changes where a new player starts.
  return { ghost: false, sound: false, ...readJson(SETTINGS_KEY, {}) };
}
function saveSettings() {
  writeJson(SETTINGS_KEY, settings);
}

// A time is only comparable against times set on the same machine, so each
// one keeps its own record. The motorbike keeps the bare level name, which
// means every record set before vehicles existed is still exactly where the
// game looks for it — no migration, nothing lost. The separator is a NUL,
// which no level name can contain.
const recordKey = (name, vehicleId) =>
  (vehicleId && vehicleId !== DEFAULT_VEHICLE) ? `${name}\u0000${vehicleId}` : name;

function saveTime(name, centiseconds, vehicleId) {
  const times = loadTimes();
  const key = recordKey(name, vehicleId);
  const prev = times[key];
  if (prev === undefined || centiseconds < prev) {
    times[key] = centiseconds;
    writeJson(TIMES_KEY, times);
    return true;
  }
  return false;
}

// Which machines this level has been finished on, in menu order.
function clearedOn(times, name) {
  return VEHICLES.filter((v) => times[recordKey(name, v.id)] !== undefined);
}

// Stores the run as input, not positions — a minute is a few kilobytes.
// Silently gives up if the recording is too long or storage is full; the time
// is still kept either way.
function saveReplay(level, centiseconds, recorder, vehicleId) {
  const frames = recorder.encode();
  if (!frames) return false;
  const replays = loadReplays();
  replays[recordKey(level.name, vehicleId)] = {
    v: REPLAY_VERSION,
    vehicle: vehicleId,
    time: centiseconds,
    fingerprint: levelFingerprint(level),
    frames,
  };
  return writeJson(REPLAYS_KEY, replays);
}

function hasReplay(name, vehicleId) {
  const stored = loadReplays()[recordKey(name, vehicleId)];
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

// A card rather than a row: a picture of the cave says more about which
// level this is than its name does, and a tick you can see across a room
// says more about having finished it than a time in small print.
function levelRow(entry, index, times) {
  const name = entry.data.name;
  const cleared = clearedOn(times, name);
  const done = cleared.length > 0;
  // The time shown is the one for the machine you would set off on, since
  // that is the one you are about to try to beat.
  const best = times[recordKey(name, currentVehicle)];
  const li = document.createElement('li');
  if (done) li.classList.add('done');
  const shot = cachedThumbnail(entry.data, !entry.custom);
  li.innerHTML = `
    <span class="shot">
      <img src="${shot}" alt="" draggable="false">
      <span class="num">${index + 1}</span>
      ${done ? `<span class="tick" title="Klarad med ${cleared.map((v) => v.name.toLowerCase()).join(' och ')}">${cleared.map((v) => v.emoji).join('')}</span>` : ''}
    </span>
    <span class="name">
      ${escapeHtml(name)}
      <span class="meta">${hiveCount(entry.data)} kupor${difficultyDots(entry.data.difficulty)}</span>
    </span>
    <span class="foot">
      <span class="time ${best === undefined ? 'none' : ''}">${best === undefined ? '' : formatTime(best)}</span>
    </span>
  `;
  li.addEventListener('click', () => openRideChoice(index));

  if (hasReplay(name, currentVehicle)) {
    const play = document.createElement('button');
    play.className = 'play';
    play.textContent = '▶';
    play.title = 'Se reprisen av ditt rekord';
    play.addEventListener('click', (e) => { e.stopPropagation(); startReplay(index, currentVehicle); });
    li.querySelector('.foot').appendChild(play);
  }
  return li;
}

// A world card: emoji, name, and how far through it you are. The progress
// is the point — it is what tells you which world you left unfinished.
function biomeCard(biome, entries, times) {
  const mine = entries.filter((e) => !e.custom && biomeOf(e.data) === biome.id);
  const cleared = mine.filter((e) => clearedOn(times, e.data.name).length > 0).length;
  const share = mine.length ? (cleared / mine.length) * 100 : 0;
  const li = document.createElement('li');
  li.className = 'biome' + (biome.locked ? ' locked' : '');
  // Emoji, name, and how far through it you are. Nothing else: a sentence
  // of flavour text is a sentence a child has to get past, and the picture
  // and the number already say everything they need. A locked world shows
  // a padlock rather than the word for one, for the same reason.
  li.innerHTML = `
    <span class="biome-emoji" aria-hidden="true">${biome.emoji}</span>
    <span class="biome-name">${escapeHtml(biome.name)}</span>
    ${biome.locked ? '<span class="biome-lock" title="Låst" aria-label="Låst">🔒</span>' : `
      <span class="biome-count">${cleared} av ${mine.length} klarade</span>
      <span class="progress-bar"><span style="width: ${share}%"></span></span>`}
  `;
  if (!biome.locked) li.addEventListener('click', () => openBiome(biome.id));
  return li;
}

function renderBiomeList() {
  const times = loadTimes();
  const entries = allLevels();
  const list = $('biomeList');
  list.innerHTML = '';
  for (const biome of BIOMES) list.appendChild(biomeCard(biome, entries, times));
}

function renderLevelList() {
  const times = loadTimes();
  const entries = allLevels();

  renderBiomeList();

  // Only the open world's levels. An unopened chooser renders none, which
  // costs nothing and keeps the two views from disagreeing.
  const builtIn = $('levelList');
  builtIn.innerHTML = '';
  entries.forEach((entry, index) => {
    if (entry.custom || biomeOf(entry.data) !== openBiomeId) return;
    builtIn.appendChild(levelRow(entry, index, times));
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
    li.querySelector('.foot').appendChild(del);
    custom.appendChild(li);
  });
  $('customEmpty').classList.toggle('hidden', customLevels.length > 0);

  const cleared = LEVELS.filter((l) => clearedOn(times, l.name).length > 0).length;
  $('progressFill').style.width = `${(cleared / LEVELS.length) * 100}%`;
  $('progressText').textContent = `${cleared} av ${LEVELS.length} banor klarade`;
}

// ------------------------------------------------------------ vehicles

const rideChoiceOpen = () => !$('rideChoice').classList.contains('hidden');

// Which level the chooser is about. Null when it is closed.
let pendingLevel = null;

// Each machine as a full-width row with its own record on this level, so
// the choice is made with the thing that matters in front of you: how you
// have done on each.
function openRideChoice(index) {
  const entries = allLevels();
  const entry = entries[index];
  if (!entry) return;
  pendingLevel = index;
  const times = loadTimes();
  $('rideLevel').textContent = entry.data.name;
  const list = $('rideList');
  list.innerHTML = '';
  for (const vehicle of VEHICLES) {
    const best = times[recordKey(entry.data.name, vehicle.id)];
    const btn = document.createElement('button');
    btn.className = 'choice' + (vehicle.id === currentVehicle ? '' : ' secondary');
    btn.innerHTML = `
      <span class="choice-ico" aria-hidden="true">${vehicle.emoji}</span>
      <span class="choice-text">
        <strong>${escapeHtml(vehicle.name)}</strong>
        <small>${best === undefined ? 'inte klarad än' : 'bäst ' + formatTime(best)}</small>
      </span>`;
    btn.addEventListener('click', () => {
      hideAll('rideChoice');
      pendingLevel = null;
      startLevel(index, vehicle.id);
    });
    list.appendChild(btn);
  }
  show('rideChoice');
}

function closeRideChoice() {
  pendingLevel = null;
  hideAll('rideChoice');
}

// ------------------------------------------------------------- worlds

// Which world's levels are on screen, or null for the chooser itself.
let openBiomeId = null;

// The panel is what scrolls, not the list, so the position we remember is
// the panel's. Kept per world: coming back to the one you are stuck on
// should put you back at the level you are stuck on, not at the top.
function rememberBiomeScroll() {
  if (!openBiomeId) return;
  const panel = document.querySelector('#menu .panel');
  if (!panel) return;
  settings.biomeScroll = { ...settings.biomeScroll, [openBiomeId]: panel.scrollTop };
  saveSettings();
}

function restoreBiomeScroll() {
  const panel = document.querySelector('#menu .panel');
  const top = settings.biomeScroll && settings.biomeScroll[openBiomeId];
  if (!panel || !top) return;
  // After layout, or the panel has no scroll height to move within yet.
  requestAnimationFrame(() => { panel.scrollTop = top; });
}

function openBiome(id, { restore = true } = {}) {
  const biome = findBiome(id);
  if (!biome || biome.locked) return;
  openBiomeId = id;
  if (settings.biome !== id) { settings.biome = id; saveSettings(); }
  $('biomeTitle').textContent = `${biome.emoji} ${biome.name}`;
  $('biomePicker').classList.add('hidden');
  $('levelView').classList.remove('hidden');
  renderLevelList();
  if (restore) restoreBiomeScroll();
}

function closeBiome() {
  rememberBiomeScroll();
  openBiomeId = null;
  if (settings.biome) { settings.biome = null; saveSettings(); }
  $('levelView').classList.add('hidden');
  $('biomePicker').classList.remove('hidden');
  renderLevelList();
  const panel = document.querySelector('#menu .panel');
  if (panel) panel.scrollTop = 0;
}

// ---------------------------------------------------------------- modes

const hideAll = (...ids) => ids.forEach((id) => $(id).classList.add('hidden'));
const show = (...ids) => ids.forEach((id) => $(id).classList.remove('hidden'));

function showMenu() {
  mode = 'menu';
  layoutStage();
  returnToEditor = false;
  replay = null;
  document.body.classList.remove('playing');
  sfx.silenceEngine();
  // Back to the world they were in, at the place in it they had scrolled
  // to. Someone stuck on level 17 should not have to find it again.
  const remembered = findBiome(settings.biome);
  if (remembered && !remembered.locked) openBiome(remembered.id);
  else closeBiome();
  renderer.fitScale();
  if (!demo) demo = new Demo(renderer, effects);
  show('menu');
  hideAll('hud', 'dialog', 'pause', 'editorBar', 'editorHint', 'startHint',
          'touch', 'touchTop', 'replayBadge', 'rideChoice');
  hideToast();
}

function startLevel(index, vehicleId = currentVehicle) {
  const entries = allLevels();
  if (!entries[index]) return;
  rememberBiomeScroll();
  currentIndex = index;
  currentVehicle = findVehicle(vehicleId).id;
  replay = null;
  sfx.ensure();
  renderer.fitScale();

  const level = new Level(entries[index].data);
  game.load(level, currentVehicle);
  game.setGhost(settings.ghost
    ? loadGhost(level, loadReplays()[recordKey(level.name, currentVehicle)])
    : null);

  mode = 'play';
  document.body.classList.add('playing');
  hideAll('menu', 'dialog', 'pause', 'editorBar', 'editorHint', 'replayBadge');
  show('hud', 'startHint', 'touch', 'touchTop');
  $('hudLevel').textContent = level.name;
  const best = loadTimes()[recordKey(level.name, currentVehicle)];
  $('hudBest').textContent = best === undefined ? 'inget rekord än' : 'bäst ' + formatTime(best);
  $('hudGhost').textContent = '';
  hideToast();
  applyFullscreenPreference();
}

// Plays back the stored record. Nothing is simulated live: the recording is
// re-run once up front and this just walks the resulting trajectory.
function startReplay(index, vehicleId = currentVehicle) {
  const entries = allLevels();
  const entry = entries[index];
  if (!entry) return;

  const level = new Level(entry.data);
  const ghost = loadGhost(level, loadReplays()[recordKey(entry.data.name, vehicleId)]);
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
  layoutStage();
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
  const isRecord = returnToEditor ? false : saveTime(name, time, currentVehicle);

  let replaySaved = false;
  if (isRecord) replaySaved = saveReplay(game.level, time, game.recorder, currentVehicle);
  const best = loadTimes()[recordKey(name, currentVehicle)];

  $('dialogTitle').textContent = isRecord ? 'Nytt rekord!' : 'Klarat!';
  $('dialogText').innerHTML =
    `<span class="result-time">${formatTime(time)}</span>` +
    (returnToEditor
      ? '<span class="fine">Testläge — tiden sparas inte.</span>'
      : isRecord
        ? '<span class="record-badge">personbästa</span>'
        : `<span class="fine">Ditt rekord: ${formatTime(best)}</span>`);

  // One per row, stacked. Four buttons wrapped across two lines put them
  // in an order nobody reads, and on a phone they were small targets in
  // the middle of the screen.
  const buttons = $('dialogButtons');
  buttons.innerHTML = '';
  if (returnToEditor) {
    addButton(buttons, '✏️', 'Till editorn', () => openEditor(editor.level));
    addButton(buttons, '🔄', 'Kör igen', restartRun, true);
  } else {
    const hasNext = currentIndex + 1 < entries.length;
    if (hasNext) addButton(buttons, '➡️', 'Nästa bana', () => startLevel(currentIndex + 1));
    addButton(buttons, '🔄', 'Kör igen', restartRun, hasNext);
    if (replaySaved || hasReplay(name, currentVehicle)) {
      addButton(buttons, '🎬', 'Se reprisen', () => startReplay(currentIndex, currentVehicle), true);
    }
    addButton(buttons, '🗺️', 'Banor', showMenu, true);
  }
  $('dialog').classList.remove('hidden');
}

function restartRun() {
  hideAll('dialog', 'pause');
  hideToast();
  game.restart();
  show('startHint');
}

// A row in the result list: an emoji, then two or three words. The emoji
// is the part a child remembers and aims at — "the green arrow one" — so
// every choice gets one, and the wording stays short enough to be read at
// a glance rather than puzzled over.
function addButton(parent, emoji, label, onClick, secondary = false) {
  const b = document.createElement('button');
  b.className = 'choice' + (secondary ? ' secondary' : '');
  b.innerHTML = `<span class="choice-ico" aria-hidden="true">${emoji}</span>` +
                `<span class="choice-text"><strong>${escapeHtml(label)}</strong></span>`;
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
  $('optFullscreen').checked = fullscreen.isActive();
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
}

// ------------------------------------------------------------ home screen

// `settings.launch` is 'app' or 'web', and undefined until the player has
// been asked. Only touch devices are asked: on a desktop a home screen icon
// buys nothing that the fullscreen button does not already give, so there is
// no choice worth interrupting anyone for.
function maybeShowWelcome() {
  if (settings.launch !== undefined) return;
  if (!document.body.classList.contains('touch')) return;
  // Already launched from the home screen: the question has answered itself.
  if (fullscreen.isStandalone()) { chooseLaunch('app'); return; }
  show('welcome');
}

function chooseLaunch(which) {
  settings.launch = which;
  saveSettings();
  hideAll('welcome');
}

// Chrome can open the real install dialog, and then a list of steps would
// only be in the way. Safari on iPhone cannot, so there the steps are the
// entire feature.
function openInstall() {
  hideAll('welcome');
  const native = homescreen.canPrompt();
  const wanted = homescreen.platform();
  document.querySelectorAll('#install .steps').forEach((list) => {
    list.classList.toggle('hidden', native || list.dataset.steps !== wanted);
  });
  $('installNow').classList.toggle('hidden', !native);
  // Only the browsers on iOS that cannot add to the home screen themselves
  // need help getting the address into one that can.
  $('copyLink').classList.toggle('hidden', native || wanted !== 'ios-other');
  show('install');
}

const installOpen = () => !$('install').classList.contains('hidden');
const welcomeOpen = () => !$('welcome').classList.contains('hidden');
const howtoOpen = () => !$('howto').classList.contains('hidden');
const physicsOpen = () => !$('physics').classList.contains('hidden');

// The how-to greeted every new player for a while and it was in the way.
// This is a game for children: they work it out by pressing things, which
// is more fun than being told. It stays behind the footer link for a
// parent who wants to read it.

// Launched from the home screen: the route worked. Nothing else in the game
// ever says so, and after following a list of steps in another app entirely
// the player deserves to be told the thing they did took.
// Launched from the home screen there is no browser chrome left to hide,
// so the fullscreen button is a button that does nothing. The menu toggle
// already hides itself; this takes the one in the corner of the game.
//
// It used to announce itself with a toast as well. It no longer does:
// opening without an address bar says it better than a sentence can, and
// the one thing the toast reliably managed was to land on top of whatever
// button was underneath it.
function confirmStandalone() {
  if (!fullscreen.isStandalone()) return;
  document.body.classList.add('standalone');
  if (settings.launch !== 'app') { settings.launch = 'app'; saveSettings(); }
  // The class decides how the stage is turned, so the decision has to be
  // taken again now that it is set.
  layoutStage();
}

// Nothing to offer once the game is already an app, or on a desktop.
function syncInstallUi() {
  const offer = document.body.classList.contains('touch') && !fullscreen.isStandalone();
  $('btnInstall').classList.toggle('hidden', !offer);
}

// Chrome decides we are installable after the page has loaded, which can
// land while the sheet is already open showing the manual steps.
window.addEventListener('bjorn:installable', () => {
  syncInstallUi();
  if (installOpen()) openInstall();
});
window.addEventListener('bjorn:installed', () => {
  settings.launch = 'app';
  saveSettings();
  hideAll('install');
  syncInstallUi();
  toast('Quick-Björn ligger nu bland dina appar.', 3000);
});

function setGhostEnabled(on) {
  settings.ghost = on;
  saveSettings();
  game.showGhost = on;
  $('optGhost').checked = on;
  if (on && mode === 'play' && !game.ghost && game.level) {
    game.setGhost(loadGhost(game.level,
      loadReplays()[recordKey(game.level.name, currentVehicle)]));
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
  // So are the welcome box and the install sheet.
  if (welcomeOpen()) {
    if (e.code === 'Escape') chooseLaunch('web');
    return;
  }
  if (installOpen()) {
    if (e.code === 'Escape') hideAll('install');
    return;
  }
  if (rideChoiceOpen()) {
    if (e.code === 'Escape') closeRideChoice();
    return;
  }
  if (howtoOpen()) {
    if (e.code === 'Escape' || e.code === 'Enter') hideAll('howto');
    return;
  }
  if (physicsOpen()) {
    if (e.code === 'Escape') hideAll('physics');
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
// A first touch from a device that never advertised a coarse pointer. The
// controls appear, which changes whether the stage should be turned.
window.addEventListener('touchstart', () => { enableTouchUI(); relayout(); },
  { once: true, passive: true });

const touchpad = new Touchpad({
  onPress: (code) => {
    sfx.ensure();
    game.keyDown(code);
    if (game.state === STATE.PLAYING) $('startHint').classList.add('hidden');
  },
  onRelease: (code) => game.keyUp(code),
  // The corner is the gear alone now. Restarting moved into its menu and
  // fullscreen left the phone entirely; both are still reachable, from
  // that menu and from the one in the main menu's footer.
  onAction: () => {
    if (mode === 'replay') { showMenu(); return; }
    setPaused(game.togglePause());
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

// The game is landscape, always. On a phone held upright we turn the stage
// a quarter turn rather than asking the player to turn the phone — see the
// CSS. Their rotation lock is usually on, which makes "vrid telefonen" an
// instruction they cannot follow.
const portrait = window.matchMedia
  ? matchMedia('(orientation: portrait)')
  : { matches: false, addEventListener() {} };

// The editor is the one holdout: it maps pointer coordinates straight onto
// an untransformed canvas, and a quarter turn would put every click in the
// wrong place. There the old gate still stands.
// How far the system has turned the viewport away from the device's
// natural orientation. iOS rotates a home-screen web app whatever the
// manifest asks, so this is how we find out and undo it.
function systemAngle() {
  const o = window.screen && window.screen.orientation;
  if (o && typeof o.angle === 'number') return ((o.angle % 360) + 360) % 360;
  if (typeof window.orientation === 'number') return ((window.orientation % 360) + 360) % 360;
  return portrait.matches ? 0 : 90;
}

function layoutStage() {
  const touch = document.body.classList.contains('touch');
  const fixed = document.body.classList.contains('standalone');
  let turn = 0;

  if (touch && mode !== 'editor') {
    if (fixed) {
      // Installed, the game behaves like a landscape-locked app: the
      // picture never moves on the glass. Turn the phone and the pixels
      // stay exactly where they were — you are the one who turned, not
      // the game. Undoing the system's own rotation is what achieves it,
      // and it is why the game can never end up in portrait.
      turn = (90 - systemAngle() + 360) % 360;
    } else if (portrait.matches) {
      // In a browser the chrome around us stays upright, so matching it
      // is the lesser evil: turn only when the viewport is portrait.
      turn = 90;
    }
  }

  for (const t of [0, 90, 180, 270]) {
    document.body.classList.toggle(`turn-${t}`, t === turn);
  }
  document.body.classList.toggle('sideways', turn === 90 || turn === 270);

  // Once turned a quarter, the stage is as tall as the viewport is wide.
  // No media query can see that, which is why the short-screen rules hang
  // off a class rather than off `max-height`.
  const quarter = turn === 90 || turn === 270;
  const stageHeight = quarter ? window.innerWidth : window.innerHeight;
  document.body.classList.toggle('short', stageHeight <= 470);
}

const orientationBlocked = () => document.body.classList.contains('touch')
  && portrait.matches
  && !document.body.classList.contains('sideways');

function handleOrientation() {
  if (!orientationBlocked()) return;
  touchpad.releaseAll();
  game.keys.clear();
  if (mode === 'play' && !game.paused) setPaused(game.togglePause());
}
portrait.addEventListener('change', relayout);
if (window.screen && window.screen.orientation && window.screen.orientation.addEventListener) {
  window.screen.orientation.addEventListener('change', relayout);
}

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

$('rideCancel').addEventListener('click', closeRideChoice);
$('btnBiomeBack').addEventListener('click', closeBiome);
$('btnEditor').addEventListener('click', () => openEditor(emptyLevel()));
$('btnImport').addEventListener('click', () => $('fileInput').click());
$('btnResume').addEventListener('click', () => { game.togglePause(); setPaused(false); });
$('btnPauseRestart').addEventListener('click', restartRun);
$('btnPauseMenu').addEventListener('click', () => { game.paused = false; leavePlay(); });
$('optGhost').addEventListener('change', (e) => setGhostEnabled(e.target.checked));
$('optFullscreen').addEventListener('change', toggleFullscreen);
$('wantApp').addEventListener('click', () => { chooseLaunch('app'); openInstall(); });
$('wantWeb').addEventListener('click', () => chooseLaunch('web'));
$('btnInstall').addEventListener('click', openInstall);
$('installClose').addEventListener('click', () => hideAll('install'));
// Getting the address into Safari, which is the one browser on an iPhone
// that can add to the home screen.
//
// This used to try to hand the page over directly with an `x-safari-`
// prefix. It does not work: Chrome on iOS answers it with "något gick fel,
// det gick inte att öppna appen", which is worse than no button at all.
// There is no supported way for a page to open another browser, so the
// best honest help is to put the address on the clipboard and say where to
// paste it.
//
// navigator.clipboard needs a secure context, which the LAN dev server is
// not, so fall back to the old textarea trick rather than failing there.
async function copyAddress() {
  const url = window.location.href;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const box = document.createElement('textarea');
    box.value = url;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, url.length);
    const ok = document.execCommand('copy');
    box.remove();
    return ok;
  } catch {
    return false;
  }
}

$('copyLink').addEventListener('click', async () => {
  const ok = await copyAddress();
  toast(ok
    ? 'Adressen är kopierad. Öppna Safari och klistra in den.'
    : 'Kopiera adressen högst upp i webbläsaren och klistra in den i Safari.', 5000);
});
$('btnHowto').addEventListener('click', () => show('howto'));
$('btnPhysics').addEventListener('click', () => show('physics'));
$('howtoClose').addEventListener('click', () => hideAll('howto'));
$('physicsClose').addEventListener('click', () => hideAll('physics'));
$('installNow').addEventListener('click', async () => {
  const accepted = await homescreen.prompt();
  hideAll('install');
  syncInstallUi();
  if (!accepted) toast('Ingen fara — knappen finns kvar uppe i menyn.', 3500);
});
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
  r.drawBike(pose, false, 'replay');
  r.drawOverlays(effects);

  $('hudTime').textContent = formatTime(replay.time * TIME_TO_CENTISECONDS);
  $('hudHives').textContent = replay.level.objects.filter(
    (o) => o.type === OBJ.APPLE && !o.taken
  ).length;
}

let lastFrame = performance.now();

// ------------------------------------------------------------ pedal feel

// The pedals carry the bike's own speed: the tread rolls at the rear
// wheel's pace and the throttle glows harder the faster it turns. Driven
// from the simulation rather than from a canned animation, so what the
// thumb sees is what the bike is doing — the tread even locks solid when
// the brake locks the wheels.
// Only the brake carries it. The throttle stays put: it is a button you
// push, not a readout.
//
// Measured rather than guessed: a wheel sits around 6 rad/s rolling along
// the flat and reaches the mid thirties running downhill or spinning free
// in the air, so the tread is capped short of that to stop it strobing.
const TREAD_PERIOD = 9;    // px; the gradient period in the stylesheet
const TREAD_PER_RAD = 3.5; // px of travel per radian of wheel rotation
const TREAD_CAP = 24;      // rad/s past which the tread stops speeding up

let tread = 0;

// The trailing wheel is the one the gas drives, so the leading one is the
// other, and which is which swaps every time the bike is flipped. See the
// gas branch in forces.js: flipped drives the left wheel.
const frontWheel = (motor) => (motor.flipped ? motor.rightWheel : motor.leftWheel);

function updatePedalFeel(dtSeconds) {
  if (!document.body.classList.contains('touch')) return;
  const motor = game.run && game.run.motor;
  // Forward is a negative angular velocity, and the tread should roll down
  // towards the rider as the bike pulls away.
  const spin = motor ? -frontWheel(motor).angularVelocity : 0;
  const capped = Math.max(-TREAD_CAP, Math.min(TREAD_CAP, spin));
  tread = (tread + capped * TREAD_PER_RAD * dtSeconds) % TREAD_PERIOD;
  $('touch').style.setProperty('--tread', tread.toFixed(2) + 'px');
}

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
    updatePedalFeel(dtMs / 1000);
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
  layoutStage();
  renderer.resize();
  // The editor has its own zoom, set by the user scrolling.
  if (mode !== 'editor') renderer.fitScale();
  handleOrientation();
}

window.addEventListener('resize', relayout);
window.addEventListener('orientationchange', relayout);
if (window.visualViewport) window.visualViewport.addEventListener('resize', relayout);
// Before the first layout, so an installed app is laid out as one from
// the very first call rather than being corrected a moment later.
confirmStandalone();
relayout();
applySettings();
syncInstallUi();
showMenu();
maybeShowWelcome();
requestAnimationFrame(frame);
