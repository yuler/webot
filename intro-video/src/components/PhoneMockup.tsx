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
}> = ({ x, y, width = 390, height = 760, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Step 3: Typing bind command (Frame 385 - 418)
  const bindCmd = '/bind 849201';
  const bindTypeChars = Math.floor(
    interpolate(frame, [385, 418], [0, bindCmd.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedBindCmd = bindCmd.slice(0, bindTypeChars);

  // User sent bind command at frame 420
  const bindSent = frame >= 420;

  // Bot typing indicator during frame 426 - 455
  const botBindTyping = frame >= 426 && frame < 455;
  // Bot bind reply appears at frame 455
  const botBindReplied = frame >= 455;

  // Step 4: Typing prompt (Frame 575 - 612)
  const promptText = '请写一段 Python 脚本，提取 PDF 里的表格';
  const promptChars = Math.floor(
    interpolate(frame, [575, 612], [0, promptText.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const displayedPrompt = promptText.slice(0, promptChars);

  // User sent prompt at frame 615
  const promptSent = frame >= 615;

  // AI model streaming response (Frame 635 - 720)
  const aiStreaming = frame >= 635;
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
        background: color.phoneBg,
        border: `4px solid ${color.phoneBorder}`,
        boxShadow:
          '0 24px 64px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.04)',
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
        <div style={{ width: 10, height: 10, borderRadius: 99, background: '#222222' }} />
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
          color: color.ink,
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
              border: `1px solid ${color.ink}`,
              padding: 1,
              display: 'flex',
            }}
          >
            <div style={{ width: '80%', height: '100%', background: color.ink, borderRadius: 1 }} />
          </div>
        </div>
      </div>

      {/* WeChat Header */}
      <div
        style={{
          height: 52,
          background: color.phoneHeader,
          borderBottom: `1px solid ${color.line}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: color.ink, fontSize: 16 }}>
          <span style={{ fontSize: 20 }}>‹</span>
          <span style={{ fontSize: 14 }}>微信</span>
        </div>

        {/* Center: Bot Title & Verified badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: color.ink }}>WeixinClawBot</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 3,
              background: color.wechat,
              color: '#ffffff',
            }}
          >
            BOT
          </span>
        </div>

        <div style={{ color: color.gray, fontSize: 20, letterSpacing: '0.1em' }}>···</div>
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
          background: color.phoneBg,
        }}
      >
        {/* Timestamp */}
        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontSize: 11,
              color: color.gray,
              padding: '2px 8px',
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
              borderRadius: 4,
              background: color.ground,
              border: `1px solid ${color.line}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <LogoMark size={22} color={color.ink} ground={color.ground} />
          </div>
          <div
            style={{
              maxWidth: 290,
              background: color.ground,
              border: `1px solid #dedede`,
              borderRadius: 6,
              padding: '10px 14px',
              fontSize: 13,
              color: color.ink,
              lineHeight: 1.5,
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
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
                background: color.wechatBubble,
                color: color.ink,
                borderRadius: 6,
                border: '1px solid #7ecc50',
                padding: '9px 14px',
                fontSize: 14,
                fontFamily: font.mono,
                fontWeight: 600,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
                borderRadius: 4,
                background: color.ground,
                border: `1px solid ${color.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LogoMark size={22} color={color.ink} ground={color.ground} />
            </div>
            <div
              style={{
                background: color.ground,
                border: '1px solid #dedede',
                borderRadius: 6,
                padding: '8px 14px',
                display: 'flex',
                gap: 5,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: 99, background: color.ink, opacity: 0.8 }} />
              <div style={{ width: 6, height: 6, borderRadius: 99, background: color.ink, opacity: 0.5 }} />
              <div style={{ width: 6, height: 6, borderRadius: 99, background: color.ink, opacity: 0.3 }} />
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
                borderRadius: 4,
                background: color.ground,
                border: `1px solid ${color.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoMark size={22} color={color.ink} ground={color.ground} />
            </div>
            <div
              style={{
                maxWidth: 300,
                background: color.ground,
                border: `1px solid #dedede`,
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: color.ink,
                lineHeight: 1.5,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              🎉 <strong>绑定成功！</strong>
              <div style={{ marginTop: 4, color: color.gray }}>
                已为您连接 <strong>大语言模型</strong>。随时在此向我提问，无论是写代码、分析问题还是知识解答。
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
                maxWidth: 260,
                background: color.wechatBubble,
                color: color.ink,
                borderRadius: 6,
                border: '1px solid #7ecc50',
                padding: '8px 12px',
                fontSize: 12.5,
                lineHeight: 1.4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              请写一段 Python 脚本，提取 PDF 里的表格
            </div>
          </div>
        )}

        {/* Step 4: AI response (Frame >= 635) */}
        {aiStreaming && (
          <div
            style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              opacity: botResponseSpring,
              transform: `translateY(${(1 - botResponseSpring) * 12}px)`,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 4,
                background: color.ground,
                border: `1px solid ${color.line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <LogoMark size={20} color={color.ink} ground={color.ground} />
            </div>
            <div
              style={{
                maxWidth: 285,
                background: color.ground,
                border: `1px solid #dedede`,
                borderRadius: 6,
                padding: '9px 12px',
                fontSize: 11.5,
                color: color.ink,
                lineHeight: 1.4,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{ color: color.ink, fontWeight: 700, marginBottom: 4 }}>
                🤖 AI 智能回复：
              </div>
              推荐使用 <code>pdfplumber</code>，提取精准且高效：
              <div
                style={{
                  background: color.wash,
                  border: `1px solid ${color.line}`,
                  borderRadius: 4,
                  padding: '6px 8px',
                  margin: '5px 0',
                  fontFamily: font.mono,
                  fontSize: 10.5,
                  color: color.ink,
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
          height: 60,
          background: color.phoneHeader,
          borderTop: `1px solid ${color.line}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 20, color: color.gray }}>⊕</span>
        <div
          style={{
            flex: 1,
            height: 38,
            background: color.ground,
            border: `1px solid ${color.line}`,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            fontSize: 12.5,
            color: color.ink,
            fontFamily: font.sans,
          }}
        >
          {frame >= 370 && frame < 420 ? (
            <span>{displayedBindCmd}</span>
          ) : frame >= 560 && frame < 615 ? (
            <span>{displayedPrompt}</span>
          ) : (
            <span style={{ color: color.gray }}>输入消息...</span>
          )}
          {((frame >= 370 && frame < 420) || (frame >= 560 && frame < 615)) && (
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 15,
                background: color.wechat,
                marginLeft: 2,
                opacity: Math.sin(frame / 4) > 0 ? 1 : 0,
              }}
            />
          )}
        </div>
        <button
          type="button"
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 4,
            background:
              (frame >= 415 && frame <= 425) || (frame >= 612 && frame <= 620)
                ? '#059648'
                : color.wechat,
            color: '#ffffff',
            fontSize: 12.5,
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
