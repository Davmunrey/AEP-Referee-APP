import SwiftUI
import AEPTarimaCore

/// Normativa IPF: requisitos por rol y tipo de evento. Funciona offline.
struct RegulationsView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: RegulationsViewModel?
    @State private var query = ""

    var body: some View {
        Group {
            if let model {
                VStack(spacing: 0) {
                    if model.isOffline { OfflineBanner() }
                    LoadableView(state: model.state, retry: { await model.load() }) { _ in
                        let rules = model.filtered(query)
                        if rules.isEmpty {
                            ContentUnavailableView.search(text: query)
                        } else {
                            List(rules) { rule in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(rule.rol).font(.headline)
                                        Spacer()
                                        Text(rule.minLevel.rawValue)
                                            .font(.caption).bold()
                                            .foregroundStyle(.tint)
                                    }
                                    if !rule.eventTypes.isEmpty {
                                        Text(rule.eventTypes.map(\.rawValue).joined(separator: " · "))
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    if !rule.note.isEmpty {
                                        Text(rule.note).font(.subheadline)
                                    }
                                }
                                .padding(.vertical, 2)
                            }
                            .listStyle(.insetGrouped)
                        }
                    }
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Normativa IPF")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Buscar rol o requisito")
        .task {
            if model == nil { model = RegulationsViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }
}
