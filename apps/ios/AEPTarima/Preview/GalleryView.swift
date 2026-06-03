import SwiftUI
import AEPTarimaCore

/// Escaparate visual de los componentes de la app con datos de ejemplo. No usa
/// red ni sesión: sirve para capturar pantallas en CI (lanzar con -uiPreview) y
/// revisar el aspecto sin backend.
struct GalleryView: View {
    private let referee = Referee(
        id: "j1", nombre: "Ana Juez Martín", zona: "CENTRO", nivel: .nacional,
        estado: .activo, eventos: 18, ultimo: "2026-05-01", disp: true,
        iniciales: "AJ", email: "ana@aep.es"
    )
    private let refereeSancionado = Referee(
        id: "j2", nombre: "Luis Pérez", zona: "NOROESTE", nivel: .regional,
        estado: .sancionado, eventos: 4, ultimo: "—", disp: false, iniciales: "LP"
    )

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    section("KPIs") {
                        HStack(spacing: 12) {
                            kpiCard("Cobertura", "92%", "+3 vs ayer", .blue)
                            kpiCard("Críticos", "2", "requieren atención", .red)
                        }
                    }
                    section("Estados de propuesta") {
                        HStack(spacing: 10) {
                            StatusBadge(status: .pendiente)
                            StatusBadge(status: .aprobado)
                            StatusBadge(status: .rechazado)
                        }
                    }
                    section("Directorio de jueces") {
                        VStack(spacing: 0) {
                            RefereeRow(referee: referee)
                            Divider()
                            RefereeRow(referee: refereeSancionado)
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                    }
                    section("Sin conexión") {
                        OfflineBanner().clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
                .padding()
            }
            .navigationTitle("AEP Tarima · UI")
        }
        .tint(Theme.accent)
    }

    @ViewBuilder
    private func section(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func kpiCard(_ label: String, _ value: String, _ sub: String, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title2).bold().foregroundStyle(color)
            Text(sub).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}
