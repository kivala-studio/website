"use client";

import { type InputHTMLAttributes, useEffect, useLayoutEffect, useRef } from "react";

import { editAmount, formatCompletedAmount } from "@/domain/format/amount-input";

import { cn } from "../cn";

type AmountFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (text: string) => void;
  /** Currency or unit shown after the field, e.g. "Kz". */
  suffix?: string;
};

/**
 * Decimal comma in every language, `.` typed as `,`, live thousands grouping, caret kept on the same digit.
 * The text is parsed with `parseAmount`; invalid keystrokes are rejected.
 */
export function AmountField({ value, onValueChange, suffix, className, onBlur, ...props }: AmountFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useEffect(() => {
    const element = input.current;
    if (!element) return;
    const handle = (event: InputEvent) => {
      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? start;
      let range: [number, number] = [start, end];
      let replacement: string;
      switch (event.inputType) {
        case "insertText":
        case "insertReplacementText":
        case "insertFromPaste":
        case "insertFromDrop":
          replacement = event.data ?? event.dataTransfer?.getData("text/plain") ?? "";
          break;
        case "deleteContentBackward":
          replacement = "";
          if (start === end) range = [Math.max(0, start - 1), start];
          break;
        case "deleteContentForward":
          replacement = "";
          if (start === end) range = [start, Math.min(element.value.length, start + 1)];
          break;
        case "deleteByCut":
          replacement = "";
          break;
        default:
          return; // History and composition events keep the browser's behaviour.
      }
      event.preventDefault();
      if (range[0] === range[1] && replacement === "") return;
      const edit = editAmount(element.value, range[0], range[1], replacement);
      if (!edit) return;
      caret.current = edit.caret;
      onValueChange(edit.text);
    };
    element.addEventListener("beforeinput", handle);
    return () => element.removeEventListener("beforeinput", handle);
  }, [onValueChange]);

  useLayoutEffect(() => {
    if (caret.current === null || !input.current) return;
    input.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  }, [value]);

  return (
    <span className="flex min-h-12 items-center gap-2 rounded-medium bg-elevated-background px-4 focus-within:outline-2 focus-within:outline-accent">
      <input
        ref={input}
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value}
        // Edits go through `beforeinput`; this keeps React's controlled input contract.
        onChange={(event) => onValueChange(event.target.value)}
        onBlur={(event) => {
          onValueChange(formatCompletedAmount(event.target.value));
          onBlur?.(event);
        }}
        className={cn("min-w-0 flex-1 bg-transparent py-3 text-body text-primary-text outline-none", className)}
      />
      {suffix ? <span className="text-body text-secondary-text">{suffix}</span> : null}
    </span>
  );
}
