"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import poster from "../../../public/auth/events-poster.jpg";

/** Every kind of thing that's on. Drone shots are kept apart so the reel always breathes. */
const CLIPS = [
  { src: "/auth/clips/party.mp4", drone: false },
  { src: "/auth/clips/coding-team.mp4", drone: false },
  { src: "/auth/clips/drone-festival.mp4", drone: true },
  { src: "/auth/clips/conference-talk.mp4", drone: false },
  { src: "/auth/clips/festival-crowd.mp4", drone: false },
  { src: "/auth/clips/seminar.mp4", drone: false },
  { src: "/auth/clips/drone-city.mp4", drone: true },
  { src: "/auth/clips/team-laptop.mp4", drone: false },
  { src: "/auth/clips/fireworks.mp4", drone: false },
];

const LAYER =
  "absolute inset-0 -z-20 h-full w-full object-cover opacity-0 transition-opacity duration-700 ease-in-out";

/** Seconds the outgoing and incoming clips overlap. */
const FADE = 0.7;

/** A new random order where no two drone shots touch and the first clip differs from the last one played. */
function shuffled(previous: string | null) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const order = [...CLIPS];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const dronesApart = order.every((clip, i) => !(clip.drone && order[i + 1]?.drone));
    if (dronesApart && order[0].src !== previous) return order.map((c) => c.src);
  }
  return CLIPS.map((c) => c.src);
}

/**
 * Behind every account screen: everything that's on, from parties and hackathons to
 * conferences, with drone shots between, in a different order on every visit.
 * Two video layers take turns: one plays while the next loads, then they crossfade.
 * The still frame always renders first; video only loads on wide screens, for visitors
 * who haven't asked for less motion or less data.
 */
export function AuthBackdrop() {
  const [play, setPlay] = useState(false);
  const layerA = useRef<HTMLVideoElement>(null);
  const layerB = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData ?? false;
    const decide = () => setPlay(wide.matches && !calm.matches && !saveData);
    decide();
    wide.addEventListener("change", decide);
    calm.addEventListener("change", decide);
    return () => {
      wide.removeEventListener("change", decide);
      calm.removeEventListener("change", decide);
    };
  }, []);

  useEffect(() => {
    if (!play) return;
    const a = layerA.current;
    const b = layerB.current;
    if (!a || !b) return;

    let order = shuffled(null);
    let position = 0;
    let active = 0;
    let switching = false;
    let timer = 0;

    const nextSrc = () => {
      if (position + 1 >= order.length) {
        order = shuffled(order[order.length - 1]);
        position = -1;
      }
      return order[position + 1];
    };
    const load = (video: HTMLVideoElement, src: string) => {
      video.src = src;
      video.load();
    };
    const show = (video: HTMLVideoElement, visible: boolean) => {
      video.style.opacity = visible ? "1" : "0";
    };

    const advance = () => {
      if (switching) return;
      switching = true;
      const current = [a, b][active];
      const incoming = [a, b][1 - active];
      incoming.currentTime = 0;
      void incoming.play().catch(() => undefined);
      show(incoming, true);
      show(current, false);
      position += 1;
      active = 1 - active;
      timer = window.setTimeout(() => {
        current.pause();
        // The layer that just faded out fetches the clip after next, ready for the following swap.
        load(current, nextSrc());
        switching = false;
      }, FADE * 1000 + 50);
    };

    const onTime = (event: Event) => {
      const video = event.currentTarget as HTMLVideoElement;
      if (video !== [a, b][active] || !video.duration) return;
      if (video.duration - video.currentTime <= FADE) advance();
    };

    for (const v of [a, b]) {
      v.addEventListener("timeupdate", onTime);
      v.addEventListener("ended", advance);
    }
    load(a, order[0]);
    show(a, true);
    show(b, false);
    void a.play().catch(() => undefined);

    // The second layer waits until the first can play, so arriving here costs
    // one clip rather than two competing for the same connection.
    const queueNext = () => load(b, order[1]);
    a.addEventListener("canplay", queueNext, { once: true });

    return () => {
      window.clearTimeout(timer);
      a.removeEventListener("canplay", queueNext);
      for (const v of [a, b]) {
        v.removeEventListener("timeupdate", onTime);
        v.removeEventListener("ended", advance);
        v.pause();
        v.removeAttribute("src");
        v.load();
      }
    };
  }, [play]);

  return (
    <>
      <Image src={poster} alt="" fill priority placeholder="blur" sizes="100vw" className="-z-30 object-cover" />
      {play ? (
        <>
          <video ref={layerA} className={LAYER} muted playsInline preload="auto" aria-hidden="true" />
          <video ref={layerB} className={LAYER} muted playsInline preload="auto" aria-hidden="true" />
        </>
      ) : null}
    </>
  );
}
