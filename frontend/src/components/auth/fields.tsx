"use client";

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Shown under the field until there is an error to show instead. */
  hint?: string;
  error?: string;
  /** Sits on the label row, right-aligned. Used for "Forgot it?". */
  aside?: ReactNode;
}

const inputClass =
  "w-full rounded-xl border bg-ink/60 px-4 py-3.5 text-[0.98rem] text-paper placeholder:text-muted/60 " +
  "outline-none transition-[border-color,box-shadow] duration-150 " +
  "focus:border-paper/70 focus:shadow-[0_0_0_3px_rgb(251_250_248_/_0.12)]";

/** A labelled input. Errors replace the hint, are announced, and mark the input invalid. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, aside, className, ...input },
  ref,
) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-paper/90">
          {label}
        </label>
        {aside}
      </div>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        className={`${inputClass} ${error ? "border-ember/80" : "border-line"} ${className ?? ""}`}
        {...input}
      />
      {note ? (
        <p id={noteId} className={`text-xs ${error ? "text-ember" : "text-muted"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
});

/** A password field with a show/hide control, so nobody needs a "confirm password" box. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type">>(function PasswordField(
  { label, hint, error, aside, ...input },
  ref,
) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-paper/90">
          {label}
        </label>
        {aside}
      </div>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={`${inputClass} pr-20 ${error ? "border-ember/80" : "border-line"}`}
          {...input}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-xs font-semibold text-muted transition-colors hover:text-paper focus-visible:outline-2 focus-visible:outline-paper"
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
      {note ? (
        <p id={noteId} className={`text-xs ${error ? "text-ember" : "text-muted"}`}>
          {note}
        </p>
      ) : null}
    </div>
  );
});

/** The screen's one bright element. It keeps its label while working, and says what it is doing. */
export function SubmitButton({ pending, children, pendingLabel }: { pending: boolean; children: ReactNode; pendingLabel: string }) {
  return (
    <button
      type="submit"
      aria-busy={pending}
      aria-disabled={pending}
      className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-full bg-paper px-6 py-3.5 text-[0.98rem] font-semibold text-ink transition-[transform,opacity] duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-paper aria-busy:translate-y-0 aria-busy:opacity-80"
    >
      {pending ? (
        <>
          <span aria-hidden="true" className="auth-spinner" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** A form-level message, for errors that belong to no single field. Read out when it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-paper">
      {children}
    </div>
  );
}
