import SwiftUI
import AEPTarimaCore

/// Directorio de jueces: lista con búsqueda y navegación al detalle.
struct RefereesView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: RefereesViewModel?
    @State private var query = ""

    var body: some View {
        NavigationStack {
            Group {
                if let model {
                    LoadableView(state: model.state, retry: { await model.load() }) { _ in
                        let results = model.filtered(query)
                        if results.isEmpty {
                            ContentUnavailableView.search(text: query)
                        } else {
                            List(results) { referee in
                                NavigationLink(value: referee) {
                                    RefereeRow(referee: referee)
                                }
                            }
                            .listStyle(.plain)
                        }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Jueces")
            .searchable(text: $query, prompt: "Buscar por nombre o zona")
            .navigationDestination(for: Referee.self) { referee in
                RefereeDetailView(referee: referee)
            }
            .refreshable { await model?.load() }
        }
        .task {
            if model == nil { model = RefereesViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }
}

struct RefereeRow: View {
    let referee: Referee

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(.tint.opacity(0.15)).frame(width: 40, height: 40)
                Text(referee.iniciales).font(.caption).bold().foregroundStyle(.tint)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(referee.nombre).font(.headline)
                Text("\(referee.nivel.rawValue) · \(referee.zona)")
                    .font(.subheadline).foregroundStyle(.secondary)
            }
            Spacer()
            if referee.estado == .sancionado {
                Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(.red)
            } else if !referee.disp {
                Image(systemName: "moon.zzz.fill").foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}
