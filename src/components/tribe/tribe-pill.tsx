import { tribeLabel, tribeTone } from "@/lib/tribes";

/**
 * A member's tribe as a light pastel pill in its confederacy's colour (Yusufzai → green,
 * Khattak → red…). Renders nothing for a blank or "Unsure" tribe.
 */
export function TribePill({ tribe, className = "px-3 py-1.5 text-[13px]" }: { tribe: string | null | undefined; className?: string }) {
  const label = tribeLabel(tribe);
  if (!label) return null;
  const tone = tribeTone(tribe);
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${className}`}
      style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      {label}
    </span>
  );
}
