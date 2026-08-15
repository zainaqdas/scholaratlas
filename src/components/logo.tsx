import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("h-9 w-9", className)} aria-hidden="true">
      <defs>
        <linearGradient id="sa-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="url(#sa-grad)" />
      <circle cx="20" cy="20" r="9.5" stroke="white" strokeWidth="1.6" opacity="0.95" />
      <ellipse cx="20" cy="20" rx="4" ry="9.5" stroke="white" strokeWidth="1.1" opacity="0.55" />
      <line x1="20" y1="10.5" x2="20" y2="29.5" stroke="white" strokeWidth="1.1" opacity="0.55" />
      <path
        d="M20 13.5 L22.4 20 L20 26.5 L17.6 20 Z"
        fill="white"
        opacity="0.95"
        transform="rotate(-30 20 20)"
      />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-center gap-2.5", className)} aria-label="ScholarAtlas home">
      <LogoMark className={markClassName} />
      <span className="font-display text-xl font-extrabold tracking-tight">
        Scholar<span className="text-gradient">Atlas</span>
      </span>
    </Link>
  );
}
