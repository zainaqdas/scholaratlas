import { Badge } from "@/components/ui/badge";
import { VERIFICATION_LABELS, VERIFICATION_TONES } from "@/lib/constants";

export function VerificationBadge({ status }: { status: string }) {
  const tone = VERIFICATION_TONES[status] ?? "gray";
  const variant =
    tone === "green" ? "success" : tone === "blue" ? "info" : tone === "amber" ? "warning" : "secondary";
  return <Badge variant={variant}>{VERIFICATION_LABELS[status] ?? status}</Badge>;
}
