"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Globe2, GraduationCap, Landmark, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestionData {
  scholarships: { slug: string; title: string; provider: string; country?: { name: string } | null }[];
  universities: { slug: string; name: string }[];
  countries: { code: string; name: string; flag: string | null }[];
  fields: { slug: string; name: string; icon: string }[];
  articles: { slug: string; title: string; category: string }[];
}

export function SearchBar({
  variant = "hero",
  defaultValue = "",
  autoFocus = false,
  className,
}: {
  variant?: "hero" | "compact";
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setSuggestions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setOpen(true);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [q]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const query = q.trim();
    setOpen(false);
    router.push(query ? `/scholarships?q=${encodeURIComponent(query)}` : "/scholarships");
  }

  const hasSuggestions = suggestions && (
    suggestions.scholarships.length ||
    suggestions.universities.length ||
    suggestions.countries.length ||
    suggestions.fields.length ||
    suggestions.articles.length
  );

  const hero = variant === "hero";

  return (
    <div ref={boxRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search">
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl border bg-card shadow-lg shadow-blue-900/5 transition-all focus-within:ring-2 focus-within:ring-ring",
            hero ? "h-14 px-4 sm:h-16 sm:px-5" : "h-11 px-3.5"
          )}
        >
          <Search className={cn("shrink-0 text-muted-foreground", hero ? "h-5 w-5" : "h-4 w-4")} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => hasSuggestions && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            autoFocus={autoFocus}
            placeholder="Search scholarships, universities, countries, or fields..."
            className={cn(
              "w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none",
              hero ? "text-base sm:text-lg" : "text-sm"
            )}
            aria-label="Search scholarships"
          />
          <button
            type="submit"
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-brand-blue to-brand-indigo font-semibold text-white transition-opacity hover:opacity-90",
              hero ? "h-10 px-4 text-sm sm:h-12 sm:px-6" : "h-8 px-3 text-xs"
            )}
          >
            Search
            {hero && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </form>

      {open && hasSuggestions && suggestions && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl">
          <div className="max-h-[26rem] overflow-y-auto p-2">
            {suggestions.scholarships.length > 0 && (
              <SuggestionGroup label="Scholarships" icon={<GraduationCap className="h-3.5 w-3.5" />}>
                {suggestions.scholarships.map((s) => (
                  <SuggestionRow
                    key={s.slug}
                    href={`/scholarships/${s.slug}`}
                    title={s.title}
                    sub={s.provider}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </SuggestionGroup>
            )}
            {suggestions.fields.length > 0 && (
              <SuggestionGroup label="Fields" icon={<Sparkles className="h-3.5 w-3.5" />}>
                {suggestions.fields.map((f) => (
                  <SuggestionRow
                    key={f.slug}
                    href={`/fields/${f.slug}`}
                    title={`${f.icon} ${f.name}`}
                    sub="Explore scholarships in this field"
                    onClick={() => setOpen(false)}
                  />
                ))}
              </SuggestionGroup>
            )}
            {suggestions.countries.length > 0 && (
              <SuggestionGroup label="Countries" icon={<Globe2 className="h-3.5 w-3.5" />}>
                {suggestions.countries.map((c) => (
                  <SuggestionRow
                    key={c.code}
                    href={`/countries/${c.code.toLowerCase()}`}
                    title={`${c.flag ?? ""} ${c.name}`}
                    sub="Scholarships in this country"
                    onClick={() => setOpen(false)}
                  />
                ))}
              </SuggestionGroup>
            )}
            {suggestions.universities.length > 0 && (
              <SuggestionGroup label="Universities" icon={<Landmark className="h-3.5 w-3.5" />}>
                {suggestions.universities.map((u) => (
                  <SuggestionRow
                    key={u.slug}
                    href={`/universities/${u.slug}`}
                    title={u.name}
                    sub="University profile"
                    onClick={() => setOpen(false)}
                  />
                ))}
              </SuggestionGroup>
            )}
            {suggestions.articles.length > 0 && (
              <SuggestionGroup label="Articles" icon={<BookOpen className="h-3.5 w-3.5" />}>
                {suggestions.articles.map((a) => (
                  <SuggestionRow
                    key={a.slug}
                    href={`/resources/${a.slug}`}
                    title={a.title}
                    sub={a.category}
                    onClick={() => setOpen(false)}
                  />
                ))}
              </SuggestionGroup>
            )}
            <button
              type="button"
              onClick={() => submit()}
              className="mt-1 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-sm font-medium text-primary hover:bg-muted"
            >
              Search for "{q}"
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SuggestionGroup({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      <p className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function SuggestionRow({
  href,
  title,
  sub,
  onClick,
}: {
  href: string;
  title: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <a
      href={href}
      onClick={onClick}
      className="block rounded-lg px-3 py-2 transition-colors hover:bg-muted"
    >
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </a>
  );
}
