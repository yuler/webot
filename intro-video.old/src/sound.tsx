import type * as React from 'react';
import { Audio, interpolate, Sequence, staticFile } from 'remotion';

export type SfxName = 'click' | 'whoosh' | 'pop' | 'typing';

const SFX_VOLUME: Record<SfxName, number> = {
  click: 0.7,
  whoosh: 0.35,
  pop: 0.6,
  typing: 0.4,
};

export const Sfx: React.FC<{
  name: SfxName;
  at: number;
  duration?: number;
  volume?: number;
}> = ({ name, at, duration, volume = 1 }) => (
  <Sequence from={Math.round(at)} durationInFrames={duration ? Math.round(duration) : undefined} layout="none">
    <Audio src={staticFile(`audio/${name}.wav`)} volume={SFX_VOLUME[name] * volume} />
  </Sequence>
);

export const Music: React.FC<{ totalFrames: number }> = ({ totalFrames }) => (
  <Audio
    src={staticFile('audio/music.wav')}
    volume={(f) =>
      interpolate(f, [0, 25, totalFrames - 45, totalFrames], [0, 0.75, 0.75, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    }
  />
);
