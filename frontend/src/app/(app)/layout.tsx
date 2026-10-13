import type { ReactNode } from "react";
import { SiteNav } from "@/components/SiteNav";

/** Everything past the landing page: the bar on top, the page's one job below. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10 sm:px-10 sm:py-14 lg:px-16">{children}</main>
    </>
  );
}
