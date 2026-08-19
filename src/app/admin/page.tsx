import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { STATUS_LABELS, VERIFICATION_LABELS, countryFlag, countryName } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import {
  ApproveButton,
  BulkApproveButton,
  DeleteButton,
  FeatureButton,
  RejectButton,
  RemoveDuplicateButton,
  ResolveButton,
  ResolveContactButton,
  RoleSelect,
  StatusSelect,
  VerifyButton,
} from "@/components/admin/admin-actions";
import { Badge } from "@/components/ui/badge";
import { duplicateKey, normalizeText, richnessScore } from "@/lib/dedupe";
import type { DuplicateRow } from "@/lib/dedupe";

export const metadata: Metadata = { title: "Admin Dashboard", robots: { index: false } };

/**
 * Candidate duplicate groups among live (ACTIVE/PENDING) scholarship records,
 * keyed on normalized title + provider + country — the same key the offline
 * `scripts/dedupe.ts` pass uses, so the panel and the script agree. Only
 * SCHOLARSHIP records are considered (jobs/contests live in their own
 * sections). Each group lists its richest record first.
 */
async function findDuplicateGroups(limit = 10): Promise<DuplicateRow[][]> {
  const rows = (await prisma.scholarship.findMany({
    where: { recordType: "SCHOLARSHIP", status: { in: ["ACTIVE", "PENDING"] } },
    select: {
      id: true,
      slug: true,
      title: true,
      provider: true,
      countryCode: true,
      officialUrl: true,
      deadline: true,
      status: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  })) as DuplicateRow[];

  const byKey = new Map<string, DuplicateRow[]>();
  for (const r of rows) {
    const k = duplicateKey(r.title, r.provider, r.countryCode);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(r);
  }

  const groups = [...byKey.values()]
    .filter((g) => g.length > 1)
    .map((g) => [...g].sort((a, b) => richnessScore(b) - richnessScore(a)));
  groups.sort((a, b) => b.length - a.length);
  return groups.slice(0, limit);
}

export default async function AdminPage() {
  const admin = await requireAdmin();

  const now = new Date();
  const [
    total,
    active,
    expiring,
    expired,
    pending,
    verified,
    userCount,
    pendingList,
    recentList,
    reports,
    users,
    contactMessages,
    dataQuality,
    duplicateGroupsResult,
  ] = await Promise.all([
    prisma.scholarship.count(),
    prisma.scholarship.count({ where: { status: "ACTIVE" } }),
    prisma.scholarship.count({
      where: { status: "ACTIVE", deadline: { gte: now, lte: new Date(now.getTime() + 14 * 864e5) } },
    }),
    prisma.scholarship.count({ where: { status: "EXPIRED" } }),
    prisma.scholarship.count({ where: { status: "PENDING" } }),
    prisma.scholarship.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.user.count(),
    prisma.scholarship.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 20 }),
    prisma.scholarship.findMany({
      where: { status: { in: ["ACTIVE", "EXPIRED", "ARCHIVED"] } },
      include: { university: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.report.findMany({ where: { status: "OPEN" }, include: { scholarship: true, user: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.contactMessage.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    Promise.all([
      prisma.scholarship.count({ where: { deadline: null, status: "ACTIVE" } }),
      prisma.scholarship.count({
        where: { OR: [{ officialUrl: null }, { officialUrl: "" }] },
      }),
      prisma.scholarship.count({ where: { status: "ACTIVE", deadline: { lt: now } } }),
    ]),
    findDuplicateGroups(),
  ]);

  const [missingDeadline, missingUrl, staleActive] = dataQuality;
  const duplicateGroups = duplicateGroupsResult;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Manage scholarships, submissions, reports and users.</p>
        </div>
        <Badge variant="navy">Signed in as {admin.email}</Badge>
      </div>

      {/* Overview */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Total" value={total} />
        <Stat label="Active" value={active} tone="emerald" />
        <Stat label="Expiring soon" value={expiring} tone="amber" />
        <Stat label="Expired" value={expired} tone="red" />
        <Stat label="Pending" value={pending} tone="blue" />
        <Stat label="Verified" value={verified} tone="emerald" />
        <Stat label="Users" value={userCount} />
        <Stat label="Open reports" value={reports.length} tone="red" />
      </div>

      {/* Data quality */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Data Quality</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <QualityCard label="Missing deadlines" value={missingDeadline} />
          <QualityCard label="Missing official URLs" value={missingUrl} />
          <QualityCard label="Active but past deadline" value={staleActive} />
        </div>
      </section>

      {/* Pending submissions */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Pending Submissions</h2>
          {pending > 0 && <BulkApproveButton count={pending} />}
        </div>
        {pendingList.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nothing waiting for review. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingList.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div className="min-w-0">
                  {/* Not linked: PENDING detail pages are intentionally private until
                      approved (unverified submissions must never be public). */}
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.provider} · {countryFlag(s.countryCode)} {countryName(s.countryCode)} ·{" "}
                    {s.submittedEmail ? `Submitted by ${s.submittedEmail}` : "Community submission"}
                  </p>
                  {s.submittedNote && (
                    <p className="mt-1 text-xs italic text-muted-foreground">&quot;{s.submittedNote}&quot;</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <ApproveButton id={s.id} />
                  <RejectButton id={s.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Potential duplicates */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Potential Duplicates</h2>
          <span className="text-xs text-muted-foreground">matching title + provider + country</span>
        </div>
        {duplicateGroups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No exact-duplicate candidates. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {duplicateGroups.map((group) => (
              <li key={group[0].id} className="rounded-xl border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  {group.length} records · {group[0].provider}{" "}
                  {group[0].countryCode ? `· ${countryFlag(group[0].countryCode)} ${countryName(group[0].countryCode)}` : ""}
                </p>
                <ul className="mt-2 space-y-2">
                  {group.map((r, i) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/scholarships/${r.slug}`} className="truncate font-medium hover:text-primary">
                            {r.title}
                          </Link>
                          {i === 0 && <Badge variant="navy">Keep (richest)</Badge>}
                          {r.status !== "ACTIVE" && <Badge variant="secondary">{r.status}</Badge>}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {normalizeText(r.title) === normalizeText(group[0].title) ? "same title" : "similar title"} ·{" "}
                          {r.officialUrl ? "has URL" : "no URL"} · {r.deadline ? "has deadline" : "no deadline"}
                        </p>
                      </div>
                      {i > 0 && <RemoveDuplicateButton id={r.id} />}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Scholarship management */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Scholarship Management</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">Scholarship</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Verified</th>
                <th className="pb-2 pr-4">Deadline</th>
                <th className="pb-2 pr-4">Views</th>
                <th className="pb-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentList.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="max-w-[22rem] py-3 pr-4">
                    <Link href={`/scholarships/${s.slug}`} className="block truncate font-medium hover:text-primary">
                      {s.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">{s.provider}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusSelect id={s.id} status={s.status} />
                  </td>
                  <td className="py-3 pr-4 text-xs">
                    {VERIFICATION_LABELS[s.verificationStatus] ?? s.verificationStatus}
                  </td>
                  <td className="py-3 pr-4 text-xs">{s.deadline ? formatShortDate(s.deadline) : "—"}</td>
                  <td className="py-3 pr-4 text-xs">{s.views}</td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-1.5">
                      <VerifyButton id={s.id} />
                      <FeatureButton id={s.id} featured={s.isFeatured} />
                      <DeleteButton id={s.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Reports */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Open Reports</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No open reports.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div className="min-w-0">
                  <p className="font-medium">{r.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/scholarships/${r.scholarship.slug}`} className="hover:text-primary">
                      {r.scholarship.title}
                    </Link>
                    {r.message ? ` — "${r.message}"` : ""} · {r.user?.email ?? "Anonymous"}
                  </p>
                </div>
                <ResolveButton id={r.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Contact messages */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Contact Messages</h2>
          <Badge variant={contactMessages.length ? "navy" : "secondary"}>{contactMessages.length} new</Badge>
        </div>
        {contactMessages.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No new messages. 🎉</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {contactMessages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div className="min-w-0">
                  <p className="font-medium">
                    {m.topic}
                    {m.name ? ` — ${m.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.email} · {formatShortDate(m.createdAt)}
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{m.message}</p>
                </div>
                <ResolveContactButton id={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Users */}
      <section className="mt-8 rounded-2xl border bg-card p-6">
        <h2 className="font-display text-lg font-bold">User Management</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2 pr-4">User</th>
                <th className="pb-2 pr-4">Email</th>
                <th className="pb-2 pr-4">Joined</th>
                <th className="pb-2 pr-4">Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{u.name ?? "—"}</td>
                  <td className="py-3 pr-4 text-xs">{u.email}</td>
                  <td className="py-3 pr-4 text-xs">{formatShortDate(u.createdAt)}</td>
                  <td className="py-3 pr-4">
                    {admin.role === "SUPER_ADMIN" ? (
                      <RoleSelect id={u.id} role={u.role} />
                    ) : (
                      <Badge variant="secondary">{u.role}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "amber" | "red" | "blue" }) {
  const color =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : tone === "red"
          ? "text-red-600 dark:text-red-400"
          : tone === "blue"
            ? "text-blue-600 dark:text-blue-400"
            : "";
  return (
    <div className="rounded-xl border bg-card p-4 text-center">
      <p className={`font-display text-2xl font-extrabold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function QualityCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-display text-xl font-bold ${value > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
        {value}
      </span>
    </div>
  );
}

export { STATUS_LABELS };
