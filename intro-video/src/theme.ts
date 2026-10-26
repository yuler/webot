export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 855; // 28.5 seconds at 30 fps

export const sec = (s: number) => Math.round(s * FPS);

export const font = {
  sans: '"Noto Sans CJK SC", "Source Han Sans SC", "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace',
};

// Design tokens — DESIGN.md (Light mode / 白)
export const color = {
  // Core Tokens from DESIGN.md
  ground: '#ffffff',
  ink: '#000000',
  gray: '#888888',
  line: '#e5e5e5',
  wash: '#f2f2f2',
  solid: '#000000',
  solidInk: '#ffffff',

  // Canvas / Scene
  bg: '#f8f9fa',
  bgGrid: 'rgba(0, 0, 0, 0.04)',
  cardBg: '#ffffff',
  cardHeader: '#f7f8f9',
  border: '#e5e5e5',
  borderActive: '#000000',

  // WeChat & Device Mockups
  wechat: '#07c160',
  wechatBubble: '#95ec69',
  phoneBg: '#ededed',
  phoneHeader: '#f7f7f7',
  phoneBorder: '#d1d5db',

  // Typography & Semantics
  text: '#000000',
  secondary: '#888888',
  muted: '#888888',
  brand: '#000000',
  accent: '#000000',
};
