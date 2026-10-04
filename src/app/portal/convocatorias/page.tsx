export const metadata = { title: "Convocatorias · Portal del juez" };

export default function PortalCallsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Convocatorias</h1>
      <p className="surface-card rounded-xl px-4 py-6 text-center text-sm text-muted-foreground">
        No hay convocatorias abiertas para ti ahora mismo. Cuando tu delegado lance una, aparecerá aquí y podrás
        apuntarte a cada sesión.
      </p>
    </div>
  );
}
