// ---------------------------------------------------------------------------
// Grid model & geometry helpers.
//
// Ported from SudokuDomain.GridLogic (StringToGrid / GridToString) plus the
// row / column / box "unit" and "peer" geometry that the WinSudoku Strategies
// class computed inline (GetXSquareCorner / GetYSquareCorner / CheckContraints).
//
// A board is represented as a flat Int-like array of length 81. 0 == empty.
// Index = row * 9 + col.
// ---------------------------------------------------------------------------

import { SIZE, BOX, CELLS } from './constants.js';

export function emptyBoard() {
  return new Array(CELLS).fill(0);
}

// GridLogic.StringToGrid — "0053..." (81 chars) -> number[81].
export function stringToGrid(str) {
  const grid = emptyBoard();
  for (let i = 0; i < Math.min(str.length, CELLS); i++) {
    const ch = str[i];
    const n = ch >= '1' && ch <= '9' ? Number(ch) : 0;
    grid[i] = n;
  }
  return grid;
}

// GridLogic.GridToString — number[81] -> "0053...".
export function gridToString(grid) {
  return grid.map((n) => (n >= 1 && n <= 9 ? String(n) : '0')).join('');
}

export const rc = (r, c) => r * SIZE + c;
export const rowOf = (i) => Math.floor(i / SIZE);
export const colOf = (i) => i % SIZE;
export const boxOf = (i) =>
  Math.floor(rowOf(i) / BOX) * BOX + Math.floor(colOf(i) / BOX);

// Top-left corner of the 3x3 box containing (r,c) — mirrors
// GetXSquareCorner / GetYSquareCorner.
export const boxCornerRow = (r) => r - (r % BOX);
export const boxCornerCol = (c) => c - (c % BOX);

// Precompute the 27 units (9 rows, 9 cols, 9 boxes) and the peer set of every
// cell (the 20 cells that share a row, column, or box with it). This is the
// classic constraint structure the DLX exact-cover matrix encoded.
function buildUnits() {
  const units = [];
  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push(rc(r, c));
    units.push(row);
  }
  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = 0; r < SIZE; r++) col.push(rc(r, c));
    units.push(col);
  }
  for (let br = 0; br < SIZE; br += BOX) {
    for (let bc = 0; bc < SIZE; bc += BOX) {
      const box = [];
      for (let r = 0; r < BOX; r++)
        for (let c = 0; c < BOX; c++) box.push(rc(br + r, bc + c));
      units.push(box);
    }
  }
  return units;
}

export const UNITS = buildUnits();

// For each cell, the list of units it belongs to (its row, col, box).
export const UNITS_OF = (() => {
  const map = Array.from({ length: CELLS }, () => []);
  UNITS.forEach((unit) => {
    unit.forEach((cell) => {
      map[cell].push(unit);
    });
  });
  return map;
})();

// For each cell, its 20 peers.
export const PEERS = (() => {
  const peers = Array.from({ length: CELLS }, () => new Set());
  for (let i = 0; i < CELLS; i++) {
    UNITS_OF[i].forEach((unit) => {
      unit.forEach((cell) => {
        if (cell !== i) peers[i].add(cell);
      });
    });
  }
  return peers.map((s) => Array.from(s));
})();

// True if placing `value` at `index` breaks no row/col/box constraint.
export function isPlacementValid(grid, index, value) {
  if (value === 0) return true;
  for (const p of PEERS[index]) {
    if (grid[p] === value) return false;
  }
  return true;
}

export function cloneBoard(grid) {
  return grid.slice();
}
