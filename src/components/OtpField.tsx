import { forwardRef, useState } from "react";

type OtpFieldProps = {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
};

/** Six square boxes rendered over one transparent input, so paste and one-time-code autofill work. */
export const OtpField = forwardRef<HTMLInputElement, OtpFieldProps>(function OtpField(
  { value, onChange, length = 6, disabled, invalid, autoFocus, label = "验证码" },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);

  return (
    <div className="otp" data-invalid={invalid || undefined} data-disabled={disabled || undefined}>
      {Array.from({ length }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`otp-cell${value[i] ? " is-filled" : ""}${focused && i === active ? " is-active" : ""}`}
        >
          {value[i] ?? ""}
        </span>
      ))}
      <input
        ref={ref}
        className="otp-input"
        name="code"
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        onFocus={() => setFocused(true)}
        onSelect={(e) => {
          // The caret is invisible, so keep it at the end to match the highlighted box.
          const el = e.currentTarget;
          const end = el.value.length;
          if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
        }}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
});
