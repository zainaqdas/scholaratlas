import { cn } from "@/lib/utils";

interface UniversityLogoProps {
  text?: string | null;
  color?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-12 w-12 rounded-xl text-sm",
  lg: "h-16 w-16 rounded-2xl text-lg",
};

export function UniversityLogo({ text, color, name, size = "md", className }: UniversityLogoProps) {
  const initials = text || (name ?? "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  const bg = color ?? "#1e3a8a";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-bold text-white",
        SIZES[size],
        className
      )}
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
