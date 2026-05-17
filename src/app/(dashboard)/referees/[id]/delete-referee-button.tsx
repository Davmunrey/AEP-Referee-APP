"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";

interface DeleteRefereeButtonProps {
  refereeId: string;
  refereeName: string;
}

export function DeleteRefereeButton({ refereeId, refereeName }: DeleteRefereeButtonProps) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
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

  if (showConfirm) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5">
        <span className="text-xs text-destructive">
          {error ?? `¿Eliminar "${refereeName}"? Esta acción no se puede deshacer.`}
        </span>
        <Button
          size="sm"
          variant="destructive"
          className="h-7 text-xs"
          disabled={deleting}
          onClick={handleDelete}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Confirmar"
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          disabled={deleting}
          onClick={() => {
            setShowConfirm(false);
            setError(null);
          }}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      className="gap-1.5"
      onClick={() => setShowConfirm(true)}
    >
      <Trash2 className="h-3.5 w-3.5" />
      Eliminar juez
    </Button>
  );
}
