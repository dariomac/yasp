// ---------------------------------------------------------------------------
// Domain constants — ported from SudokuDomain (Sudoku.cs, Repository.cs).
//
//   - DifficultyLevels  <- Sudoku.DifficultyLevels
//   - Symmetry (GridShapes) <- Sudoku.GridShapes
//
// The original graded difficulty by counting how many/which logical solving
// techniques a puzzle required (DlxSolver.diff1/diff2/diff3). We reproduce the
// same idea with a technique-ranked logical solver (see lib/solver.js).
// ---------------------------------------------------------------------------

export const SIZE = 9; // board is 9x9
export const BOX = 3; // 3x3 boxes
export const CELLS = SIZE * SIZE; // 81

// Difficulty tiers. `clues` bounds the number of givens the generator digs
// toward; `minTechnique`/`maxTechnique` are the band of "hardest technique
// required" that a puzzle must land in to grade into this tier — the modern
// equivalent of the DlxSolver diff1/diff2/diff3 difficulty band. Technique
// ranks come from solver.TECHNIQUES (Single=1, Locked=2, NakedPair=3,
// HiddenPair/Triple=4, X-Wing=6, Guess=10).
export const DIFFICULTY = {
  EASY: {
    id: 'easy',
    label: 'Easy',
    clues: [38, 50],
    minTechnique: 0,
    maxTechnique: 1, // solvable with singles alone
  },
  MEDIUM: {
    id: 'medium',
    label: 'Medium',
    clues: [30, 36],
    minTechnique: 2, // needs locked candidates / a naked pair
    maxTechnique: 3,
  },
  HARD: {
    id: 'hard',
    label: 'Hard',
    clues: [26, 32],
    minTechnique: 3, // needs at least a naked pair; up to X-Wing
    maxTechnique: 9,
  },
  EXTREME: {
    id: 'extreme',
    label: 'Extreme',
    clues: [22, 28],
    minTechnique: 10, // logic stalls — requires guessing / backtracking
    maxTechnique: 10,
  },
};

export const DIFFICULTY_LIST = [
  DIFFICULTY.EASY,
  DIFFICULTY.MEDIUM,
  DIFFICULTY.HARD,
  DIFFICULTY.EXTREME,
];

// Symmetry patterns — the shape formed by the givens.
// Ported from Sudoku.GridShapes (Shape180, ShapeMinus, ShapeSlash, Shape90,
// ShapePipe, ShapeRevSlash). Each maps a cell (r,c) to the set of cells that
// must share its "given/empty" status so the puzzle looks symmetric.
export const SYMMETRY = {
  ROTATE_180: { id: 'rotate180', label: 'Rotational 180°' },
  ROTATE_90: { id: 'rotate90', label: 'Rotational 90°' },
  HORIZONTAL: { id: 'horizontal', label: 'Horizontal (—)' },
  VERTICAL: { id: 'vertical', label: 'Vertical (|)' },
  DIAGONAL: { id: 'diagonal', label: 'Diagonal (\\)' },
  ANTIDIAGONAL: { id: 'antidiagonal', label: 'Anti-diagonal (/)' },
  NONE: { id: 'none', label: 'None' },
};

export const SYMMETRY_LIST = [
  SYMMETRY.ROTATE_180,
  SYMMETRY.ROTATE_90,
  SYMMETRY.HORIZONTAL,
  SYMMETRY.VERTICAL,
  SYMMETRY.DIAGONAL,
  SYMMETRY.ANTIDIAGONAL,
  SYMMETRY.NONE,
];

// Cell validation/display states — ported from WinSudoku SudokuCellStates.
export const CELL_STATE = {
  NORMAL: 'normal',
  GIVEN: 'given',
  TENTATIVE: 'tentative', // has pencil-mark candidates
  CONFLICT: 'conflict',
};
