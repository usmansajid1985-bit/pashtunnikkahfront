import { tribeLabel, tribeTone } from "@/lib/tribes";

/**
 * A member's tribe as a light pastel pill in its confederacy's colour (Yusufzai → green,
 * Khattak → red…). Renders nothing for a blank or "Unsure" tribe.
 */
export function TribePill({
  tribe,
  className = "px-3 py-1.5 text-[13px]",
  icon,
}: {
  tribe: string | null | undefined;
  className?: string;
  /** Optional leading icon — the photo hero shows a people icon; Browse cards show none. */
  icon?: React.ReactNode;
}) {
  const label = tribeLabel(tribe);
  if (!label) return null;
  const tone = tribeTone(tribe);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${className}`}
      style={{ backgroundColor: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      {icon}
      {label}
    </span>
  );
}
