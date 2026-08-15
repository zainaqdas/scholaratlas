"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportScholarshipAction } from "@/app/actions";

const REASONS = [
  "Incorrect information",
  "Expired scholarship",
  "Broken link",
  "Incorrect deadline",
  "Eligibility information incorrect",
  "Suspicious/fraudulent listing",
  "Duplicate listing",
  "Other",
];

export function ReportDialog({ scholarshipId }: { scholarshipId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!reason) return;
    setPending(true);
    const form = new FormData();
    form.set("scholarshipId", scholarshipId);
    form.set("reason", reason);
    form.set("message", message);
    await reportScholarshipAction(form);
    setPending(false);
    setDone(true);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(() => setDone(false), 300); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="gap-1.5 text-muted-foreground">
          <Flag className="h-4 w-4" />
          Report Incorrect Information
        </Button>
      </DialogTrigger>
      <DialogContent>
        {done ? (
          <div className="py-6 text-center">
            <p className="font-display text-lg font-bold">Thank you</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your report has been sent to our moderation team for review.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Report Incorrect Information</DialogTitle>
              <DialogDescription>
                Help us keep scholarship data accurate. Reports go straight to our moderation queue.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="reason" aria-label="Select a reason">
                    <SelectValue placeholder="What's wrong?" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Details (optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what's incorrect..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={!reason || pending} className="gap-1.5">
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit Report
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
