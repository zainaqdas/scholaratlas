"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, ChevronDown, Menu, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Logo />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  More
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/contests">Contests &amp; Prizes</Link>
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
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/scholarships">
              <Search className="h-4 w-4" />
              Search
            </Link>
          </Button>
          <Button asChild variant="ghost" size="iconSm" className="sm:hidden" aria-label="Search scholarships">
            <Link href="/scholarships">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="iconSm" aria-label="Saved scholarships">
            <Link href="/saved">
              <Bookmark className="h-5 w-5" />
            </Link>
          </Button>
          <ThemeToggle />

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
    </header>
  );
}
