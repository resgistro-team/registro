import { LightsLoading } from "@/components/LightsLoading";

/** Shown the instant you navigate here, while the page itself loads. */
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] flex-col justify-center">
      <LightsLoading label="Loading event" />
    </div>
  );
}
