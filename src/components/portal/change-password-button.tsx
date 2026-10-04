"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

// El mismo diálogo que la gestión, cargado al abrirlo.
const PasswordDialog = dynamic(() => import("@/components/admin/password-dialog").then((m) => m.PasswordDialog), {
  ssr: false,
});

/** Cambiar la contraseña desde el portal (la creó el juez con su código). */
export function ChangePasswordButton({ nombre }: { nombre: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Cambiar contraseña
      </Button>
      {open && <PasswordDialog mode="self" subject={nombre} onClose={() => setOpen(false)} />}
    </>
  );
}
