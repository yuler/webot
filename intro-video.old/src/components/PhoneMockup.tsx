import type * as React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { color, font } from '../theme';
import { LogoMark } from './LogoMark';

export const PhoneMockup: React.FC<{
  x: number;
  y: number;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
}> = ({ x, y, width = 450, height = 760, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step 3: Typing bind command (Frame 380 - 415)
  const bindCmd = '/bind 849201';
  const bindTypeChars = Math.floor(
    interpolate(frame, [380, 415], [0, bindCmd.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedBindCmd = bindCmd.slice(0, bindTypeChars);

  // User sent bind command at frame 420
  const bindSent = frame >= 420;

  // Bot typing indicator during frame 428 - 458
  const botBindTyping = frame >= 428 && frame < 458;
  // Bot bind reply appears at frame 458
  const botBindReplied = frame >= 458;

  // Step 4: Typing prompt (Frame 570 - 612)
  const promptText = '请写一段 Python 脚本，提取 PDF 里的表格';
  const promptChars = Math.floor(
    interpolate(frame, [570, 612], [0, promptText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedPrompt = promptText.slice(0, promptChars);

  // User sent prompt at frame 615
  const promptSent = frame >= 615;

  // DeepSeek streaming response (Frame 635 - 720)
  const deepseekStreaming = frame >= 635;
  const botResponseSpring = spring({
    frame: frame - 635,
    fps,
    config: { damping: 16, stiffness: 120 },
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        borderRadius: 44,
        background: '#090d16',
        border: '4px solid #2d3748',
        boxShadow:
          '0 50px 120px rgba(0, 0, 0, 0.8), 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 0 0 2px rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: font.sans,
        ...style,
      }}
    >
      {/* Dynamic Island / Notch */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 26,
          background: '#000000',
          borderRadius: 20,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingRight: 12,
        }}
      >
        <div style={{ width: 10, height: 10, borderRadius: 99, background: '#1e293b' }} />
      </div>

      {/* Phone Status Bar */}
      <div
        style={{
          height: 44,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
          fontWeight: 600,
          color: '#e2e8f0',
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        <span>09:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>5G</span>
          <div
            style={{
              width: 22,
              height: 11,
              borderRadius: 3,
              border: '1px solid #cbd5e1',
              padding: 1,
              display: 'flex',
            }}
          >
            <div style={{ width: '80%', height: '100%', background: '#cbd5e1', borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* WeChat Header */}
      <div
        style={{
          height: 52,
          background: '#161e2e',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 16 }}>
          <span style={{ fontSize: 20 }}>‹</span>
          <span style={{ fontSize: 14 }}>微信</span>
        </div>

        {/* Center: Bot Title & Verified badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc' }}>WeixinClawBot</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 4,
              background: '#07c160',
              color: '#ffffff',
            }}
          >
            BOT
          </span>
        </div>

        <div style={{ color: '#94a3b8', fontSize: 20, letterSpacing: '0.1em' }}>···</div>
      </div>

      {/* WeChat Chat Body */}
      <div
        style={{
          flex: 1,
          padding: '16px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          overflow: 'hidden',
          background: '#0f141f',
        }}
      >
        {/* Timestamp */}
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: '#64748b',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            今天 09:41
          </span>
        </div>

        {/* Initial Bot Welcome notice */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogoMark size={24} color="#38bdf8" />
          </div>
          <div
            style={{
              maxWidth: 290,
              background: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              color: '#cbd5e1',
              lineHeight: 1.5,
            }}
          >
            你好！我是 <strong>WeixinClawBot</strong>。请发送您的控制台绑定指令（例如：<code>/bind 码</code>）以激活专属服务。
          </div>
        </div>

        {/* User sent bind command (Frame >= 420) */}
        {bindSent && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              transform: `scale(${spring({ frame: frame - 420, fps, config: { damping: 14, stiffness: 180 } })})`,
              transformOrigin: 'bottom right',
            }}
          >
            <div
              style={{
                maxWidth: 260,
                background: '#07c160',
                color: '#ffffff',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 14,
                fontFamily: font.mono,
                fontWeight: 600,
                boxShadow: '0 4px 12px rgba(7, 193, 96, 0.3)',
              }}
            >
              /bind 849201
            </div>
          </div>
        )}

        {/* Bot typing indicator while verifying */}
        {botBindTyping && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoMark size={22} color="#38bdf8" />
            </div>
            <div
              style={{
                background: '#1e293b',
                borderRadius: 8,
                padding: '8px 14px',
                display: 'flex',
                gap: 5,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 99, background: '#38bdf8', opacity: 0.8 }} />
              <div style={{ width: 6, height: 6, borderRadius: 99, background: '#38bdf8', opacity: 0.5 }} />
              <div style={{ width: 6, height: 6, borderRadius: 99, background: '#38bdf8', opacity: 0.3 }} />
            </div>
          </div>
        )}

        {/* Bot reply: Bind success! (Frame >= 458) */}
        {botBindReplied && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              transform: `scale(${spring({ frame: frame - 458, fps, config: { damping: 14, stiffness: 160 } })})`,
              transformOrigin: 'bottom left',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoMark size={24} color="#38bdf8" />
            </div>
            <div
              style={{
                maxWidth: 300,
                background: '#1e293b',
                border: '1px solid rgba(7, 193, 96, 0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 13,
                color: '#f1f5f9',
                lineHeight: 1.5,
              }}
            >
              🎉 <strong>绑定成功！</strong>
              <div style={{ marginTop: 4, color: '#94a3b8' }}>
                已为您连接 <strong>DeepSeek-V3</strong>。随时在此向我提问，无论是写代码、分析问题还是知识解答。
              </div>
            </div>
          </div>
        )}

        {/* Step 4: User asks Python PDF question (Frame >= 615) */}
        {promptSent && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 4,
              transform: `scale(${spring({ frame: frame - 615, fps, config: { damping: 14, stiffness: 180 } })})`,
              transformOrigin: 'bottom right',
            }}
          >
            <div
              style={{
                maxWidth: 290,
                background: '#07c160',
                color: '#ffffff',
                borderRadius: 8,
                padding: '9px 14px',
                fontSize: 13,
                lineHeight: 1.4,
                boxShadow: '0 4px 12px rgba(7, 193, 96, 0.3)',
              }}
            >
              请写一段 Python 脚本，提取 PDF 里的表格
            </div>
          </div>
        )}

        {/* Step 4: DeepSeek response (Frame >= 635) */}
        {deepseekStreaming && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              opacity: botResponseSpring,
              transform: `translateY(${(1 - botResponseSpring) * 12}px)`,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                background: '#1e293b',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoMark size={24} color="#38bdf8" />
            </div>
            <div
              style={{
                maxWidth: 310,
                background: '#1e293b',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: 8,
                padding: '10px 14px',
                fontSize: 12,
                color: '#f1f5f9',
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: '#38bdf8', fontWeight: 600, marginBottom: 4 }}>
                🤖 DeepSeek 回复：
              </div>
              推荐使用 <code>pdfplumber</code>，提取精准且高效：
              <div
                style={{
                  background: '#0a0d14',
                  borderRadius: 6,
                  padding: '8px 10px',
                  margin: '6px 0',
                  fontFamily: font.mono,
                  fontSize: 11,
                  color: '#a5f3fc',
                  lineHeight: 1.35,
                }}
              >
                import pdfplumber<br />
                with pdfplumber.open(&apos;file.pdf&apos;) as p:<br />
                &nbsp;&nbsp;for page in p.pages:<br />
                &nbsp;&nbsp;&nbsp;&nbsp;print(page.extract_tables())
              </div>
              代码已就绪，直接运行即可！
            </div>
          </div>
        )}
      </div>

      {/* WeChat Bottom Input Bar */}
      <div
        style={{
          height: 64,
          background: '#161e2e',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 24, color: '#94a3b8' }}>⊕</span>
        <div
          style={{
            flex: 1,
            height: 40,
            background: '#0d131f',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize: 13,
            color: '#f8fafc',
            fontFamily: font.sans,
          }}
        >
          {frame >= 370 && frame < 420 ? (
            <span>{displayedBindCmd}</span>
          ) : frame >= 560 && frame < 615 ? (
            <span>{displayedPrompt}</span>
          ) : (
            <span style={{ color: '#64748b' }}>输入消息...</span>
          )}
          {((frame >= 370 && frame < 420) || (frame >= 560 && frame < 615)) && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 16,
                background: '#07c160',
                marginLeft: 2,
                opacity: Math.sin(frame / 4) > 0 ? 1 : 0,
              }}
            />
          )}
        </div>
        <button
          type="button"
          style={{
            height: 38,
            padding: '0 14px',
            borderRadius: 6,
            background:
              (frame >= 415 && frame <= 425) || (frame >= 612 && frame <= 620)
                ? '#059648'
                : '#07c160',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          发送
        </button>
      </div>
    </div>
  );
};
