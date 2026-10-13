import Link from "next/link";

export default function EventNotFound() {
  return (
    <div className="flex max-w-[34rem] flex-col gap-4 py-10">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">That event isn&apos;t here.</h1>
      <p className="text-paper/70">It may have been cancelled, unpublished, or the link is wrong.</p>
      <Link href="/#events" className="self-start font-semibold underline-offset-4 hover:underline">
        See what&apos;s on instead
      </Link>
    </div>
  );
}
