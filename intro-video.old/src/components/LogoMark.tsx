import type * as React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

const STROKES = [
  { d: 'M18 2H28V11H18Z', width: 3, delay: 0, len: 38 },
  { d: 'M23 11V19', width: 3, delay: 3, len: 12 },
  { d: 'M5 19H42V46H24L8 58L16 46H5Z', width: 3.25, delay: 6, len: 140 },
  { d: 'M34 8H56V22H46L54 30L44 22H34Z', width: 3.25, delay: 12, len: 80 },
];

const EYES = ['M12 29H19V36H12Z', 'M25 29H32V36H25Z'];

export const LogoMark: React.FC<{ size?: number; color?: string; delay?: number }> = ({
  size = 48,
  color = '#f1f5f9',
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      style={{ overflow: 'visible', verticalAlign: 'middle' }}
    >
      <g fill="none" stroke={color} strokeLinecap="square" strokeLinejoin="miter">
        {STROKES.map((s, i) => {
          const p = spring({
            frame: frame - delay - s.delay,
            fps,
            config: { damping: 16, stiffness: 120 },
          });
          const clamped = Math.min(1, Math.max(0, p));
          return (
            <path
              key={i}
              d={s.d}
              strokeWidth={s.width}
              strokeDasharray={s.len}
              strokeDashoffset={s.len * (1 - clamped)}
            />
          );
        })}
        {EYES.map((d, i) => {
          const eyeSpring = spring({
            frame: frame - delay - 18 - i * 3,
            fps,
            config: { damping: 12, stiffness: 140 },
          });
          return (
            <path
              key={i}
              d={d}
              fill={color}
              stroke="none"
              style={{
                opacity: eyeSpring,
                transform: `scale(${eyeSpring})`,
                transformOrigin: '20px 32px',
              }}
            />
          );
        })}
      </g>
    </svg>
  );
};
