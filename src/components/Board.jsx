'use client';

// Board + Cell — the modern equivalent of WinSudoku's SudokuGrid / SudokuCell.
// Renders the 9x9 grid, highlights the selected cell, its peers (row/col/box),
// cells sharing the selected value, conflicts, pencil marks, and hint targets.

import { CELLS } from '@/lib/constants';
import { rowOf, colOf, PEERS } from '@/lib/grid';

export default function Board({
  board,
  givens,
  pencils,
  selected,
  conflicts,
  hintTargets,
  solved,
  onSelect,
}) {
  const selValue = selected != null ? board[selected] : 0;
  const peerSet = selected != null ? new Set(PEERS[selected]) : new Set();
  const hintSet = new Set(hintTargets || []);

  return (
    <div className="board" role="grid" aria-label="Sudoku board">
      {Array.from({ length: CELLS }, (_, i) => {
        const r = rowOf(i);
        const c = colOf(i);
        const value = board[i];
        const isGiven = givens[i];
        const isSelected = selected === i;
        const isPeer = !isSelected && peerSet.has(i);
        const isSame =
          !isSelected && selValue !== 0 && value === selValue;
        const isConflict = conflicts.has(i);
        const classes = ['cell'];
        if (c % 3 === 2) classes.push('boxRight');
        if (r % 3 === 2) classes.push('boxBottom');
        if (isGiven) classes.push('given');
        if (isPeer) classes.push('peer');
        if (isSame) classes.push('sameValue');
        if (isSelected) classes.push('selected');
        if (isConflict) classes.push('conflict');
        if (hintSet.has(i)) classes.push('hintTarget');
        if (solved) classes.push('solvedFlash');

        return (
          <button
            key={i}
            type="button"
            className={classes.join(' ')}
            onClick={() => onSelect(i)}
            aria-label={`row ${r + 1} column ${c + 1}${
              value ? `, value ${value}` : ', empty'
            }`}
            role="gridcell"
          >
            {value !== 0 ? (
              value
            ) : pencils[i] && pencils[i].length ? (
              <span className="pencil">
                {Array.from({ length: 9 }, (_, k) => {
                  const d = k + 1;
                  return (
                    <span
                      key={d}
                      className={pencils[i].includes(d) ? 'mark' : ''}
                    >
                      {pencils[i].includes(d) ? d : ''}
                    </span>
                  );
                })}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
