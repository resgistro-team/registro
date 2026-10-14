"use client";

import { useState } from "react";
import { Cover } from "@/components/Cover";
import { COVER_LIBRARY, type CoverSet } from "@/lib/cover-library";
import { coverSetFor } from "@/lib/covers";

const SET_LABELS: Record<CoverSet, string> = {
  music: "Music",
  social: "Social",
  culture: "Culture & food",
  sports: "Sports",
  tech: "Tech",
  career: "Career",
  academic: "Study",
  arts: "Arts",
  community: "Community",
};
const SETS = Object.keys(SET_LABELS) as CoverSet[];

/**
 * The cover is the poster, so it gets a real choice: a large preview of the current pick,
 * then the library, opening on the set that fits the category typed above.
 */
export function CoverPicker({
  value,
  category,
  onChange,
}: {
  value: string;
  category: string;
  onChange: (url: string) => void;
}) {
  const suggested = coverSetFor(category);
  const [open, setOpen] = useState(false);
  const [set, setSet] = useState<CoverSet | null>(null);
  const showing = set ?? suggested ?? "social";
  const current = COVER_LIBRARY.find((c) => c.url === value);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-paper/90">Cover</span>
      <div className="relative isolate flex aspect-[16/7] min-h-36 items-end overflow-hidden rounded-2xl border border-line bg-panel">
        <Cover url={value} sizes="(min-width: 768px) 700px, 100vw" className="-z-20" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,transparent_45%,rgb(2_3_8/0.75))]" />
        <div className="flex w-full flex-wrap items-center justify-between gap-2 p-3">
          <span className="text-xs text-paper/75">{current ? `Photo by ${current.photographer} on Unsplash` : "Your image"}</span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="cover-library"
            className="rounded-full bg-paper px-4 py-1.5 text-sm font-semibold text-ink"
          >
            {open ? "Done" : "Change cover"}
          </button>
        </div>
      </div>

      {open ? (
        <div id="cover-library" className="flex flex-col gap-3 rounded-2xl border border-line bg-panel/60 p-3">
          <div role="tablist" aria-label="Cover sets" className="flex flex-wrap gap-1.5">
            {SETS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === showing}
                onClick={() => setSet(s)}
                className="rounded-full border border-line px-3 py-1 text-xs font-medium text-paper/70 aria-selected:border-paper aria-selected:bg-paper aria-selected:text-ink"
              >
                {SET_LABELS[s]}
                {s === suggested ? " · fits" : ""}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Covers" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COVER_LIBRARY.filter((c) => c.set === showing).map((c) => {
              const chosen = c.url === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  aria-label={`${SET_LABELS[c.set]} photo by ${c.photographer}`}
                  onClick={() => onChange(c.url)}
                  className={`relative aspect-[16/10] overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-paper ${chosen ? "ring-2 ring-paper ring-offset-2 ring-offset-ink" : "opacity-80 hover:opacity-100"}`}
                >
                  <Cover url={c.url} sizes="220px" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
