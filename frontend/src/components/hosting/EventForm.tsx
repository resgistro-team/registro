"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Field, FormAlert } from "@/components/auth/fields";
import { primaryButton, quietButton } from "@/components/Notice";
import { ApiError, explain } from "@/lib/api";
import { campusInputToIso, isoToCampusInput } from "@/lib/campus-time";
import { coverFor, coverSetFor, libraryFor } from "@/lib/covers";
import type { RegistroEvent } from "@/lib/events";
import { useAuthedRequest } from "@/lib/use-viewer";
import { CoverPicker } from "./CoverPicker";

type FieldName = "title" | "description" | "category" | "location" | "start" | "end" | "capacity";
type Errors = Partial<Record<FieldName, string>>;

/** Shown as suggestions only. Any category can be typed. */
const CATEGORIES = ["Academic", "Arts", "Career", "Community", "Culture", "Social", "Sports", "Technology", "Workshop"];

const textareaClass =
  "min-h-[9rem] w-full rounded-xl border bg-ink/60 px-4 py-3.5 text-[0.98rem] leading-relaxed text-paper placeholder:text-muted/60 outline-none transition-[border-color,box-shadow] duration-150 focus:border-paper/70 focus:shadow-[0_0_0_3px_rgb(251_250_248_/_0.12)]";

/**
 * Create or edit an event. New events can go live straight away or wait as a draft;
 * edits save in place and leave the status to the controls beside the form.
 */
export function EventForm({ event, onSaved }: { event?: RegistroEvent; onSaved?: (event: RegistroEvent) => void }) {
  const router = useRouter();
  const call = useAuthedRequest();
  const editing = Boolean(event);
  const [pending, setPending] = useState<"publish" | "draft" | "save" | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [category, setCategory] = useState(event?.category ?? "");
  // Always a concrete cover, so what the form previews is exactly what gets published.
  const [image, setImage] = useState(() => (event ? coverFor(event).url : libraryFor(null)[0].url));
  const [imageTouched, setImageTouched] = useState(Boolean(event?.image));
  // The inputs hold minutes, the server keeps seconds. Compare at the inputs' precision.
  const originalStart = event ? campusInputToIso(isoToCampusInput(event.start_datetime)) : null;
  const originalEnd = event ? campusInputToIso(isoToCampusInput(event.end_datetime)) : null;

  function read(form: HTMLFormElement) {
    const data = new FormData(form);
    const get = (key: string) => String(data.get(key) ?? "").trim();
    return {
      title: get("title"),
      description: get("description"),
      category: get("category"),
      location: get("location"),
      start: get("start"),
      end: get("end"),
      capacity: get("capacity"),
    };
  }

  /** Catch everything checkable here, so the server only ever says no for real reasons. */
  function check(values: ReturnType<typeof read>): Errors {
    const found: Errors = {};
    if (!values.title) found.title = "Give it a name.";
    if (!values.description) found.description = "Tell people what it is.";
    if (!values.location) found.location = "Where is it?";
    const start = campusInputToIso(values.start);
    const end = campusInputToIso(values.end);
    if (!start) found.start = "When does it start?";
    else if (new Date(start).getTime() <= Date.now() && start !== originalStart) {
      found.start = "Pick a time in the future.";
    }
    if (!end) found.end = "When does it end?";
    else if (start && new Date(end) <= new Date(start)) found.end = "It has to end after it starts.";
    if (values.capacity && !/^\d+$/.test(values.capacity)) found.capacity = "Use a whole number, or leave it empty.";
    else if (values.capacity && Number(values.capacity) < 1) found.capacity = "At least 1, or leave it empty for no limit.";
    return found;
  }

  async function submit(intent: "publish" | "draft" | "save", formEvent?: FormEvent<HTMLFormElement>) {
    formEvent?.preventDefault();
    const form = formRef.current;
    if (!form || pending) return;
    const values = read(form);
    const found = check(values);
    setErrors(found);
    setFormError(null);
    setSaved(false);
    const first = (Object.keys(found) as FieldName[])[0];
    if (first) {
      form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    const body: Record<string, unknown> = {
      title: values.title,
      description: values.description,
      location: values.location,
      category: values.category || null,
      capacity: values.capacity ? Number(values.capacity) : null,
      image,
    };
    const start = campusInputToIso(values.start)!;
    const end = campusInputToIso(values.end)!;
    // Only send a start time that changed: the server rejects a past start, even an unchanged one.
    if (start !== originalStart) body.start_datetime = start;
    if (end !== originalEnd) body.end_datetime = end;
    if (!editing) body.status = intent === "publish" ? "Published" : "Draft";

    setPending(intent);
    try {
      const result = await call<{ event: RegistroEvent }>(editing ? `/api/events/${event!.event_id}` : "/api/events", {
        method: editing ? "PATCH" : "POST",
        body,
      });
      if (editing) {
        setSaved(true);
        onSaved?.(result.event);
        router.refresh();
      } else {
        router.push(`/hosting/${result.event.event_id}?created=${intent}`);
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === "CAPACITY_TOO_SMALL") {
        setErrors({ capacity: `${event?.registration_count ?? "Some"} people are already going. Set it to at least that.` });
        form.querySelector<HTMLElement>('[name="capacity"]')?.focus();
      } else {
        setFormError(explain(error));
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={(e) => submit(editing ? "save" : "publish", e)} className="flex flex-col gap-6">
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <Field label="Name" name="title" defaultValue={event?.title} placeholder="Open Mic Night" error={errors.title} maxLength={140} required />

      <div className="flex flex-col gap-2">
        <label htmlFor="description" className="text-sm font-medium text-paper/90">
          What&apos;s it about?
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={event?.description}
          placeholder="What happens, who it's for, anything to bring."
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? "description-note" : undefined}
          className={`${textareaClass} ${errors.description ? "border-ember/80" : "border-line"}`}
          required
        />
        {errors.description ? (
          <p id="description-note" className="text-xs text-ember">
            {errors.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Where" name="location" defaultValue={event?.location} placeholder="Student Center Ballroom" error={errors.location} required />
        <Field
          label="Category"
          name="category"
          list="category-suggestions"
          defaultValue={event?.category ?? ""}
          onChange={(e) => {
            const next = e.target.value;
            setCategory(next);
            // Until the host picks a cover themselves, keep it in step with what the event is.
            const set = coverSetFor(next);
            if (!imageTouched && set) {
              const options = libraryFor(set);
              if (!options.some((c) => c.url === image)) setImage(options[0].url);
            }
          }}
          placeholder="Optional"
          hint="Helps people filter."
          error={errors.category}
        />
        <datalist id="category-suggestions">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <CoverPicker
        value={image}
        category={category}
        onChange={(url) => {
          setImage(url);
          setImageTouched(true);
        }}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          label="Starts"
          name="start"
          type="datetime-local"
          defaultValue={event ? isoToCampusInput(event.start_datetime) : undefined}
          hint="Eastern time."
          error={errors.start}
          required
        />
        <Field
          label="Ends"
          name="end"
          type="datetime-local"
          defaultValue={event ? isoToCampusInput(event.end_datetime) : undefined}
          error={errors.end}
          required
        />
      </div>

      <div className="sm:max-w-[calc(50%-0.75rem)]">
        <Field
          label="Spots"
          name="capacity"
          type="text"
          inputMode="numeric"
          defaultValue={event?.capacity ?? ""}
          placeholder="No limit"
          hint="Leave empty if anyone can come."
          error={errors.capacity}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        {editing ? (
          <>
            <button type="submit" disabled={pending !== null} className={primaryButton}>
              {pending === "save" ? "Saving…" : "Save changes"}
            </button>
            {saved ? (
              <p role="status" className="text-sm text-paper/75">
                Saved.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <button type="submit" disabled={pending !== null} className={primaryButton}>
              {pending === "publish" ? "Publishing…" : "Publish"}
            </button>
            <button type="button" disabled={pending !== null} onClick={() => submit("draft")} className={quietButton}>
              {pending === "draft" ? "Saving…" : "Save as draft"}
            </button>
          </>
        )}
      </div>
    </form>
  );
}
