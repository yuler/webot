export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const TOTAL_FRAMES = 855; // 28.5 seconds at 30 fps

export const sec = (s: number) => Math.round(s * FPS);

export const font = {
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Consolas, "Courier New", monospace',
};

export const color = {
  bg: '#0a0d14',
  bgGradient: 'radial-gradient(circle at 50% 25%, #151d2d 0%, #0a0d14 100%)',
  cardBg: '#131822',
  cardHeader: '#1a2230',
  border: 'rgba(255, 255, 255, 0.12)',
  borderActive: 'rgba(56, 189, 248, 0.5)',
  
  text: '#f1f5f9',
  secondary: '#94a3b8',
  muted: '#64748b',
  
  brand: '#38bdf8', // Cyan / tech accent
  wechat: '#07c160', // WeChat Green
  wechatBubble: '#059648',
  botBubble: '#1e293b',
  
  accent: '#38bdf8',
  danger: '#ef4444',
  warning: '#f59e0b',
};
