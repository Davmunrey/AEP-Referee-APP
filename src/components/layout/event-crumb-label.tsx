"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api/client";

/** Resolves competition title for `/events/[id]` breadcrumbs. */
export function useEventCrumbLabel(fallback: string): string {
  const pathname = usePathname();
  const [label, setLabel] = useState(fallback);

  useEffect(() => {
    const match = pathname.match(/^\/events\/([^/]+)$/);
    const id = match?.[1];
    if (!id || id === "new") {
      setLabel(fallback);
      return;
    }
    let cancelled = false;
    void api
      .getCompetition(id)
      .then((event) => {
        if (!cancelled) setLabel(event.nombre);
      })
      .catch(() => {
        if (!cancelled) setLabel(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, fallback]);

  return label;
}
