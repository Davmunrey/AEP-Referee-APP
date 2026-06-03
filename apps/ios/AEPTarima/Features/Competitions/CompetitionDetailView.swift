import SwiftUI
import AEPTarimaCore

/// Detalle de un campeonato: datos, acceso a la tarima, edición y confirmación
/// de disponibilidad de jueces.
struct CompetitionDetailView: View {
    @Environment(SessionStore.self) private var session
    let user: SessionUser
    @State private var model: CompetitionDetailViewModel? = nil
    @State private var showEdit = false
    @State private var showAvailability = false

    private let initialCompetition: Competition

    init(competition: Competition, user: SessionUser) {
        self.user = user
        self.initialCompetition = competition
    }

    private var canEdit: Bool {
        switch user.role {
        case .superAdmin, .delegadoJueces: return true
        case .delegadoZona: return user.zona != nil && user.zona == initialCompetition.zona
        case .soloVer, .unknown: return false
        }
    }

    var body: some View {
        let competition = model?.competition ?? initialCompetition
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
                    RosterView(competition: competition, canEdit: canEdit)
                } label: {
                    Label("Tarima", systemImage: "square.grid.3x3.fill")
                }
                if canEdit {
                    Button {
                        showAvailability = true
                    } label: {
                        Label("Confirmar disponibilidad", systemImage: "checkmark.circle")
                    }
                }
            }
        }
        .navigationTitle(competition.nombre)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if canEdit {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Editar") { showEdit = true }
                }
            }
        }
        .sheet(isPresented: $showEdit) {
            EditCompetitionSheet(competition: competition) { patch in
                await model?.update(patch) ?? false
            }
        }
        .sheet(isPresented: $showAvailability) {
            RefereePicker(referees: model?.referees ?? []) { referee in
                Task { await model?.confirmAvailability(referee.id) }
            }
        }
        .alert(
            "No se pudo completar",
            isPresented: Binding(
                get: { model?.errorMessage != nil },
                set: { if !$0 { model?.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { model?.errorMessage = nil }
        } message: {
            Text(model?.errorMessage ?? "")
        }
        .task {
            if model == nil { model = CompetitionDetailViewModel(api: session.api, competition: initialCompetition) }
            await model?.loadReferees()
        }
    }
}
