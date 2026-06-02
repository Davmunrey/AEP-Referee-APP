import SwiftUI
import AEPTarimaCore

/// Detalle de un campeonato, con acceso a la tarima.
struct CompetitionDetailView: View {
    let competition: Competition
    let user: SessionUser

    var body: some View {
        List {
            Section("Datos") {
                LabeledContent("Tipo", value: competition.tipo.rawValue)
                LabeledContent("Sede", value: competition.sede)
                LabeledContent("Fechas", value: "\(competition.fecha) – \(competition.fechaFin)")
                LabeledContent("Sesiones", value: "\(competition.sesiones)")
                LabeledContent("Cobertura", value: "\(competition.confirmados)/\(competition.requeridos)")
                LabeledContent("Estado", value: competition.estado.rawValue)
                LabeledContent("Aprobación", value: competition.aprobacion)
                if let zona = competition.zona { LabeledContent("Zona", value: zona) }
            }
            Section {
                NavigationLink {
                    RosterView(competition: competition, canEdit: canEditRoster)
                } label: {
                    Label("Tarima", systemImage: "square.grid.3x3.fill")
                }
            }
        }
        .navigationTitle(competition.nombre)
        .navigationBarTitleDisplayMode(.inline)
    }

    /// Gating de UX (el servidor revalida): comité nacional siempre; delegado de
    /// zona solo en su zona.
    private var canEditRoster: Bool {
        switch user.role {
        case .superAdmin, .delegadoJueces:
            return true
        case .delegadoZona:
            return user.zona != nil && user.zona == competition.zona
        case .soloVer, .unknown:
            return false
        }
    }
}
