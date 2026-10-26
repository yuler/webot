import { useState } from "react";

/**
 * WeBot mark: square robot head (antenna + eyes) drawn as the large
 * WeChat bubble, with the smaller bubble at the upper right.
 * Right angles only, currentColor, strokes draw in on mount and hover.
 */
const STROKES = [
  { d: "M17 2H27V11H17Z", width: 3.5, delay: 0 },
  { d: "M22 11V18", width: 3.5, delay: 0.08 },
  { d: "M4 18H40V44H20V56H8V44H4Z", width: 3.5, delay: 0.16 },
  { d: "M44 4H60V18H52V28H44Z", width: 3.5, delay: 0.32 },
];

const EYES = ["M12 28H19V35H12Z", "M26 28H33V35H26Z"];

export function LogoMark({
  className,
  title = "WeBot",
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
        strokeLinejoin="miter"
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
        {EYES.map((d) => (
          <path key={d} d={d} fill="currentColor" stroke="none" />
        ))}
      </g>
    </svg>
  );
}
