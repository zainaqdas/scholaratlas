"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  setSessionCookie,
  verifyPassword,
  clearSessionCookie,
  isAdminRole,
} from "@/lib/auth";
import { slugify } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

export async function signupAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Try signing in." };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: name || null,
      emailVerified: true, // dev: email verification flow is stubbed (see README)
    },
  });

  const token = await createSession(user.id);
  await setSessionCookie(token);
  redirect("/dashboard?welcome=1");
}

export async function signinAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  const next = String(formData.get("next") ?? "");
  // Only same-site paths are allowed (starts with "/" but not "//" — the
  // latter is a protocol-relative URL and would be an open redirect).
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signoutAction(): Promise<void> {
  const store = await import("next/headers").then((m) => m.cookies());
  const token = store.get("sa_session")?.value;
  if (token) await destroySession(token);
  await clearSessionCookie();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Saved scholarships
// ---------------------------------------------------------------------------

// Returns which of the given scholarship ids the current user has saved. Used
// by static (ISR-cached) pages to hydrate SaveButtons client-side — the page
// shell is shared HTML, so the per-user saved set is fetched once per page.
// Anonymous users short-circuit with an empty list (no DB read).
export async function getSavedIdsAction(scholarshipIds: string[]): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user || !scholarshipIds.length) return [];
  const saved = await prisma.savedScholarship.findMany({
    where: { userId: user.id, scholarshipId: { in: scholarshipIds } },
    select: { scholarshipId: true },
  });
  return saved.map((s) => s.scholarshipId);
}

export async function toggleSaveAction(scholarshipId: string): Promise<{ saved: boolean }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/scholarships/${scholarshipId}`);
  const existing = await prisma.savedScholarship.findUnique({
    where: { userId_scholarshipId: { userId: user.id, scholarshipId } },
  });
  if (existing) {
    await prisma.savedScholarship.delete({ where: { id: existing.id } });
    revalidatePath("/saved");
    revalidatePath("/dashboard");
    return { saved: false };
  }
  await prisma.savedScholarship.create({ data: { userId: user.id, scholarshipId } });
  revalidatePath("/saved");
  revalidatePath("/dashboard");
  return { saved: true };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateProfileAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: String(formData.get("name") ?? "") || null,
      nationality: String(formData.get("nationality") ?? "") || null,
      countryOfResidence: String(formData.get("countryOfResidence") ?? "") || null,
      degreeLevel: String(formData.get("degreeLevel") ?? "") || null,
      fieldOfStudy: String(formData.get("fieldOfStudy") ?? "") || null,
      gpa: String(formData.get("gpa") ?? "") || null,
      preferredDestination: String(formData.get("preferredDestination") ?? "") || null,
      ieltsStatus: String(formData.get("ieltsStatus") ?? "") || null,
      graduationYear: String(formData.get("graduationYear") ?? "") || null,
    },
  });
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function reportScholarshipAction(formData: FormData): Promise<ActionResult> {
  const scholarshipId = String(formData.get("scholarshipId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const message = String(formData.get("message") ?? "");
  const user = await getCurrentUser();

  if (!scholarshipId || !reason) return { ok: false, error: "Missing report details." };

  await prisma.report.create({
    data: {
      scholarshipId,
      reason,
      message: message || null,
      userId: user?.id ?? null,
    },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Scholarship submissions (moderation queue)
// ---------------------------------------------------------------------------

export async function submitScholarshipAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const title = String(formData.get("title") ?? "").trim();
  const provider = String(formData.get("provider") ?? "").trim();
  const countryCode = String(formData.get("countryCode") ?? "").trim().toUpperCase();
  const officialUrl = String(formData.get("officialUrl") ?? "").trim();
  const email = String(formData.get("contactEmail") ?? "").trim();
  const name = String(formData.get("contactName") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title || !provider || !countryCode || !officialUrl) {
    return { ok: false, error: "Title, provider, destination country and official website are required." };
  }
  if (!/^https?:\/\//.test(officialUrl)) {
    return { ok: false, error: "Official website must be a valid URL starting with http(s)://." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid contact email." };
  }

  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) return { ok: false, error: "Unknown destination country code." };

  const levels = (String(formData.get("studyLevels") ?? "") || "Undergraduate")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean);
  const fields = (String(formData.get("fields") ?? "") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean);
  const fundingType = String(formData.get("fundingType") ?? "PARTIAL").toUpperCase();
  const deadlineRaw = String(formData.get("deadline") ?? "").trim();
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;

  const base = slugify(title) || "scholarship"; // never allow an empty slug
  let slug = base;
  let n = 2;
  while (await prisma.scholarship.findUnique({ where: { slug } })) {
    slug = `${base}-${n++}`;
  }

  const providerType = String(formData.get("providerType") ?? "UNIVERSITY").toUpperCase();
  const validProviderTypes = ["GOVERNMENT", "UNIVERSITY", "NGO", "FOUNDATION", "PRIVATE", "INTERNATIONAL_ORGANIZATION"];

  const scholarship = await prisma.scholarship.create({
    data: {
      slug,
      title,
      provider,
      description: description || null,
      providerType: validProviderTypes.includes(providerType) ? providerType : "UNIVERSITY",
      countryCode,
      studyLevels: JSON.stringify(levels),
      fields: JSON.stringify(fields),
      eligibleNationalities: JSON.stringify(["ALL"]),
      fundingType: ["FULLY_FUNDED", "FULLY_FUNDED_STIPEND", "TUITION_WAIVER", "PARTIAL"].includes(fundingType)
        ? fundingType
        : "PARTIAL",
      benefits: JSON.stringify([]),
      deadline,
      deadlineTimezone: "CET",
      applicationFee: String(formData.get("applicationFee") ?? "") || null,
      academicRequirements: String(formData.get("academicRequirements") ?? "") || null,
      languageRequirements: JSON.stringify({ ielts: false, toefl: false, noIelts: false, altProof: false, notRequired: false }),
      requiredDocuments: JSON.stringify([]),
      applicationSteps: JSON.stringify([]),
      officialUrl,
      sourceUrl: officialUrl,
      verificationStatus: "COMMUNITY_SUBMITTED",
      status: "PENDING",
      submittedByName: name || null,
      submittedEmail: email || null,
      submittedNote: String(formData.get("notes") ?? "") || null,
    },
  });

  console.log("New scholarship submission:", scholarship.id);
  return { ok: true, id: scholarship.id };
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

async function requireAdminUser() {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) redirect("/signin?next=/admin");
  return user;
}

export async function approveSubmissionAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.update({
    where: { id },
    data: {
      status: "ACTIVE",
      verificationStatus: "RECENTLY_UPDATED",
      lastVerifiedAt: new Date(),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/scholarships");
}

export async function rejectSubmissionAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.update({ where: { id }, data: { status: "REJECTED" } });
  revalidatePath("/admin");
}

export async function setScholarshipStatusAction(id: string, status: string): Promise<void> {
  await requireAdminUser();
  const updated = await prisma.scholarship.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
  // The detail page URL uses the slug, not the internal id.
  revalidatePath(`/scholarships/${updated.slug}`);
  revalidatePath("/scholarships");
}

export async function verifyScholarshipAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.update({
    where: { id },
    data: { verificationStatus: "VERIFIED", lastVerifiedAt: new Date() },
  });
  revalidatePath("/admin");
}

export async function toggleFeaturedAction(id: string, featured: boolean): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.update({ where: { id }, data: { isFeatured: featured } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function toggleTrendingAction(id: string, trending: boolean): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.update({ where: { id }, data: { isTrending: trending } });
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteScholarshipAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.scholarship.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/scholarships");
}

export async function resolveReportAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.report.update({ where: { id }, data: { status: "RESOLVED" } });
  revalidatePath("/admin");
}

export async function setUserRoleAction(id: string, role: string): Promise<void> {
  const admin = await requireAdminUser();
  if (admin.role !== "SUPER_ADMIN") return;
  await prisma.user.update({ where: { id }, data: { role } });
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

// Persists contact-form submissions to the ContactMessage table. No mailer is
// configured (see README), so messages are reviewed in the admin dashboard
// instead of being silently discarded.
export async function submitContactAction(_prevState: ActionResult, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const message = String(formData.get("message") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const topic = String(formData.get("topic") ?? "General question").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (message.length < 5) {
    return { ok: false, error: "Please write a short message so we know how to help." };
  }

  await prisma.contactMessage.create({
    data: { name: name || null, email, topic: topic || "General question", message },
  });
  return { ok: true };
}

export async function resolveContactAction(id: string): Promise<void> {
  await requireAdminUser();
  await prisma.contactMessage.update({ where: { id }, data: { status: "RESOLVED" } });
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function recordViewAction(scholarshipId: string): Promise<void> {
  try {
    await prisma.scholarship.update({
      where: { id: scholarshipId },
      data: { views: { increment: 1 } },
    });
  } catch {
    // non-critical
  }
}

// NOTE: outbound-click and save analytics are intentionally NOT recorded as
// view increments — doing so would misrepresent the view count. If dedicated
// analytics columns are added later, wire real counters here.
