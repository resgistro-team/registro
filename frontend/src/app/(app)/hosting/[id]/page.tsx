import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageEvent } from "@/components/hosting/ManageEvent";

export const metadata: Metadata = { title: "Manage event · Registro" };

export default function ManageEventPage({ params }: PageProps<"/hosting/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-96 rounded-3xl bg-paper/5" />}>
      <ManageEventLoader params={params} />
    </Suspense>
  );
}

async function ManageEventLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageEvent id={id} />;
}
