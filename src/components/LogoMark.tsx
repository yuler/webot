import { useState } from "react";

/** Stroke paths for a geometric "W" monogram (K41-style bevel strokes). */
const STROKES = [
  { d: "M10 14L18 50", width: 6, delay: 0 },
  { d: "M18 50L32 22", width: 6, delay: 0.12 },
  { d: "M32 22L46 50", width: 6, delay: 0.24 },
  { d: "M46 50L54 14", width: 6, delay: 0.36 },
  // small "BOT" underline ticks — echo ClawBot without spelling a second brand
  { d: "M22 56H42", width: 3.5, delay: 0.5 },
];

/**
 * weBOT logo mark: geometric "W" drawn with strokes only (no fonts),
 * painted with `currentColor` so it follows light/dark ink.
 * Strokes draw in on mount and again on hover (same pattern as yuler/k41 LogoMark).
 */
export function LogoMark({
  className,
  title = "weBOT",
}: {
  className?: string;
  title?: string;
}) {
  const [playCount, setPlayCount] = useState(0);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
      onMouseEnter={() => setPlayCount((n) => n + 1)}
    >
      <g
        key={playCount}
        className="webot-logo"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeLinejoin="bevel"
      >
        {STROKES.map((s) => (
          <path
            key={s.d}
            d={s.d}
            strokeWidth={s.width}
            pathLength={1}
            style={{ animationDelay: `${s.delay}s` }}
          />
        ))}
      </g>
    </svg>
  );
}
