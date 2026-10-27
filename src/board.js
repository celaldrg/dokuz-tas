/**
 * Board geometry of Dokuz Taş (nine men's morris): 24 points on three
 * concentric squares joined at the middle of each side.
 *
 * Points are numbered row by row from the top-left corner:
 *
 *    0 ------------ 1 ------------ 2
 *    |              |              |
 *    |    3 ------- 4 ------- 5    |
 *    |    |         |         |    |
 *    |    |    6 -- 7 -- 8    |    |
 *    |    |    |         |    |    |
 *    9 -- 10 - 11        12 - 13 - 14
 *    |    |    |         |    |    |
 *    |    |    15 - 16 - 17   |    |
 *    |    |         |         |    |
 *    |    18 ------ 19 ------ 20   |
 *    |              |              |
 *    21 ----------- 22 ----------- 23
 */

/** Number of points on the board. */
export const POINT_COUNT = 24;

/** Grid position [column, row] of every point on a 7 x 7 lattice; row 0 is the top. */
export const POINTS = freezeRows([
  [0, 0], [3, 0], [6, 0],
  [1, 1], [3, 1], [5, 1],
  [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4],
  [1, 5], [3, 5], [5, 5],
  [0, 6], [3, 6], [6, 6],
]);

/** The 16 mills: every straight line of three joined points, in order along the line. */
export const MILLS = freezeRows([
  [0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11],
  [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23],
  [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7],
  [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23],
]);

/** For every point, the two mills that run through it. */
export const MILLS_AT = Object.freeze(
  POINTS.map((_, point) => Object.freeze(MILLS.filter((mill) => mill.includes(point)))),
);

/** For every point, its neighbours (points joined to it by one segment), ascending. */
export const NEIGHBORS = Object.freeze(
  POINTS.map((_, point) => Object.freeze(neighborsOf(point))),
);

const FILES = 'abcdefg';

/**
 * Algebraic name of a point as used in morris notation: columns a-g from the
 * left, rows 1-7 from the bottom (0 -> "a7", 23 -> "g1").
 * @param {number} point index 0-23
 * @returns {string}
 */
export function pointName(point) {
  const [column, row] = POINTS[point];
  return `${FILES[column]}${7 - row}`;
}

/** Consecutive points of a mill are joined by a segment, so neighbours come from the mills. */
function neighborsOf(point) {
  const result = [];
  for (const mill of MILLS) {
    const index = mill.indexOf(point);
    if (index > 0) result.push(mill[index - 1]);
    if (index >= 0 && index < mill.length - 1) result.push(mill[index + 1]);
  }
  return result.sort((a, b) => a - b);
}

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}
