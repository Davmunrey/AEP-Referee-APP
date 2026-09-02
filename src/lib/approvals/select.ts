import type { ApprovalProposal } from "@/lib/types";

/**
 * Propuesta mostrada en el panel de detalle a partir del id seleccionado.
 *
 * Se resuelve contra la lista viva en cada render en vez de guardar el objeto:
 * al refrescar desde el servidor tras revisar una propuesta, la copia
 * capturada quedaba obsoleta y el detalle seguía enseñando el estado y el
 * comentario anteriores (o una propuesta que ya no estaba en la lista)
 * mientras la columna de la izquierda ya se había actualizado.
 */
export function selectedApproval(
  items: ApprovalProposal[],
  selectedId: string | null,
): ApprovalProposal | null {
  return (
    items.find((a) => a.id === selectedId) ??
    items.find((a) => a.status === "pendiente") ??
    items[0] ??
    null
  );
}
