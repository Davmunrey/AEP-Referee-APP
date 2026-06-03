import SwiftUI
import AEPTarimaCore

/// Alta de informe sobre un juez (POST /reports, subjectType "juez").
struct NewReportSheet: View {
    @Environment(\.dismiss) private var dismiss
    let refereeId: String
    let onCreate: (NewReportPayload) async -> Bool

    @State private var titulo = ""
    @State private var tipo = "Evaluación"
    @State private var contenido = ""
    @State private var working = false
    @State private var failed = false

    private let tipos = ["General", "Competición", "Juez", "Incidencia", "Evaluación"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Título", text: $titulo)
                    Picker("Tipo", selection: $tipo) { ForEach(tipos, id: \.self) { Text($0).tag($0) } }
                }
                Section("Contenido") {
                    TextField("Contenido", text: $contenido, axis: .vertical).lineLimit(3...8)
                }
                if failed { Text("No se pudo crear.").foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Nuevo informe")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { submit() }.disabled(titulo.isEmpty || contenido.isEmpty || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let payload = NewReportPayload(
                subjectType: "juez",
                refereeId: refereeId,
                titulo: titulo.trimmingCharacters(in: .whitespaces),
                tipo: tipo,
                contenido: contenido.trimmingCharacters(in: .whitespaces)
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}
