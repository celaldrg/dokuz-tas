/**
 * The board on screen: SVG lines and points, pieces that slide, drop in and
 * fade out, and the highlights. Turns pointer and keyboard input into
 * callbacks; knows nothing about the rules. The static parts (gradients,
 * frame, centre motif) are in index.html, the colours in style.css.
 */
import { MILLS, POINTS, POINT_COUNT } from './board.js';
import { releaseAction, stepInDirection } from './view-model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Layout of the 700 x 700 viewBox: grid step and margin around the 7 x 7 grid. */
const STEP = 100;
const MARGIN = 50;
const PIECE_RADIUS = 34;
const HIT_RADIUS = 48;
/** Pointer travel, in CSS pixels, that turns a press into a drag. */
const DRAG_START = 8;
/** Animation lengths, matching style.css. */
const ENTER_MS = 240;
const LEAVE_MS = 250;
const LEAVE_DELAY_MS = 220;
const PLAYERS = ['white', 'black'];
const KEY_DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * Everything one drawing of the board needs.
 * @typedef {Object} BoardFrame
 * @property {(string|null)[]} board owner of every point
 * @property {string} turn player to act, for the hover preview
 * @property {string} phase phase of the player to act
 * @property {number[]} targets points to place or move on
 * @property {number[]} movable pieces that can move
 * @property {number[]} removable pieces that may be removed
 * @property {number|null} selected
 * @property {{from: number|null, to: number, remove: number|null}|null} lastMove
 * @property {{closed: number[], fresh: number[]}} mills indices into MILLS
 * @property {boolean} interactive whether the player to act uses this screen
 * @property {boolean} instant draw without animation
 * @property {(point: number) => string} label accessible name of a point
 */

/**
 * Callbacks of the board view.
 * @typedef {Object} BoardHandlers
 * @property {(point: number) => void} activate a point was tapped, clicked or chosen with Enter/Space
 * @property {() => void} cancel Esc was pressed on the board
 * @property {(point: number) => boolean} canDrag whether the piece on `point` may be dragged
 * @property {(point: number) => void} dragStart a drag began on `point`
 * @property {(from: number, to: number|null) => void} drop a dragged piece was let go over `to`
 */

/**
 * Draws the board into the <svg> of index.html and wires its input.
 * @param {SVGSVGElement} svg
 * @param {BoardHandlers} handlers
 * @returns {{update(frame: BoardFrame): void}}
 */
export function createBoardView(svg, handlers) {
  const layers = drawBoard(svg);
  const millPaths = MILLS.map((mill) => make('path', { class: 'mill-line', d: millPath(mill), pathLength: 1 }, layers.mills));
  const spots = POINTS.map((_, point) => createSpot(layers.spots, point));
  const pieces = new Map();
  let shown = new Array(POINT_COUNT).fill(null);
  let cursor = 4;
  let drag = null;
  spots[cursor].setAttribute('tabindex', '0');

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerCancel);
  svg.addEventListener('keydown', onKeyDown);
  svg.addEventListener('focusin', onFocusIn);

  function update(frame) {
    svg.dataset.turn = frame.turn;
    svg.dataset.phase = frame.phase;
    svg.classList.toggle('is-busy', !frame.interactive);
    syncPieces(frame.board, frame.instant);
    const trail = [frame.lastMove?.from, frame.lastMove?.remove].filter((point) => point != null);
    spots.forEach((spot, point) => {
      const empty = frame.board[point] === null;
      spot.classList.toggle('is-target', frame.targets.includes(point));
      spot.classList.toggle('is-movable', frame.movable.includes(point));
      spot.classList.toggle('is-selected', frame.selected === point);
      spot.classList.toggle('is-removable', frame.removable.includes(point));
      spot.classList.toggle('is-trail', empty && trail.includes(point));
      spot.setAttribute('aria-label', frame.label(point));
    });
    for (const [point, piece] of pieces) {
      piece.classList.toggle('is-selected', frame.selected === point);
      piece.classList.toggle('is-removable', frame.removable.includes(point));
    }
    millPaths.forEach((path, index) => {
      path.classList.toggle('is-closed', frame.mills.closed.includes(index));
      path.classList.toggle('is-fresh', frame.mills.fresh.includes(index));
    });
  }

  /** Brings the drawn pieces in line with `board`, animating moves, placements and removals. */
  function syncPieces(board, instant) {
    const moves = [];
    const leaving = [];
    const entering = [];
    for (const player of PLAYERS) {
      const gone = indices((point) => shown[point] === player && board[point] !== player);
      const came = indices((point) => board[point] === player && shown[point] !== player);
      if (gone.length === 1 && came.length === 1) moves.push([gone[0], came[0]]);
      else {
        leaving.push(...gone);
        entering.push(...came.map((point) => [player, point]));
      }
    }
    const movers = moves.map(([from, to]) => [pieces.get(from), to]);
    for (const [from] of moves) pieces.delete(from);
    for (const point of leaving) {
      removePiece(pieces.get(point), instant, moves.length > 0);
      pieces.delete(point);
    }
    for (const [piece, to] of movers) {
      slide(piece, to);
      pieces.set(to, piece);
    }
    for (const [player, point] of entering) pieces.set(point, createPiece(player, point, instant));
    shown = board.slice();
  }

  function createPiece(player, point, instant) {
    const piece = make('g', { class: `piece piece--${player}` }, layers.pieces);
    setPosition(piece, ...center(point));
    const body = make('g', { class: 'piece-body' }, piece);
    make('circle', { class: 'piece-shadow', r: PIECE_RADIUS + 7, cy: 6 }, body);
    make('circle', { class: 'disc', r: PIECE_RADIUS }, body);
    make('circle', { class: 'inlay', r: PIECE_RADIUS - 11 }, body);
    if (!instant) {
      piece.classList.add('is-entering');
      setTimeout(() => piece.classList.remove('is-entering'), ENTER_MS + 40);
    }
    return piece;
  }

  function removePiece(piece, instant, afterMove) {
    if (instant) {
      piece.remove();
      return;
    }
    piece.classList.add('is-leaving');
    piece.classList.toggle('is-delayed', afterMove);
    setTimeout(() => piece.remove(), LEAVE_MS + (afterMove ? LEAVE_DELAY_MS : 0) + 40);
  }

  /** Moves a piece on top of the others, then lets its transform transition to the new point. */
  function slide(piece, to) {
    if (piece !== layers.pieces.lastElementChild) {
      layers.pieces.appendChild(piece);
      // Re-inserting drops the computed style; read it back so the move still transitions.
      void getComputedStyle(piece).transform;
    }
    setPosition(piece, ...center(to));
  }

  function onPointerDown(event) {
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const point = pointAt(event);
    if (point === null) return;
    drag = { id: event.pointerId, from: point, x: event.clientX, y: event.clientY, moved: false, piece: null };
    svg.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < DRAG_START) return;
      drag.moved = true;
      if (pieces.has(drag.from) && handlers.canDrag(drag.from)) startDrag();
    }
    if (!drag.piece) return;
    const position = toBoard(event);
    if (position) setPosition(drag.piece, position.x, position.y);
    const over = pointAt(event);
    spots.forEach((spot, point) => spot.classList.toggle('is-drop', point === over));
  }

  function startDrag() {
    drag.piece = pieces.get(drag.from);
    drag.piece.classList.add('is-dragging');
    if (drag.piece !== layers.pieces.lastElementChild) layers.pieces.appendChild(drag.piece);
    handlers.dragStart(drag.from);
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const ended = drag;
    drag = null;
    const press = { from: ended.from, moved: ended.moved, dragging: ended.piece !== null };
    const release = releaseAction(press, pointAt(event));
    if (release.type === 'drop') endDrag(ended, release.to);
    else if (release.type === 'tap') handlers.activate(release.point);
  }

  function onPointerCancel(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const ended = drag;
    drag = null;
    if (ended.piece) endDrag(ended, null);
  }

  /** Hands the drop to the controller; a piece that did not move glides back home. */
  function endDrag({ piece, from }, to) {
    piece.classList.remove('is-dragging');
    spots.forEach((spot) => spot.classList.remove('is-drop'));
    handlers.drop(from, to);
    if (pieces.get(from) === piece) setPosition(piece, ...center(from));
  }

  function onKeyDown(event) {
    const direction = KEY_DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      moveCursor(stepInDirection(cursor, direction));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.activate(cursor);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handlers.cancel();
    }
  }

  function onFocusIn(event) {
    const spot = event.target.closest('.spot');
    if (spot) setCursor(Number(spot.dataset.point));
  }

  function moveCursor(point) {
    setCursor(point);
    spots[point].focus();
  }

  /** Roving tabindex: only the cursor point is in the tab order. */
  function setCursor(point) {
    spots[cursor].setAttribute('tabindex', '-1');
    cursor = point;
    spots[cursor].setAttribute('tabindex', '0');
  }

  function toBoard(event) {
    const matrix = svg.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }

  /** The point under the pointer, or null when it is not near one. */
  function pointAt(event) {
    const position = toBoard(event);
    if (!position) return null;
    let nearest = null;
    let nearestDistance = HIT_RADIUS;
    POINTS.forEach((_, point) => {
      const [x, y] = center(point);
      const distance = Math.hypot(x - position.x, y - position.y);
      if (distance <= nearestDistance) {
        nearest = point;
        nearestDistance = distance;
      }
    });
    return nearest;
  }

  return { update };
}

/** Adds the generated layers after the static content of the <svg>. */
function drawBoard(svg) {
  const lines = make('g', { class: 'lines' }, svg);
  for (const mill of MILLS) make('path', { d: millPath(mill) }, lines);
  const mills = make('g', { class: 'mills' }, svg);
  const dots = make('g', { class: 'dots' }, svg);
  POINTS.forEach((_, point) => {
    const [cx, cy] = center(point);
    make('circle', { cx, cy, r: 12 }, dots);
    make('circle', { class: 'dot-core', cx, cy, r: 4.5 }, dots);
  });
  const pieces = make('g', { class: 'pieces' }, svg);
  const spots = make('g', { class: 'spots' }, svg);
  return { mills, pieces, spots };
}

/** A focusable point: hit area, hover preview, target dot, rings and focus ring. */
function createSpot(layer, point) {
  const [x, y] = center(point);
  const spot = make('g', { class: 'spot', 'data-point': point, role: 'button', tabindex: -1, transform: `translate(${x} ${y})` }, layer);
  make('circle', { class: 'hit', r: HIT_RADIUS }, spot);
  make('circle', { class: 'ghost', r: PIECE_RADIUS }, spot);
  make('circle', { class: 'target', r: 13 }, spot);
  make('circle', { class: 'trail', r: PIECE_RADIUS - 8 }, spot);
  make('circle', { class: 'ring', r: PIECE_RADIUS + 7 }, spot);
  make('circle', { class: 'focus', r: HIT_RADIUS - 3 }, spot);
  return spot;
}

function center(point) {
  const [column, row] = POINTS[point];
  return [MARGIN + column * STEP, MARGIN + row * STEP];
}

function millPath(mill) {
  const [x1, y1] = center(mill[0]);
  const [x2, y2] = center(mill[mill.length - 1]);
  return `M${x1} ${y1}L${x2} ${y2}`;
}

function setPosition(piece, x, y) {
  piece.style.transform = `translate(${x}px, ${y}px)`;
}

function indices(test) {
  const result = [];
  for (let point = 0; point < POINT_COUNT; point += 1) if (test(point)) result.push(point);
  return result;
}

function make(name, attributes, parent) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  parent.appendChild(element);
  return element;
}
