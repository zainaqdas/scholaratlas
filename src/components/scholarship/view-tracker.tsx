"use client";

import { useEffect } from "react";
import { recordViewAction } from "@/app/actions";

export function ViewTracker({ scholarshipId }: { scholarshipId: string }) {
  useEffect(() => {
    recordViewAction(scholarshipId);
  }, [scholarshipId]);
  return null;
}
