import SwiftUI
import AEPTarimaCore

/// Alta de sanción para un juez (POST /referees/:id/sanctions).
struct NewSanctionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onCreate: (NewSanctionPayload) async -> Bool

    @State private var motivo = ""
    @State private var fechaInicio = Date()
    @State private var duration = "30d"
    @State private var notas = ""
    @State private var working = false
    @State private var failed = false

    private let durations: [(value: String, label: String)] = [
        ("30d", "30 días"),
        ("90d", "90 días"),
        ("180d", "180 días"),
        ("365d", "1 año"),
        ("permanente", "Permanente"),
    ]

    private var canSubmit: Bool { motivo.trimmingCharacters(in: .whitespaces).count >= 10 }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Motivo (mín. 10 caracteres)", text: $motivo, axis: .vertical).lineLimit(2...5)
                    DatePicker("Inicio", selection: $fechaInicio, displayedComponents: .date)
                    Picker("Duración", selection: $duration) {
                        ForEach(durations, id: \.value) { Text($0.label).tag($0.value) }
                    }
                    TextField("Notas (opcional)", text: $notas, axis: .vertical).lineLimit(1...4)
                }
                if failed { Text("No se pudo crear la sanción.").foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Nueva sanción")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Sancionar") { submit() }.disabled(!canSubmit || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let payload = NewSanctionPayload(
                motivo: motivo.trimmingCharacters(in: .whitespaces),
                fechaInicio: ISODate.string(fechaInicio),
                duration: duration,
                notas: notas.isEmpty ? nil : notas
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}
