/**
 * Entry point: connects the game, the board view, the computer player, the
 * settings and the language toggle to the page. `?demo` opens a fixed
 * mid-game position (used for the README screenshot).
 */
import { createAiClient } from './ai-client.js';
import { createBoardView } from './board-view.js';
import { createDemoGame, createGame } from './game.js';
import { normalizeLanguage, otherLanguage, translate, translateList } from './i18n.js';
import { BLACK, WHITE, opponent } from './rules.js';
import { load, save } from './storage.js';
import {
  canUndo,
  describePoint,
  describeResult,
  describeStatus,
  dropAction,
  highlights,
  millHighlights,
  tapAction,
} from './view-model.js';

const CHOICES = Object.freeze({ mode: ['ai', 'two'], level: ['easy', 'medium', 'hard'], color: [WHITE, BLACK] });
const DEFAULT_SETTINGS = Object.freeze({ mode: 'ai', level: 'medium', color: WHITE });
/** Shortest pause before the computer moves, so its move is easy to follow. */
const AI_PAUSE_MS = 450;
const HINT_MS = 2400;
const DEMO_SEED = 20261027;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isDemo = new URLSearchParams(window.location.search).has('demo');
const dom = queryElements();
const ai = createAiClient();
const ui = {
  lang: normalizeLanguage(load('lang', 'en')),
  settings: isDemo ? { ...DEFAULT_SETTINGS } : loadSettings(),
  game: isDemo ? createDemoGame() : createGame(),
  seed: isDemo ? DEMO_SEED : randomSeed(),
  selected: null,
  selectedBeforeDrag: false,
  thinking: false,
  aiToken: 0,
  hint: null,
  hintTimer: 0,
  resultHidden: false,
  drawn: false,
};
const view = createBoardView(dom.board, { activate, cancel: clearSelection, canDrag, dragStart, drop });

wireControls();
applyLanguage();
afterChange();

function t(key, params) {
  return translate(ui.lang, key, params);
}

function aiPlayer() {
  return ui.settings.mode === 'ai' ? opponent(ui.settings.color) : null;
}

/* ---------- player input ---------- */

function activate(point) {
  const state = ui.game.getState();
  if (state.result) return;
  if (state.turn === aiPlayer()) {
    showHint('hintWait');
    return;
  }
  const action = tapAction(state, ui.selected, point);
  if (action.type === 'hint') showHint(action.hint);
  else perform(action);
}

function perform(action) {
  clearHint();
  if (action.type === 'select' || action.type === 'deselect') {
    ui.selected = action.type === 'select' ? action.point : null;
    render();
    return;
  }
  if (action.type === 'place') ui.game.step(null, action.point);
  else if (action.type === 'move') ui.game.step(action.from, action.to);
  else if (action.type === 'remove') ui.game.remove(action.point);
  else return;
  ui.selected = null;
  afterChange();
}

function canDrag(point) {
  const state = ui.game.getState();
  if (state.result || state.turn === aiPlayer()) return false;
  return highlights(state, null).movable.includes(point);
}

function dragStart(point) {
  clearHint();
  ui.selectedBeforeDrag = ui.selected === point;
  ui.selected = point;
  render();
}

function drop(from, to) {
  perform(dropAction(ui.game.getState(), from, to, ui.selectedBeforeDrag));
}

function clearSelection() {
  if (ui.selected === null) return;
  ui.selected = null;
  render();
}

/* ---------- game flow ---------- */

function newGame() {
  cancelComputer();
  ui.game = createGame();
  ui.seed = randomSeed();
  resetInteraction();
  afterChange();
}

/** Takes back the last move, and against the computer its reply too, so it is the human's turn again. */
function undo() {
  const computer = aiPlayer();
  if (!canUndo(ui.game.getState(), computer)) return;
  cancelComputer();
  ui.game.undo();
  while (computer !== null && ui.game.getState().turn === computer && ui.game.canUndo()) ui.game.undo();
  resetInteraction();
  afterChange();
}

function afterChange() {
  render();
  runComputer();
}

async function runComputer() {
  const state = ui.game.getState();
  if (ui.thinking || state.result || state.pending || state.turn !== aiPlayer()) return;
  ui.thinking = true;
  const token = ui.aiToken;
  const seed = (ui.seed + state.moveCount * 7919) >>> 0;
  const pause = reducedMotion.matches ? 0 : AI_PAUSE_MS;
  const [move] = await Promise.all([ai.choose(state, { level: ui.settings.level, seed }), wait(pause)]);
  if (token !== ui.aiToken) return;
  ui.thinking = false;
  if (move && ui.game.play(move)) afterChange();
}

function cancelComputer() {
  ui.aiToken += 1;
  ui.thinking = false;
  ai.cancel();
}

function resetInteraction() {
  ui.selected = null;
  ui.resultHidden = false;
  clearHint();
}

function showHint(key) {
  clearHint();
  ui.hint = key;
  render();
  ui.hintTimer = setTimeout(() => {
    ui.hint = null;
    render();
  }, HINT_MS);
}

function clearHint() {
  clearTimeout(ui.hintTimer);
  ui.hint = null;
}

/* ---------- drawing ---------- */

function render() {
  const state = ui.game.getState();
  const computer = aiPlayer();
  const humanTurn = !state.result && state.turn !== computer;
  if (!humanTurn) ui.selected = null;
  const marks = humanTurn ? highlights(state, ui.selected) : { targets: [], movable: [], removable: [] };
  view.update({
    ...marks,
    board: state.board,
    turn: state.turn,
    phase: state.phase,
    selected: ui.selected,
    lastMove: state.pending ? { ...state.pending, remove: null } : state.lastMove,
    mills: millHighlights(state),
    interactive: humanTurn,
    instant: !ui.drawn || reducedMotion.matches,
    label: (point) => pointLabel(state.board, marks, point),
  });
  ui.drawn = true;
  renderStatus(state, computer);
  renderPlayers(state, computer);
  renderResult(state, computer);
  dom.undo.disabled = !canUndo(state, computer);
}

function renderStatus(state, computer) {
  let line;
  if (state.result) {
    const result = describeResult(state.result, computer);
    line = {
      disc: state.result.winner ?? 'draw',
      actor: t(result.title),
      action: t(result.reason, { loser: result.loser ? t(result.loser) : '' }),
      phase: t('phaseOver'),
      tone: 'over',
    };
  } else {
    const status = describeStatus(state, computer, ui.selected);
    line = {
      disc: state.turn,
      actor: t(status.actor),
      action: t(status.action, { piece: status.piece ? t(status.piece) : '' }),
      phase: t(status.phase),
      tone: status.tone,
    };
  }
  if (ui.hint) {
    line.action = t(ui.hint);
    line.tone = 'hint';
  }
  dom.statusDisc.className = `status-disc is-${line.disc}`;
  dom.statusActor.textContent = line.actor;
  dom.statusAction.textContent = line.action;
  dom.phaseChip.textContent = line.phase;
  dom.status.dataset.tone = line.tone;
}

function renderPlayers(state, computer) {
  for (const player of [WHITE, BLACK]) {
    const card = dom.players[player];
    const inHand = state.inHand[player];
    const onBoard = state.onBoard[player];
    card.root.classList.toggle('is-active', !state.result && state.turn === player);
    card.root.classList.toggle('is-winner', state.result?.winner === player);
    card.role.textContent = computer === null ? '' : t(player === computer ? 'computer' : 'you');
    card.hand.textContent = String(inHand);
    card.onBoard.textContent = String(onBoard);
    card.tally.forEach((dot, index) => {
      dot.className = index < onBoard ? 'is-board' : index < onBoard + inHand ? 'is-hand' : 'is-lost';
    });
  }
}

function renderResult(state, computer) {
  const show = state.result !== null && !ui.resultHidden;
  if (show) {
    const result = describeResult(state.result, computer);
    dom.resultTitle.textContent = t(result.title);
    dom.resultReason.textContent = t(result.reason, { loser: result.loser ? t(result.loser) : '' });
  }
  const appearing = show && dom.result.hidden;
  dom.result.hidden = !show;
  if (appearing && dom.board.contains(document.activeElement)) dom.playAgain.focus();
}

function pointLabel(board, marks, point) {
  return describePoint(board, marks, ui.selected, point)
    .map(({ key, params }) => t(key, params))
    .join(', ');
}

/* ---------- language, settings, controls ---------- */

function applyLanguage() {
  document.documentElement.lang = ui.lang;
  document.title = t('docTitle');
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nLabel));
  }
  fillList(dom.rulesList, translateList(ui.lang, 'rulesList'));
  fillList(dom.controlsList, translateList(ui.lang, 'controlsList'));
}

function toggleLanguage() {
  ui.lang = otherLanguage(ui.lang);
  save('lang', ui.lang);
  applyLanguage();
  render();
}

function loadSettings() {
  const stored = load('settings', null);
  const settings = { ...DEFAULT_SETTINGS };
  for (const [name, values] of Object.entries(CHOICES)) {
    if (stored && values.includes(stored[name])) settings[name] = stored[name];
  }
  return settings;
}

/**
 * Level changes apply to the next computer move; mode and colour start a new game.
 * The demo page starts from the defaults, so it never overwrites the stored settings.
 */
function changeSetting(name, value) {
  if (!CHOICES[name]?.includes(value)) return;
  ui.settings = { ...ui.settings, [name]: value };
  if (!isDemo) save('settings', ui.settings);
  syncSettingsForm();
  if (name !== 'level') newGame();
}

function syncSettingsForm() {
  for (const [name, value] of Object.entries(ui.settings)) dom.settings.elements[name].value = value;
  const twoPlayers = ui.settings.mode === 'two';
  dom.levelGroup.disabled = twoPlayers;
  dom.colorGroup.disabled = twoPlayers;
}

function wireControls() {
  dom.newGame.addEventListener('click', newGame);
  dom.playAgain.addEventListener('click', newGame);
  dom.undo.addEventListener('click', undo);
  dom.langToggle.addEventListener('click', toggleLanguage);
  dom.rulesOpen.addEventListener('click', openRules);
  dom.rulesDialog.addEventListener('click', (event) => {
    if (event.target === dom.rulesDialog) dom.rulesDialog.close();
  });
  dom.result.addEventListener('click', (event) => {
    if (event.target === dom.result) hideResult();
  });
  dom.settings.addEventListener('change', (event) => changeSetting(event.target.name, event.target.value));
  dom.settings.addEventListener('submit', (event) => event.preventDefault());
  document.addEventListener('keydown', onShortcut);
  syncSettingsForm();
}

/** Opens the rules at the top (title focused), even if they were scrolled down last time. */
function openRules() {
  dom.rulesDialog.showModal();
  dom.rulesDialog.scrollTop = 0;
}

function hideResult() {
  ui.resultHidden = true;
  render();
}

function onShortcut(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (dom.rulesDialog.open) return;
  if (event.target instanceof Element && event.target.closest('input, select, textarea')) return;
  const key = (event.key ?? '').toLowerCase();
  if (key === 'u') undo();
  else if (key === 'n') newGame();
  else if (key === 'escape' && !dom.result.hidden) hideResult();
  else if (key === 'escape') clearSelection();
  else return;
  event.preventDefault();
}

/* ---------- helpers ---------- */

function queryElements() {
  const byId = (id) => document.getElementById(id);
  const player = (color) => ({
    root: byId(`player-${color}`),
    role: byId(`role-${color}`),
    hand: byId(`hand-${color}`),
    onBoard: byId(`onboard-${color}`),
    tally: [...byId(`tally-${color}`).children],
  });
  return {
    board: byId('board'),
    status: byId('status'),
    statusDisc: byId('status-disc'),
    statusActor: byId('status-actor'),
    statusAction: byId('status-action'),
    phaseChip: byId('phase-chip'),
    result: byId('result'),
    resultTitle: byId('result-title'),
    resultReason: byId('result-reason'),
    playAgain: byId('play-again'),
    newGame: byId('new-game'),
    langToggle: byId('lang-toggle'),
    undo: byId('undo'),
    rulesOpen: byId('rules-open'),
    rulesDialog: byId('rules-dialog'),
    rulesList: byId('rules-list'),
    controlsList: byId('controls-list'),
    settings: byId('settings'),
    levelGroup: byId('level-group'),
    colorGroup: byId('color-group'),
    players: { [WHITE]: player(WHITE), [BLACK]: player(BLACK) },
  };
}

function fillList(list, items) {
  list.replaceChildren(
    ...items.map((text) => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }),
  );
}

function randomSeed() {
  return window.crypto.getRandomValues(new Uint32Array(1))[0];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
