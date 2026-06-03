import SwiftUI
import AEPTarimaCore

/// Selector de juez para asignar a una plaza de la tarima.
struct RefereePicker: View {
    @Environment(\.dismiss) private var dismiss
    let referees: [Referee]
    let onSelect: (Referee) -> Void

    @State private var query = ""

    private var filtered: [Referee] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return referees }
        return referees.filter {
            $0.nombre.lowercased().contains(q) || $0.zona.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { referee in
                Button {
                    onSelect(referee)
                    dismiss()
                } label: {
                    RefereeRow(referee: referee)
                }
            }
            .listStyle(.plain)
            .navigationTitle("Asignar juez")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Buscar juez")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
    }
}
