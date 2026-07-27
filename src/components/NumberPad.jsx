'use client';

// NumberPad — click-to-enter digits. Shows how many of each digit remain, and
// disables a digit once all nine are placed.

export default function NumberPad({ counts, onInput, disabled }) {
  return (
    <div className="numpad">
      {Array.from({ length: 9 }, (_, k) => {
        const d = k + 1;
        const remaining = 9 - (counts[d] || 0);
        return (
          <button
            key={d}
            type="button"
            className="numBtn"
            onClick={() => onInput(d)}
            disabled={disabled || remaining <= 0}
            aria-label={`Enter ${d}, ${remaining} remaining`}
          >
            {d}
            <span className="count">{remaining > 0 ? remaining : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
