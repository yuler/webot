import type * as React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
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
    note: '微信直连大模型，随时随地开启智能对话',
    startFrame: 560,
    endFrame: 750,
  },
];

export const Steps: React.FC = () => {
  const frame = useCurrentFrame();

  // Find active step index
  const activeIndex = STEPS.findIndex(
    (s) => frame >= s.startFrame && frame < s.endFrame
  );
  const currentStep = activeIndex !== -1 ? activeIndex : frame >= 750 ? 4 : 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      {/* Pills Container */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(255, 255, 255, 0.96)',
          padding: '8px 18px',
          borderRadius: 999,
          border: `1px solid ${color.line}`,
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.06)',
        }}
      >
        {STEPS.map((step, i) => {
          const isActive = i === currentStep;
          const isDone = i < currentStep;

          return (
            <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {i > 0 && (
                <div
                  style={{
                    width: 28,
                    height: 2,
                    background: isDone || isActive ? color.ink : color.line,
                    transition: 'background 0.3s ease',
                  }}
                />
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 42,
                  padding: '0 16px 0 8px',
                  borderRadius: 999,
                  background: isActive
                    ? color.solid
                    : isDone
                    ? color.wash
                    : 'transparent',
                  border: `1.5px solid ${
                    isActive
                      ? color.solid
                      : isDone
                      ? color.line
                      : 'transparent'
                  }`,
                  color: isActive ? color.solidInk : isDone ? color.ink : color.gray,
                  fontFamily: font.sans,
                  fontSize: 17,
                  fontWeight: isActive ? 600 : 500,
                  transform: `scale(${isActive ? 1.04 : 1})`,
                  boxShadow: isActive ? '0 4px 16px rgba(0, 0, 0, 0.12)' : undefined,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    background: isActive
                      ? color.solidInk
                      : isDone
                      ? color.solid
                      : color.line,
                    color: isActive
                      ? color.solid
                      : isDone
                      ? color.solidInk
                      : color.gray,
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

      {/* Sub-note Pill */}
      <div style={{ position: 'relative', height: 26, width: 800, display: 'flex', justifyContent: 'center' }}>
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
                display: 'inline-flex',
                alignItems: 'center',
                padding: '3px 14px',
                background: 'rgba(255, 255, 255, 0.92)',
                border: `1px solid ${color.line}`,
                borderRadius: 999,
                fontFamily: font.sans,
                fontSize: 14,
                color: color.ink,
                opacity,
                letterSpacing: '0.02em',
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
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
