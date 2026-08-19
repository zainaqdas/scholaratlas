"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSavedIdsAction } from "@/app/actions";

// On statically-cached (ISR) pages the server can't know the per-user saved
// set (that would require reading the session and opt the page out of the
// cache). This provider fetches it once per page and SaveButtons read from it.
const SavedContext = createContext<Set<string>>(new Set());

export function useSavedIds(): Set<string> {
  return useContext(SavedContext);
}

export function SavedStateProvider({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const key = ids.join(",");

  useEffect(() => {
    if (!ids.length) return;
    let active = true;
    getSavedIdsAction(ids)
      .then((r) => {
        if (active) setSaved(new Set(r));
      })
      .catch(() => {
        // leave empty — buttons just render unsaved
      });
    return () => {
      active = false;
    };
  }, [key, ids]);

  return <SavedContext.Provider value={saved}>{children}</SavedContext.Provider>;
}
