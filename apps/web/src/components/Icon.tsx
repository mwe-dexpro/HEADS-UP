import type { LucideIcon } from "lucide-react";

interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
}

/** Thin wrapper so call sites read like the design's `<Icon name="..." />` —
 * pass the lucide-react component itself rather than a string name, so
 * unused icons get tree-shaken instead of shipping the whole icon set. */
export function Icon({ icon: LucideIconComponent, size = 18, color }: IconProps) {
  return <LucideIconComponent size={size} color={color} strokeWidth={2} style={{ flex: "none" }} />;
}
