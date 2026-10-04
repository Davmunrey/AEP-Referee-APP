"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/confirm-dialog";
import { api } from "@/lib/api/client";

interface DeleteRefereeButtonProps {
  refereeId: string;
  refereeName: string;
}

/**
 * Eliminar desde la ficha, en tono discreto: antes era un botón rojo relleno
 * junto a «Editar», con más peso que cualquier otra acción de la cabecera.
 * Ahora es texto rojo sin relleno y la confirmación es la común de la app,
 * con el mismo texto que en el directorio.
 */
export function DeleteRefereeButton({ refereeId, refereeName }: DeleteRefereeButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const ok = await confirmar({
      titulo: `¿Eliminar a ${refereeName} del censo?`,
      detalle: "Se borra su ficha. No se puede deshacer; si solo deja de arbitrar, márcalo como inactivo.",
      accion: "Eliminar juez",
      peligro: true,
    });
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteReferee(refereeId);
      router.push("/referees");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
      setDeleting(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-destructive hover:bg-destructive-muted hover:text-destructive max-sm:h-9"
        disabled={deleting}
        onClick={() => void handleDelete()}
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        Eliminar juez
      </Button>
      {error && (
        <p role="alert" className="basis-full text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
