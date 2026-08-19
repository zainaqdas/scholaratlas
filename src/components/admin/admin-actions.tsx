"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Star, Trash2, X } from "lucide-react";
import {
  approveSubmissionAction,
  rejectSubmissionAction,
  bulkApproveSubmissionsAction,
  deleteScholarshipAction,
  resolveReportAction,
  resolveContactAction,
  setScholarshipStatusAction,
  toggleFeaturedAction,
  verifyScholarshipAction,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function ActionButton({
  onClick,
  children,
  variant = "outline",
  className,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "outline" | "ghost" | "destructive";
  className?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={variant}
      size="sm"
      className={className}
      disabled={pending}
      onClick={() => startTransition(onClick)}
      title={title}
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </Button>
  );
}

export function ApproveButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => approveSubmissionAction(id)} className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700">
      <Check className="h-3.5 w-3.5" />
      Approve
    </ActionButton>
  );
}

export function BulkApproveButton({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Approve all {count} pending?</span>
        <Button
          variant="default"
          size="sm"
          className="gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const n = await bulkApproveSubmissionsAction();
            setConfirming(false);
            // Surface the result for non-JS-clear feedback; the page revalidates.
            if (typeof window !== "undefined") window.location.reload();
            void n;
          })}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Check className="h-3.5 w-3.5" />
          Confirm
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-1 text-emerald-600" onClick={() => setConfirming(true)}>
      <Copy className="h-3.5 w-3.5" />
      Approve all {count}
    </Button>
  );
}

export function RejectButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => rejectSubmissionAction(id)} variant="outline" className="gap-1 text-red-600">
      <X className="h-3.5 w-3.5" />
      Reject
    </ActionButton>
  );
}

export function VerifyButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => verifyScholarshipAction(id)} className="gap-1">
      <Check className="h-3.5 w-3.5" />
      Mark Verified
    </ActionButton>
  );
}

export function FeatureButton({ id, featured }: { id: string; featured: boolean }) {
  return (
    <ActionButton onClick={() => toggleFeaturedAction(id, !featured)} variant="ghost" className="gap-1" title={featured ? "Unfeature" : "Feature"}>
      <Star className={`h-3.5 w-3.5 ${featured ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
      {featured ? "Featured" : "Feature"}
    </ActionButton>
  );
}

export function StatusSelect({ id, status }: { id: string; status: string }) {
  return (
    <Select
      value={status}
      onValueChange={(v) => setScholarshipStatusAction(id, v)}
    >
      <SelectTrigger className="h-8 w-32 text-xs" aria-label="Change status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ACTIVE">Active</SelectItem>
        <SelectItem value="EXPIRED">Expired</SelectItem>
        <SelectItem value="ARCHIVED">Archived</SelectItem>
        <SelectItem value="PENDING">Pending</SelectItem>
        <SelectItem value="REJECTED">Rejected</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function DeleteButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => deleteScholarshipAction(id)} variant="ghost" className="gap-1 text-red-600">
      <Trash2 className="h-3.5 w-3.5" />
      Delete
    </ActionButton>
  );
}

export function RemoveDuplicateButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <span className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          className="gap-1"
          disabled={pending}
          onClick={() => startTransition(async () => {
            await deleteScholarshipAction(id);
            setConfirming(false);
            if (typeof window !== "undefined") window.location.reload();
          })}
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Remove
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <Button variant="ghost" size="sm" className="gap-1 text-red-600" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
      Remove duplicate
    </Button>
  );
}

export function ResolveButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => resolveReportAction(id)} className="gap-1">
      <Check className="h-3.5 w-3.5" />
      Resolve
    </ActionButton>
  );
}

export function ResolveContactButton({ id }: { id: string }) {
  return (
    <ActionButton onClick={() => resolveContactAction(id)} className="gap-1">
      <Check className="h-3.5 w-3.5" />
      Mark Resolved
    </ActionButton>
  );
}

export function RoleSelect({ id, role }: { id: string; role: string }) {
  return (
    <Select value={role} onValueChange={(v) => setUserRoleActionSafe(id, v)}>
      <SelectTrigger className="h-8 w-36 text-xs" aria-label="Change role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USER">User</SelectItem>
        <SelectItem value="CONTRIBUTOR">Contributor</SelectItem>
        <SelectItem value="MODERATOR">Moderator</SelectItem>
        <SelectItem value="ADMIN">Admin</SelectItem>
        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
      </SelectContent>
    </Select>
  );
}

// Role select wraps the server action so it isn't imported into the client bundle
// from actions directly (keeps imports tidy).
async function setUserRoleActionSafe(id: string, role: string) {
  const { setUserRoleAction } = await import("@/app/actions");
  return setUserRoleAction(id, role);
}
