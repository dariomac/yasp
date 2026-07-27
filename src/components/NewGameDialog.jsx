'use client';

// NewGameDialog — the modern equivalent of FrmNewSudokuGrid: pick a difficulty
// and a symmetry (grid shape), then generate.

import { useState } from 'react';
import { DIFFICULTY_LIST, SYMMETRY_LIST } from '@/lib/constants';

const DIFFICULTY_HINT = {
  easy: 'Singles only',
  medium: 'Locked candidates',
  hard: 'Pairs & X-Wing',
  extreme: 'Requires guessing',
};

export default function NewGameDialog({
  initialDifficulty,
  initialSymmetry,
  onGenerate,
  onClose,
  busy,
}) {
  const [difficulty, setDifficulty] = useState(initialDifficulty || 'easy');
  const [symmetry, setSymmetry] = useState(initialSymmetry || 'rotate180');

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="New game"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2>New puzzle</h2>
        <p className="dialogSub">
          Choose a difficulty and the symmetry of the givens.
        </p>

        <div className="sectionTitle">Difficulty</div>
        <div className="optionGroup">
          {DIFFICULTY_LIST.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`option ${difficulty === d.id ? 'selected' : ''}`}
              onClick={() => setDifficulty(d.id)}
            >
              {d.label}
              <small>{DIFFICULTY_HINT[d.id]}</small>
            </button>
          ))}
        </div>

        <div className="sectionTitle">Symmetry</div>
        <div className="optionGroup">
          {SYMMETRY_LIST.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`option ${symmetry === s.id ? 'selected' : ''}`}
              onClick={() => setSymmetry(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="dialogActions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => onGenerate(difficulty, symmetry)}
          >
            {busy ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
