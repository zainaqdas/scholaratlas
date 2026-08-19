"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { countryFlag, countryName, fundingLabel, studyLevelFromSlug } from "@/lib/constants";
import { studyLevelsOf, type MatchReasons } from "@/lib/scholarship";

interface AiItem {
  scholarship: {
    id: string;
    slug: string;
    title: string;
    provider: string;
    countryCode: string;
    fundingType: string;
    studyLevels: string;
    verificationStatus: string;
    deadline: string | null;
  };
  match: MatchReasons;
}

export function AiAssistant() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ summary: string[]; count: number; items: AiItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Could not reach the search service. Please try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-blue to-brand-indigo px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-900/25 transition-transform hover:scale-105"
        aria-label="Ask ScholarAtlas AI assistant"
      >
        <Sparkles className="h-4 w-4" />
        <span className="hidden sm:inline">Ask ScholarAtlas</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Ask ScholarAtlas
            </DialogTitle>
            <DialogDescription>
              Describe what you&apos;re looking for — e.g. &quot;a fully funded PhD in Japan for computer
              science&quot; — and we&apos;ll find potentially relevant opportunities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                placeholder="What are you looking for?"
                className="min-h-[70px]"
                aria-label="Describe the scholarship you want"
              />
              <Button onClick={ask} disabled={loading || !query.trim()} className="gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Ask
              </Button>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

            {result && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium">
                    I found <span className="font-bold">{result.count}</span> potentially relevant{" "}
                    {result.count === 1 ? "opportunity" : "opportunities"}.
                  </p>
                  {result.summary.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {result.summary.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {result.items.length === 0 ? (
                  <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                    No matches right now. Try broadening your description — for example, mention a
                    country, degree level or funding type.
                  </p>
                ) : (
                  <ul className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                    {result.items.map(({ scholarship: s, match }) => (
                      <li key={s.id} className="rounded-xl border bg-card p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              href={`/scholarships/${s.slug}`}
                              className="font-semibold leading-snug hover:text-primary"
                            >
                              {s.title}
                            </Link>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {s.provider} · {countryFlag(s.countryCode)} {countryName(s.countryCode)} ·{" "}
                              {fundingLabel(s.fundingType)}
                            </p>
                          </div>
                          <Badge variant={match.score >= 70 ? "success" : match.score >= 45 ? "info" : "secondary"}>
                            {match.score}% Match
                          </Badge>
                        </div>
                        {match.reasons.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
                            {match.reasons.map((r) => (
                              <li key={r} className="text-xs text-emerald-700 dark:text-emerald-400">
                                ✓ {r}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {studyLevelsOf(s as never).map((l) => studyLevelFromSlug(l)).filter(Boolean).join(", ")}
                          </span>
                          <Link
                            href={`/scholarships/${s.slug}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                          >
                            View details
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  AI recommendations are for discovery only. Always verify eligibility and
                  requirements on the official scholarship website.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
