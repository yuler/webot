import { Composition } from 'remotion';
import { Intro } from './Intro';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './theme';

export function Root() {
  return (
    <Composition
      id="Intro"
      component={Intro}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
