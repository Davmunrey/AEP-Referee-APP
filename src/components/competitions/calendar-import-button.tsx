"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";

const CalendarImportDialog = dynamic(
  () => import("@/components/competitions/calendar-import-dialog").then((m) => m.CalendarImportDialog),
  { ssr: false },
);

export function CalendarImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        title="Importar calendario AEP en PDF/CSV y crear competiciones de ámbito español"
      >
        <CalendarPlus className="h-4 w-4" />
        Importar calendario AEP
      </Button>
      {open && <CalendarImportDialog open onClose={() => setOpen(false)} />}
    </>
  );
}
