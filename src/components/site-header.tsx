"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, Menu, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/scholarships", label: "Scholarships" },
  { href: "/countries", label: "Countries" },
  { href: "/universities", label: "Universities" },
  { href: "/fields", label: "Fields of Study" },
  { href: "/resources", label: "Resources" },
  { href: "/about", label: "About" },
];

interface MeUser {
  name?: string | null;
  email?: string | null;
  role?: string;
}

function useCurrentUser() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((data: { user?: MeUser | null }) => {
        if (active) setUser(data.user ?? null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return { user, loaded };
}

export function SiteHeader() {
  const { user } = useCurrentUser();
  const name = user?.name || user?.email?.split("@")[0] || "Account";
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  // Close the expandable search panel when clicking outside the header or
  // pressing Escape (the panel itself lives inside the header element).
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [searchOpen]);

  return (
    <header ref={headerRef} className="relative sticky top-0 z-40 border-b bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Logo />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main navigation">
            {/* Top-level keeps the five core sections; Resources + About live in
                the More menu so the bar fits without crowding at laptop widths. */}
            {NAV_ITEMS.filter((i) => !["/resources", "/about"].includes(i.href)).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  More
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/resources">Resources</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/about">About</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/contests">Contests &amp; Prizes</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/jobs">Jobs &amp; Positions</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/deadlines">Deadlines</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/submit-scholarship">Submit a Scholarship</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/faq">FAQ</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Live search — inline on xl+, expandable panel below (the SearchBar
              component handles suggestions + submit). */}
          <div className="hidden xl:block">
            <SearchBar variant="compact" className="w-52" />
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            className="xl:hidden"
            aria-label="Search scholarships"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button asChild variant="ghost" size="iconSm" aria-label="Saved scholarships">
            <Link href="/saved">
              <Bookmark className="h-5 w-5" />
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="hidden gap-2 rounded-full sm:inline-flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-indigo text-xs font-bold text-white">
                    {(name[0] ?? "U").toUpperCase()}
                  </span>
                  <span className="max-w-[10rem] truncate text-sm">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/saved">Saved Scholarships</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/deadlines">Deadlines</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/submit-scholarship">Submit a Scholarship</Link>
                </DropdownMenuItem>
                {["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user.role ?? "") && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/signout">Sign Out</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/signin">Sign In</Link>
              </Button>
            </>
          )}

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 flex flex-col gap-1" aria-label="Mobile navigation">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/deadlines"
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                >
                  Deadlines
                </Link>
                <Link
                  href="/contests"
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                >
                  Contests &amp; Prizes
                </Link>
                <Link
                  href="/jobs"
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                >
                  Jobs &amp; Positions
                </Link>
                <Link
                  href="/saved"
                  className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                >
                  Saved
                </Link>
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/submit-scholarship"
                      className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                    >
                      Submit a Scholarship
                    </Link>
                    {["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(user.role ?? "") && (
                      <Link
                        href="/admin"
                        className="rounded-lg px-3 py-2.5 text-base font-medium text-foreground/90 transition-colors hover:bg-muted"
                      >
                        Admin Dashboard
                      </Link>
                    )}
                  </>
                ) : null}
              </nav>
              <div className="mt-6 flex flex-col gap-2">
                {user ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/signout">Sign Out</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/signin">Sign In</Link>
                    </Button>
                    <Button asChild className="w-full">
                      <Link href="/scholarships">Find Scholarships</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Expandable search panel (below xl) — drops under the sticky header */}
      {searchOpen && (
        <div className="absolute inset-x-0 top-full border-b bg-background/95 px-4 py-3 backdrop-blur-lg sm:px-6 xl:hidden">
          <SearchBar variant="compact" autoFocus onNavigate={() => setSearchOpen(false)} />
        </div>
      )}
    </header>
  );
}
