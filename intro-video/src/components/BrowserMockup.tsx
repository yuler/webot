import type * as React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font } from '../theme';
import { LogoMark } from './LogoMark';

export const BrowserMockup: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ x, y, width = 940, height = 620, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase transition: Frame 180 transitions from /login to /console
  const isConsole = frame >= 180;
  const addressUrl = isConsole ? 'webot.yuler.cc/console' : 'webot.yuler.cc/login';

  // Step 1: Email typing animation (Frame 20 - 65)
  const fullEmail = 'yule@example.com';
  const typeStart = 22;
  const charsTyped = Math.floor(
    interpolate(frame, [typeStart, 65], [0, fullEmail.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedEmail = fullEmail.slice(0, charsTyped);

  // Send button clicked at frame 70
  const isSending = frame >= 70 && frame < 85;
  const isSent = frame >= 85;

  // QR Code scan progress (Frame 190 - 260)
  const scanProgress = interpolate(frame, [195, 255], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const isScanned = frame >= 260;

  // Command copied at frame 330
  const isCopied = frame >= 330;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 18,
        background: '#111622',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow:
          '0 40px 100px rgba(0, 0, 0, 0.7), 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: font.sans,
        ...style,
      }}
    >
      {/* Window Titlebar */}
      <div
        style={{
          height: 48,
          background: '#182030',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ef4444' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#f59e0b' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#10b981' }} />
        </div>

        {/* Browser Nav */}
        <div style={{ display: 'flex', gap: 10, color: '#64748b', fontSize: 18, fontWeight: 700 }}>
          <span>‹</span>
          <span>›</span>
        </div>

        {/* Address bar */}
        <div
          style={{
            flex: 1,
            maxWidth: 520,
            margin: '0 auto',
            height: 32,
            background: 'rgba(10, 14, 22, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            color: '#94a3b8',
            fontFamily: font.mono,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ color: '#e2e8f0' }}>{addressUrl}</span>
        </div>

        <div style={{ width: 60 }} />
      </div>

      {/* Browser Body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* ================= STEP 1: LOGIN VIEW ================= */}
        {!isConsole && (
          <div
            style={{
              padding: '36px 54px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {/* Header Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <LogoMark size={38} color="#38bdf8" />
              <span style={{ fontSize: 24, fontWeight: 700, color: '#ffffff', letterSpacing: '0.02em' }}>
                WeBot
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                }}
              >
                CLAWBOT + DEEPSEEK
              </span>
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#f8fafc', margin: '0 0 8px 0' }}>
              邮箱免密快捷登录
            </h2>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: '0 0 28px 0' }}>
              无需繁琐密码，填写邮箱后即可收到专属魔法链接与 6 位验证码。
            </p>

            {/* Email Form Card */}
            <div
              style={{
                background: 'rgba(24, 32, 48, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                maxWidth: 580,
              }}
            >
              <div>
                <label style={{ fontSize: 14, color: '#cbd5e1', fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  电子邮箱地址
                </label>
                <div
                  style={{
                    height: 48,
                    background: '#0d131f',
                    border: `1.5px solid ${frame > 20 && frame < 70 ? '#38bdf8' : 'rgba(255, 255, 255, 0.14)'}`,
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    fontSize: 17,
                    fontFamily: font.mono,
                    color: '#f8fafc',
                    boxShadow: frame > 20 && frame < 70 ? '0 0 16px rgba(56, 189, 248, 0.25)' : undefined,
                  }}
                >
                  <span>{displayedEmail}</span>
                  {frame < 70 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 20,
                        background: '#38bdf8',
                        marginLeft: 2,
                        opacity: Math.sin(frame / 4) > 0 ? 1 : 0,
                      }}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  type="button"
                  style={{
                    height: 44,
                    padding: '0 24px',
                    borderRadius: 8,
                    background: isSent ? '#059648' : '#38bdf8',
                    color: isSent ? '#ffffff' : '#000000',
                    fontSize: 16,
                    fontWeight: 600,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transform: isSending ? 'scale(0.96)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSent ? '✓ 已发送登录邮件' : isSending ? '正在发送...' : '发送登录邮件'}
                </button>
              </div>

              {/* Toast info */}
              {isSent && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: 'rgba(7, 193, 96, 0.12)',
                    border: '1px solid rgba(7, 193, 96, 0.3)',
                    color: '#4ade80',
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>✉️</span>
                  <span>魔法链接与验证码已送达：<strong>849 201</strong>，正在安全进入控制台...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STEP 2: CONSOLE VIEW ================= */}
        {isConsole && (
          <div
            style={{
              padding: '32px 48px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            {/* Top Bar inside Console */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <LogoMark size={32} color="#38bdf8" />
                <span style={{ fontSize: 20, fontWeight: 700, color: '#ffffff' }}>控制台</span>
                <span style={{ color: '#64748b' }}>/</span>
                <span style={{ fontSize: 15, color: '#94a3b8' }}>yule@example.com</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 99,
                  background: isScanned ? 'rgba(7, 193, 96, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  border: `1px solid ${isScanned ? '#07c160' : '#f59e0b'}`,
                  color: isScanned ? '#4ade80' : '#fbbf24',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: isScanned ? '#07c160' : '#f59e0b',
                  }}
                />
                {isScanned ? 'ClawBot 已上线 (在线)' : '等待微信扫码上线...'}
              </div>
            </div>

            {/* Main Console Split Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, flex: 1 }}>
              {/* Left Card: QR Code */}
              <div
                style={{
                  background: 'rgba(24, 32, 48, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 14,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>
                  微信 ClawBot 扫码上线
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  {isScanned ? '✅ 微信已成功接入机器人服务' : '请使用微信扫描下方二维码让机器人就绪'}
                </div>

                {/* Stylized QR Box */}
                <div
                  style={{
                    position: 'relative',
                    width: 170,
                    height: 170,
                    background: '#ffffff',
                    borderRadius: 12,
                    padding: 10,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Stylized QR pattern */}
                  <svg width="150" height="150" viewBox="0 0 100 100" fill="#000000">
                    {/* Corner 1 */}
                    <rect x="4" y="4" width="28" height="28" rx="4" />
                    <rect x="8" y="8" width="20" height="20" fill="#fff" />
                    <rect x="12" y="12" width="12" height="12" />

                    {/* Corner 2 */}
                    <rect x="68" y="4" width="28" height="28" rx="4" />
                    <rect x="72" y="8" width="20" height="20" fill="#fff" />
                    <rect x="76" y="12" width="12" height="12" />

                    {/* Corner 3 */}
                    <rect x="4" y="68" width="28" height="28" rx="4" />
                    <rect x="8" y="72" width="20" height="20" fill="#fff" />
                    <rect x="12" y="76" width="12" height="12" />

                    {/* Data dots */}
                    <rect x="38" y="8" width="6" height="6" />
                    <rect x="48" y="14" width="8" height="8" />
                    <rect x="36" y="24" width="10" height="6" />
                    <rect x="52" y="28" width="6" height="8" />

                    <rect x="10" y="40" width="8" height="8" />
                    <rect x="24" y="46" width="10" height="6" />
                    <rect x="40" y="42" width="18" height="18" rx="4" fill="#07c160" />
                    <rect x="66" y="40" width="8" height="8" />
                    <rect x="80" y="46" width="10" height="6" />

                    <rect x="38" y="68" width="8" height="6" />
                    <rect x="52" y="74" width="8" height="8" />
                    <rect x="68" y="68" width="6" height="10" />
                    <rect x="82" y="78" width="8" height="8" />
                  </svg>

                  {/* Scan Laser Beam */}
                  {!isScanned && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        top: 10 + 150 * scanProgress,
                        height: 3,
                        background: '#07c160',
                        boxShadow: '0 0 12px 2px #07c160',
                        borderRadius: 2,
                      }}
                    />
                  )}

                  {/* Success Overlay Checkmark */}
                  {isScanned && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(7, 193, 96, 0.92)',
                        borderRadius: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: 16,
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 42 }}>✓</span>
                      <span>扫码就绪</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Card: Bind Command */}
              <div
                style={{
                  background: 'rgba(24, 32, 48, 0.7)',
                  border: `1.5px solid ${isCopied ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: 14,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 16,
                  boxShadow: isCopied ? '0 0 24px rgba(56, 189, 248, 0.2)' : undefined,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                    }}
                  >
                    绑定指令
                  </span>
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: '8px 0 4px 0' }}>
                    发送指令绑定微信
                  </h3>
                  <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                    复制下方指令，在微信中直接发给已上线的 <strong>WeixinClawBot</strong>：
                  </p>
                </div>

                {/* Code block with copy button */}
                <div
                  style={{
                    background: '#0a0e17',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 10,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <code style={{ fontSize: 18, color: '#38bdf8', fontFamily: font.mono, fontWeight: 700 }}>
                    /bind 849201
                  </code>
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 6,
                      background: isCopied ? '#059648' : '#38bdf8',
                      color: isCopied ? '#ffffff' : '#000000',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isCopied ? '✓ 已复制' : '复制命令'}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  💡 提示：绑定后您的微信账号即与 DeepSeek 关联，所有聊天记录均可在本控制台实时回看。
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
