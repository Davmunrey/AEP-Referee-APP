import SwiftUI
import AEPTarimaCore

/// Ficha de juez: datos, sanciones, exámenes e informes.
struct RefereeDetailView: View {
    @Environment(SessionStore.self) private var session
    let referee: Referee
    @State private var model: RefereeDetailViewModel?

    var body: some View {
        List {
            Section("Datos") {
                LabeledContent("Nivel", value: referee.nivel.rawValue)
                LabeledContent("Zona", value: referee.zona)
                LabeledContent("Estado", value: referee.estado.rawValue)
                LabeledContent("Eventos", value: "\(referee.eventos)")
                if let email = referee.email { LabeledContent("Correo", value: email) }
                if let lic = referee.licencia { LabeledContent("Licencia", value: lic) }
            }

            if let model {
                switch model.state {
                case .idle, .loading:
                    Section { HStack { Spacer(); ProgressView(); Spacer() } }
                case let .failed(message):
                    Section { Text(message).foregroundStyle(.secondary) }
                case let .loaded(detail):
                    sanctionsSection(detail.sanctions)
                    examsSection(detail.exams)
                    reportsSection(detail.reports)
                }
            }
        }
        .navigationTitle(referee.nombre)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if model == nil { model = RefereeDetailViewModel(api: session.api, refereeId: referee.id) }
            if case .idle? = model?.state { await model?.load() }
        }
    }

    @ViewBuilder private func sanctionsSection(_ items: [RefereeSanction]) -> some View {
        if !items.isEmpty {
            Section("Sanciones") {
                ForEach(items) { s in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(s.motivo).font(.subheadline)
                        Text("\(s.fechaInicio) – \(s.fechaFin) · \(s.status)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder private func examsSection(_ items: [RefereeExam]) -> some View {
        Section("Exámenes") {
            if items.isEmpty {
                Text("Sin exámenes").foregroundStyle(.secondary)
            } else {
                ForEach(items) { e in
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(e.tipo.rawValue) → \(e.nivelObjetivo.rawValue)").font(.subheadline)
                        Text("\(e.fecha) · \(e.resultado.rawValue)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    @ViewBuilder private func reportsSection(_ items: [RefereeReport]) -> some View {
        Section("Informes") {
            if items.isEmpty {
                Text("Sin informes").foregroundStyle(.secondary)
            } else {
                ForEach(items) { r in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.titulo).font(.subheadline)
                        Text(r.tipo.rawValue).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}
