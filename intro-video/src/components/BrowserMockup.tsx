import type * as React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
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
  const addressUrl = isConsole ? 'webot.yuler.dev/console' : 'webot.yuler.dev/login';

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
        borderRadius: 8,
        background: color.ground,
        border: `1px solid ${color.line}`,
        boxShadow:
          '0 24px 64px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)',
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
          background: '#f8f9fa',
          borderBottom: `1px solid ${color.line}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ff5f56' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#ffbd2e' }} />
          <div style={{ width: 12, height: 12, borderRadius: 99, background: '#27c93f' }} />
        </div>

        {/* Browser Nav */}
        <div style={{ display: 'flex', gap: 10, color: color.gray, fontSize: 18, fontWeight: 700 }}>
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
            background: color.wash,
            border: `1px solid ${color.line}`,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            color: color.gray,
            fontFamily: font.mono,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color.ink} strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ color: color.ink }}>{addressUrl}</span>
        </div>

        <div style={{ width: 60 }} />
      </div>

      {/* Browser Body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: color.ground }}>
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
              <LogoMark size={32} color={color.ink} ground={color.ground} />
              <span style={{ fontSize: 24, fontWeight: 600, color: color.ink, letterSpacing: '0.02em' }}>
                WeBot
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  padding: '3px 8px',
                  borderRadius: 0,
                  background: color.wash,
                  color: color.gray,
                  border: `1px solid ${color.line}`,
                  letterSpacing: '0.05em',
                }}
              >
                CLAWBOT + DEEPSEEK
              </span>
            </div>

            <h2 style={{ fontSize: 28, fontWeight: 500, color: color.ink, margin: '0 0 8px 0' }}>
              邮箱免密快捷登录
            </h2>
            <p style={{ fontSize: 15, color: color.gray, margin: '0 0 28px 0' }}>
              无需繁琐密码，填写邮箱后即可收到专属魔法链接与 6 位验证码。
            </p>

            {/* Email Form Panel */}
            <div
              style={{
                background: color.ground,
                border: `1px solid ${color.line}`,
                borderRadius: 0,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxWidth: 580,
              }}
            >
              <div>
                <label style={{ fontSize: 14, color: color.gray, fontWeight: 500, display: 'block', marginBottom: 8 }}>
                  电子邮箱地址
                </label>
                <div
                  style={{
                    height: 44,
                    background: 'transparent',
                    borderBottom: `1px solid ${frame > 20 && frame < 70 ? color.ink : color.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 4px',
                    fontSize: 17,
                    fontFamily: font.mono,
                    color: color.ink,
                  }}
                >
                  <span>{displayedEmail}</span>
                  {frame < 70 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 20,
                        background: color.ink,
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
                    borderRadius: 0,
                    background: color.solid,
                    color: color.solidInk,
                    fontSize: 15,
                    fontWeight: 500,
                    border: `1px solid ${color.solid}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transform: isSending ? 'scale(0.97)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSent ? '✓ 已发送登录邮件' : isSending ? '正在发送...' : '发送登录邮件'}
                </button>
              </div>

              {/* Toast info Notice */}
              {isSent && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 0,
                    background: color.wash,
                    borderLeft: `2px solid ${color.ink}`,
                    color: color.ink,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ fontWeight: 500 }}>已发送</span>
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
                <LogoMark size={28} color={color.ink} ground={color.ground} />
                <span style={{ fontSize: 20, fontWeight: 600, color: color.ink }}>控制台</span>
                <span style={{ color: color.line }}>/</span>
                <span style={{ fontSize: 14, color: color.gray }}>yule@example.com</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 14px',
                  borderRadius: 0,
                  background: color.wash,
                  border: `1px solid ${color.line}`,
                  color: color.ink,
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 0,
                    background: isScanned ? color.ink : color.gray,
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
                  background: color.ground,
                  border: `1px solid ${color.line}`,
                  borderRadius: 0,
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
                <div style={{ fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 6 }}>
                  微信 ClawBot 扫码上线
                </div>
                <div style={{ fontSize: 13, color: color.gray, marginBottom: 16 }}>
                  {isScanned ? '✅ 微信已成功接入机器人服务' : '请使用微信扫描下方二维码让机器人就绪'}
                </div>

                {/* Stylized QR Box */}
                <div
                  style={{
                    position: 'relative',
                    width: 170,
                    height: 170,
                    background: color.ground,
                    border: `1px solid ${color.line}`,
                    borderRadius: 0,
                    padding: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {/* Stylized QR pattern */}
                  <svg width="150" height="150" viewBox="0 0 100 100" fill={color.ink}>
                    {/* Corner 1 */}
                    <rect x="4" y="4" width="28" height="28" />
                    <rect x="8" y="8" width="20" height="20" fill={color.ground} />
                    <rect x="12" y="12" width="12" height="12" />

                    {/* Corner 2 */}
                    <rect x="68" y="4" width="28" height="28" />
                    <rect x="72" y="8" width="20" height="20" fill={color.ground} />
                    <rect x="76" y="12" width="12" height="12" />

                    {/* Corner 3 */}
                    <rect x="4" y="68" width="28" height="28" />
                    <rect x="8" y="72" width="20" height="20" fill={color.ground} />
                    <rect x="12" y="76" width="12" height="12" />

                    {/* Data dots */}
                    <rect x="38" y="8" width="6" height="6" />
                    <rect x="48" y="14" width="8" height="8" />
                    <rect x="36" y="24" width="10" height="6" />
                    <rect x="52" y="28" width="6" height="8" />

                    <rect x="10" y="40" width="8" height="8" />
                    <rect x="24" y="46" width="10" height="6" />
                    <rect x="40" y="42" width="18" height="18" />
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
                        height: 2,
                        background: color.ink,
                      }}
                    />
                  )}

                  {/* Success Overlay Checkmark */}
                  {isScanned && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(255, 255, 255, 0.94)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: color.ink,
                        fontWeight: 600,
                        fontSize: 15,
                        gap: 6,
                      }}
                    >
                      <span style={{ fontSize: 36 }}>✓</span>
                      <span>扫码就绪</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Card: Bind Command */}
              <div
                style={{
                  background: color.ground,
                  border: `1px solid ${isCopied ? color.ink : color.line}`,
                  borderRadius: 0,
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 16,
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      padding: '3px 8px',
                      borderRadius: 0,
                      background: color.wash,
                      color: color.gray,
                      border: `1px solid ${color.line}`,
                    }}
                  >
                    绑定指令
                  </span>
                  <h3 style={{ fontSize: 20, fontWeight: 600, color: color.ink, margin: '8px 0 4px 0' }}>
                    发送指令绑定微信
                  </h3>
                  <p style={{ fontSize: 13, color: color.gray, margin: 0 }}>
                    复制下方指令，在微信中直接发给已上线的 <strong>WeixinClawBot</strong>：
                  </p>
                </div>

                {/* Code block with copy button */}
                <div
                  style={{
                    background: color.wash,
                    border: `1px solid ${color.line}`,
                    borderRadius: 0,
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <code style={{ fontSize: 18, color: color.ink, fontFamily: font.mono, fontWeight: 700 }}>
                    /bind 849201
                  </code>
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      borderRadius: 0,
                      background: color.solid,
                      color: color.solidInk,
                      border: `1px solid ${color.solid}`,
                      fontSize: 13,
                      fontWeight: 500,
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

                <div style={{ fontSize: 12, color: color.gray, lineHeight: 1.5 }}>
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
