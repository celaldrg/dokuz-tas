import test from 'node:test';
import assert from 'node:assert/strict';
import { MILLS, MILLS_AT, NEIGHBORS, POINTS, POINT_COUNT, pointName } from '../src/board.js';

// Written out by hand from the drawn board (see the diagram in src/board.js).
const EXPECTED_MILLS = [
  // outer square
  [0, 1, 2], [2, 14, 23], [21, 22, 23], [0, 9, 21],
  // middle square
  [3, 4, 5], [5, 13, 20], [18, 19, 20], [3, 10, 18],
  // inner square
  [6, 7, 8], [8, 12, 17], [15, 16, 17], [6, 11, 15],
  // the four lines joining the squares
  [1, 4, 7], [9, 10, 11], [12, 13, 14], [16, 19, 22],
];

const EXPECTED_NEIGHBORS = [
  [1, 9], [0, 2, 4], [1, 14],
  [4, 10], [1, 3, 5, 7], [4, 13],
  [7, 11], [4, 6, 8], [7, 12],
  [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23],
  [11, 16], [15, 17, 19], [12, 16],
  [10, 19], [16, 18, 20, 22], [13, 19],
  [9, 22], [19, 21, 23], [14, 22],
];

const asSortedKeys = (lines) => lines.map((line) => [...line].sort((a, b) => a - b).join('-')).sort();

test('the board has 24 distinct points on a 7x7 grid', () => {
  assert.equal(POINT_COUNT, 24);
  assert.equal(POINTS.length, 24);
  assert.equal(new Set(POINTS.map(([x, y]) => `${x},${y}`)).size, 24);
  for (const [x, y] of POINTS) {
    assert.ok(x >= 0 && x <= 6 && y >= 0 && y <= 6);
  }
});

test('there are exactly 16 mills and they are the expected lines', () => {
  assert.equal(MILLS.length, 16);
  assert.equal(new Set(asSortedKeys(MILLS)).size, 16);
  assert.deepEqual(asSortedKeys(MILLS), asSortedKeys(EXPECTED_MILLS));
});

test('every mill is a straight, evenly spaced line of three points', () => {
  for (const [a, b, c] of MILLS) {
    const [first, middle, last] = [POINTS[a], POINTS[b], POINTS[c]];
    assert.ok(first[0] === last[0] || first[1] === last[1], `mill ${a}-${b}-${c} is not straight`);
    assert.deepEqual([first[0] + last[0], first[1] + last[1]], [2 * middle[0], 2 * middle[1]]);
  }
});

test('every point lies on exactly one horizontal and one vertical mill', () => {
  for (let point = 0; point < POINT_COUNT; point += 1) {
    const mills = MILLS.filter((mill) => mill.includes(point));
    assert.deepEqual(mills, [...MILLS_AT[point]]);
    assert.equal(mills.length, 2);
    const horizontal = mills.filter((mill) => POINTS[mill[0]][1] === POINTS[mill[2]][1]);
    assert.equal(horizontal.length, 1, `point ${point}`);
  }
});

test('adjacency is symmetric and every point has 2 to 4 neighbours', () => {
  let segments = 0;
  NEIGHBORS.forEach((neighbors, point) => {
    assert.ok(neighbors.length >= 2 && neighbors.length <= 4, `point ${point}`);
    assert.ok(!neighbors.includes(point));
    for (const other of neighbors) {
      assert.ok(NEIGHBORS[other].includes(point), `${point} -> ${other} is one-way`);
      segments += 1;
    }
  });
  assert.equal(segments / 2, 32);
});

test('neighbours match the drawn board and share a row or a column', () => {
  assert.deepEqual(NEIGHBORS.map((list) => [...list]), EXPECTED_NEIGHBORS);
  NEIGHBORS.forEach((neighbors, point) => {
    for (const other of neighbors) {
      const [a, b] = [POINTS[point], POINTS[other]];
      assert.ok(a[0] === b[0] || a[1] === b[1]);
    }
  });
});

test('the geometry tables are read-only', () => {
  assert.ok(Object.isFrozen(MILLS) && Object.isFrozen(MILLS[0]));
  assert.ok(Object.isFrozen(NEIGHBORS) && Object.isFrozen(NEIGHBORS[0]));
  assert.ok(Object.isFrozen(POINTS) && Object.isFrozen(MILLS_AT[0]));
});

test('points have algebraic names from a7 to g1', () => {
  assert.equal(pointName(0), 'a7');
  assert.equal(pointName(4), 'd6');
  assert.equal(pointName(11), 'c4');
  assert.equal(pointName(12), 'e4');
  assert.equal(pointName(23), 'g1');
  const names = POINTS.map((_, point) => pointName(point));
  assert.equal(new Set(names).size, 24);
  assert.ok(names.every((name) => /^[a-g][1-7]$/.test(name)));
});
