import type * as React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { color } from '../theme';

export interface ClickPoint {
  frame: number;
  x: number;
  y: number;
}

export interface CursorPathPoint {
  frame: number;
  x: number;
  y: number;
}

export const Cursor: React.FC<{
  path: CursorPathPoint[];
  clicks: ClickPoint[];
  visibleRange: [number, number];
}> = ({ path, clicks, visibleRange }) => {
  const frame = useCurrentFrame();

  if (frame < visibleRange[0] || frame > visibleRange[1]) return null;

  // Interpolate position along path
  const frames = path.map((p) => p.frame);
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);

  const x = interpolate(frame, frames, xs, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, frames, ys, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const isClicking = clicks.some((c) => Math.abs(frame - c.frame) <= 3);

  return (
    <>
      {/* Click ripples */}
      {clicks.map((c, i) => {
        const diff = frame - c.frame;
        if (diff < 0 || diff > 18) return null;
        const progress = diff / 18;
        const radius = 10 + 28 * progress;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: c.x - radius,
              top: c.y - radius,
              width: radius * 2,
              height: radius * 2,
              borderRadius: 999,
              border: `2px solid ${color.ink}`,
              opacity: (1 - progress) * 0.7,
              pointerEvents: 'none',
              zIndex: 999,
            }}
          />
        );
      })}

      {/* Mouse pointer */}
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x - 2,
          top: y - 2,
          transform: `scale(${isClicking ? 0.85 : 1})`,
          transformOrigin: '0 0',
          filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))',
          pointerEvents: 'none',
          zIndex: 1000,
          transition: 'transform 0.08s ease',
        }}
      >
        <path
          d="M5 2.5 L19.5 13.2 L12.6 14.1 L16.4 21 L13.3 22.6 L9.6 15.6 L5 20.5 Z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};
