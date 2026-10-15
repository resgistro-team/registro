/**
 * Loading, kept quiet: a small activity indicator, eight spokes fading in turn.
 * The label is for screen readers; on screen the indicator says enough.
 */
export function LightsLoading({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex justify-center py-16">
      <span aria-hidden="true" className="spinner">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} style={{ transform: `rotate(${i * 45}deg)`, animationDelay: `${(i - 8) * 0.1}s` }} />
        ))}
      </span>
      <span className="sr-only">{label}</span>
    </div>
  );
}
