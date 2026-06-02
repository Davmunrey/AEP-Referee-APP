import SwiftUI

/// Estado genérico de carga para las vistas que piden datos a la API.
enum Loadable<Value> {
    case idle
    case loading
    case loaded(Value)
    case failed(String)
}

/// Vista reutilizable que renderiza los estados loading / error / vacío y
/// delega el contenido cargado a un closure.
struct LoadableView<Value, Content: View>: View {
    let state: Loadable<Value>
    let retry: () async -> Void
    @ViewBuilder let content: (Value) -> Content

    var body: some View {
        switch state {
        case .idle, .loading:
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        case let .loaded(value):
            content(value)
        case let .failed(message):
            ContentUnavailableView {
                Label("No se pudo cargar", systemImage: "wifi.exclamationmark")
            } description: {
                Text(message)
            } actions: {
                Button("Reintentar") { Task { await retry() } }
            }
        }
    }
}
