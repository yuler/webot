import type * as React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font } from '../theme';

export interface StepDef {
  num: string;
  title: string;
  note: string;
  startFrame: number;
  endFrame: number;
}

export const STEPS: StepDef[] = [
  {
    num: '01',
    title: '邮箱登录',
    note: '填写邮箱获取魔法链接或验证码，免密快捷登录',
    startFrame: 0,
    endFrame: 180,
  },
  {
    num: '02',
    title: '微信扫码',
    note: '控制台扫码启动 ClawBot，实时获取专属绑定指令',
    startFrame: 180,
    endFrame: 370,
  },
  {
    num: '03',
    title: '微信绑定',
    note: '在微信中向 WeixinClawBot 发送 /bind 指令完成绑定',
    startFrame: 370,
    endFrame: 560,
  },
  {
    num: '04',
    title: '畅聊对话',
    note: '微信直连 DeepSeek，随时随地开启智能对话',
    startFrame: 560,
    endFrame: 750,
  },
];

export const Steps: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find active step index
  const activeIndex = STEPS.findIndex(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );
  const currentStep = activeIndex !== -1 ? activeIndex : frame >= 750 ? 4 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 36,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        zIndex: 50,
      }}
    >
      {/* Pills Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(15, 20, 30, 0.75)',
          padding: '8px 18px',
          borderRadius: 999,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;

          const p = spring({
            frame: frame - step.startFrame,
            fps,
            config: { damping: 14, stiffness: 140 },
          });

          return (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {i > 0 && (
                <div
                  style={{
                    width: 28,
                    height: 2,
                    background: isDone
                      ? color.wechat
                      : isActive
                      ? color.brand
                      : 'rgba(255, 255, 255, 0.15)',
                    transition: 'background 0.3s ease',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 44,
                  padding: '0 18px 0 8px',
                  borderRadius: 999,
                  background: isActive
                    ? 'rgba(56, 189, 248, 0.15)'
                    : isDone
                    ? 'rgba(7, 193, 96, 0.12)'
                    : 'transparent',
                  border: `1.5px solid ${
                    isActive
                      ? color.brand
                      : isDone
                      ? color.wechat
                      : 'rgba(255, 255, 255, 0.08)'
                  }`,
                  color: isActive ? '#fff' : isDone ? '#e2e8f0' : color.secondary,
                  fontFamily: font.sans,
                  fontSize: 19,
                  fontWeight: isActive ? 600 : 500,
                  transform: `scale(${isActive ? 1.05 : 1})`,
                  boxShadow: isActive ? '0 0 20px rgba(56, 189, 248, 0.35)' : undefined,
                }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 700,
                    background: isDone
                      ? color.wechat
                      : isActive
                      ? color.brand
                      : 'rgba(255, 255, 255, 0.12)',
                    color: isDone || isActive ? '#000' : color.secondary,
                  }}
                >
                  {isDone ? '✓' : step.num}
                </span>
                {step.title}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sub-note */}
      <div style={{ position: 'relative', height: 28, width: 800 }}>
        {STEPS.map((step, i) => {
          const isCurrent = i === currentStep;
          const opacity = interpolate(
            frame,
            [step.startFrame, step.startFrame + 10, step.endFrame - 10, step.endFrame],
            [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          if (!isCurrent) return null;

          return (
            <div
              key={step.num}
              style={{
                position: 'absolute',
                inset: 0,
                textAlign: 'center',
                fontFamily: font.sans,
                fontSize: 18,
                color: '#cbd5e1',
                opacity,
                letterSpacing: '0.02em',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              {step.note}
            </div>
          );
        })}
      </div>
    </div>
  );
};
