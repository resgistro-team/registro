"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Moving between pages, without any chrome: once you click through to another page, the one
 * you're leaving dims (only if the next takes a moment), and the next eases in when it arrives.
 */
export function PageTransition() {
  return (
    <Suspense fallback={null}>
      <Watcher />
    </Suspense>
  );
}

function Watcher() {
  const pathname = usePathname();

  useEffect(() => {
    let safety = 0;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname) return;
      document.documentElement.dataset.navigating = "";
      window.clearTimeout(safety);
      // Never leave the page dimmed if a navigation is abandoned.
      safety = window.setTimeout(() => delete document.documentElement.dataset.navigating, 8000);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      window.clearTimeout(safety);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    delete document.documentElement.dataset.navigating;
  }, [pathname]);

  return null;
}
