import type * as React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { color, font } from '../theme';

export interface SubtitleItem {
  start: number;
  end: number;
  tag: string;
  text: string;
}

export const SUBTITLES: SubtitleItem[] = [
  {
    start: 0,
    end: 90,
    tag: '第 1 步',
    text: '输入邮箱，点击发送免密登录邮件',
  },
  {
    start: 90,
    end: 180,
    tag: '第 1 步',
    text: '查收邮件中的魔法链接或 6 位验证码，一键安全进入控制台',
  },
  {
    start: 180,
    end: 275,
    tag: '第 2 步',
    text: '在控制台扫描二维码，启动微信 ClawBot 机器人',
  },
  {
    start: 275,
    end: 370,
    tag: '第 2 步',
    text: '扫码成功！ClawBot 实时上线，一键复制专属绑定指令',
  },
  {
    start: 370,
    end: 465,
    tag: '第 3 步',
    text: '打开微信，向已连接的 WeixinClawBot 发送绑定指令',
  },
  {
    start: 465,
    end: 560,
    tag: '第 3 步',
    text: '机器人秒级确认绑定成功，已接入 DeepSeek AI 大模型',
  },
  {
    start: 560,
    end: 655,
    tag: '第 4 步',
    text: '在微信随时提出任何问题，DeepSeek 实时智能作答',
  },
  {
    start: 655,
    end: 750,
    tag: '第 4 步',
    text: '支持代码编写、数据分析与日常闲聊，消息实时多端回看',
  },
  {
    start: 750,
    end: 855,
    tag: 'WeBot',
    text: '微信里的 AI 助手 · 极简配置 · webot.yuler.dev',
  },
];

export const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();

  const item = SUBTITLES.find((s) => frame >= s.start && frame < s.end);
  if (!item) return null;

  const show = interpolate(
    frame,
    [item.start, item.start + 6, item.end - 6, item.end],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 52,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 28px',
          background: 'rgba(255, 255, 255, 0.96)',
          border: `1px solid ${color.line}`,
          borderRadius: 999,
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
          backdropFilter: 'blur(16px)',
          opacity: show,
          transform: `translateY(${(1 - show) * 8}px)`,
        }}
      >
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: font.sans,
            padding: '4px 12px',
            borderRadius: 999,
            background: color.solid,
            color: color.solidInk,
            letterSpacing: '0.04em',
          }}
        >
          {item.tag}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 500,
            fontFamily: font.sans,
            color: color.ink,
            letterSpacing: '0.02em',
          }}
        >
          {item.text}
        </span>
      </div>
    </div>
  );
};
