import type * as React from 'react';
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font, TOTAL_FRAMES } from './theme';
import { Steps } from './components/Steps';
import { Subtitles } from './components/Subtitles';
import { BrowserMockup } from './components/BrowserMockup';
import { PhoneMockup } from './components/PhoneMockup';
import { Cursor, type ClickPoint, type CursorPathPoint } from './components/Cursor';
import { LogoMark } from './components/LogoMark';
import { Music, Sfx } from './sound';

// Camera keyframes: [frame, centerX, centerY, zoom]
const CAMERA_TRACK: [number, number, number, number][] = [
  // Step 1: Focus on Login Card
  [0, 500, 530, 1.35],
  [145, 500, 530, 1.35],
  // Step 2: Smooth shift to Console QR & bind command
  [185, 630, 530, 1.30],
  [335, 630, 530, 1.30],
  // Camera scroll / pan across from Browser to Phone!
  [375, 1445, 520, 1.20],
  // Step 3: WeChat bind
  [545, 1445, 520, 1.20],
  // Step 4: Zoom into phone input bar while user is typing
  [575, 1445, 750, 1.45],
  [618, 1445, 750, 1.45],
  // Glide back up to frame the conversation as AI reply streams
  [652, 1445, 490, 1.22],
  [740, 1445, 490, 1.22],
  // Outro: Camera pulls back to reveal the whole scene
  [785, 960, 540, 0.94],
  [TOTAL_FRAMES, 960, 540, 0.94],
];

// Mouse Cursor Path Points (in world coordinates)
const CURSOR_PATH: CursorPathPoint[] = [
  // Step 1: Moves to email input and clicks send button
  { frame: 10, x: 280, y: 608 },
  { frame: 45, x: 420, y: 608 },
  { frame: 68, x: 280, y: 700 }, // Send button
  { frame: 80, x: 280, y: 700 },
  { frame: 120, x: 380, y: 750 },
  // Step 2: Moves swiftly to Copy Button on Console
  { frame: 195, x: 500, y: 550 },
  { frame: 255, x: 550, y: 560 },
  { frame: 285, x: 885, y: 615 }, // Reach copy button quickly
  { frame: 305, x: 885, y: 615 },
  // Disappears before camera pan to phone
  { frame: 330, x: 960, y: 630 },
];

const CURSOR_CLICKS: ClickPoint[] = [
  { frame: 70, x: 280, y: 700 }, // Click "发送登录邮件"
  { frame: 290, x: 885, y: 615 }, // Click "复制命令"
];

const easeSmooth = Easing.bezier(0.25, 0.1, 0.25, 1.0);

function getCamera(frame: number) {
  if (frame <= CAMERA_TRACK[0][0]) {
    const first = CAMERA_TRACK[0];
    return { cx: first[1], cy: first[2], zoom: first[3] };
  }
  const last = CAMERA_TRACK[CAMERA_TRACK.length - 1];
  if (frame >= last[0]) {
    return { cx: last[1], cy: last[2], zoom: last[3] };
  }

  for (let i = 0; i < CAMERA_TRACK.length - 1; i++) {
    const a = CAMERA_TRACK[i];
    const b = CAMERA_TRACK[i + 1];
    if (frame >= a[0] && frame <= b[0]) {
      if (a[0] === b[0] || (a[1] === b[1] && a[2] === b[2] && a[3] === b[3])) {
        return { cx: a[1], cy: a[2], zoom: a[3] };
      }
      const t = (frame - a[0]) / (b[0] - a[0]);
      const k = easeSmooth(t);
      return {
        cx: a[1] + (b[1] - a[1]) * k,
        cy: a[2] + (b[2] - a[2]) * k,
        zoom: a[3] + (b[3] - a[3]) * k,
      };
    }
  }

  return { cx: last[1], cy: last[2], zoom: last[3] };
}

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { cx, cy, zoom } = getCamera(frame);

  // Background subtle drift
  const drift = Math.sin(frame / 180) * 30;

  // Outro card animation (Frame >= 750)
  const outroShow = interpolate(frame, [755, 785], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outroSpring = spring({
    frame: frame - 755,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: color.bg, overflow: 'hidden' }}>
      {/* Ambient subtle light wash */}
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 1400,
          left: 100 + drift,
          top: -700,
          borderRadius: 999,
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.02) 0%, rgba(0, 0, 0, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1300,
          height: 1300,
          right: -300 - drift,
          bottom: -600,
          borderRadius: 999,
          background: 'radial-gradient(circle, rgba(7, 193, 96, 0.03) 0%, rgba(7, 193, 96, 0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Grid Pattern */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 0, 0, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 0, 0, 0.035) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
          maskImage: 'radial-gradient(ellipse at 50% 50%, black 35%, transparent 85%)',
          pointerEvents: 'none',
        }}
      />

      {/* Sound Elements */}
      <Music totalFrames={TOTAL_FRAMES} />
      <Sfx name="typing" at={24} duration={38} />
      <Sfx name="click" at={70} />
      <Sfx name="pop" at={85} />
      <Sfx name="whoosh" at={160} />
      <Sfx name="pop" at={260} />
      <Sfx name="click" at={290} />
      <Sfx name="whoosh" at={335} />
      <Sfx name="typing" at={385} duration={30} />
      <Sfx name="pop" at={420} />
      <Sfx name="pop" at={455} />
      <Sfx name="whoosh" at={550} />
      <Sfx name="typing" at={575} duration={37} />
      <Sfx name="pop" at={615} />
      <Sfx name="whoosh" at={620} />
      <Sfx name="pop" at={635} />
      <Sfx name="whoosh" at={740} />

      {/* Top Step Progress Bar */}
      <Steps />

      {/* Bottom Subtitles Bar */}
      <Subtitles />

      {/* Dynamic 2D/3D Camera Stage */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transformOrigin: '0 0',
          transform: `translate(${960 - cx * zoom}px, ${540 - cy * zoom}px) scale(${zoom})`,
        }}
      >
        {/* Left: Abstracted Browser / Console Mockup */}
        <BrowserMockup x={90} y={230} width={940} height={620} />

        {/* Right: Abstracted WeChat Phone Mockup (width 390, centered at X 1445) */}
        <PhoneMockup x={1250} y={160} width={390} height={760} />

        {/* Animated Mouse Cursor (Visible in Step 1 & 2) */}
        <Cursor path={CURSOR_PATH} clicks={CURSOR_CLICKS} visibleRange={[10, 335]} />
      </div>

      {/* Outro Overlay Card (Frame >= 750) */}
      {frame >= 750 && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `rgba(255, 255, 255, ${0.88 * outroShow})`,
            backdropFilter: `blur(${16 * outroShow}px)`,
            zIndex: 80,
            opacity: outroShow,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              padding: '48px 64px',
              borderRadius: 0,
              background: color.ground,
              border: `1px solid ${color.line}`,
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.1)',
              transform: `scale(${0.9 + 0.1 * outroSpring})`,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 8,
                border: `1px solid ${color.line}`,
                background: color.ground,
                marginBottom: 20,
              }}
            >
              <LogoMark size={64} color={color.ink} ground={color.ground} delay={755} />
            </div>

            <h1
              style={{
                fontFamily: font.sans,
                fontSize: 44,
                fontWeight: 700,
                color: color.ink,
                margin: '0 0 12px 0',
                letterSpacing: '0.03em',
              }}
            >
              WeBot
            </h1>

            <p
              style={{
                fontFamily: font.sans,
                fontSize: 22,
                color: color.gray,
                margin: '0 0 28px 0',
                fontWeight: 400,
              }}
            >
              微信里的 AI 助手 · 极简配置
            </p>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 28px',
                borderRadius: 0,
                background: color.solid,
                border: `1px solid ${color.solid}`,
                color: color.solidInk,
                fontFamily: font.mono,
                fontSize: 18,
                fontWeight: 600,
              }}
            >
              <span>webot.yuler.dev</span>
            </div>
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
