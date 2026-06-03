import SwiftUI
import AEPTarimaCore

/// Alta de examen para un juez (POST /exams).
struct NewExamSheet: View {
    @Environment(\.dismiss) private var dismiss
    let refereeId: String
    let onCreate: (NewExamPayload) async -> Bool

    @State private var tipo = "Recertificación"
    @State private var nivelObjetivo = "Nacional"
    @State private var fecha = Date()
    @State private var examinador = ""
    @State private var puntuacion = ""
    @State private var resultado = "Pendiente"
    @State private var notas = ""
    @State private var working = false
    @State private var failed = false

    private let tipos = ["Nuevo juez", "Ascenso IPF", "Recertificación"]
    private let niveles = ["Regional", "Nacional", "IPF Cat. 1", "IPF Cat. 2"]
    private let resultados = ["Pendiente", "Aprobado", "Suspenso"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Tipo", selection: $tipo) { ForEach(tipos, id: \.self) { Text($0).tag($0) } }
                    Picker("Nivel objetivo", selection: $nivelObjetivo) { ForEach(niveles, id: \.self) { Text($0).tag($0) } }
                    DatePicker("Fecha", selection: $fecha, displayedComponents: .date)
                    TextField("Examinador", text: $examinador)
                }
                Section("Resultado") {
                    Picker("Resultado", selection: $resultado) { ForEach(resultados, id: \.self) { Text($0).tag($0) } }
                    TextField("Puntuación (opcional)", text: $puntuacion).keyboardType(.numberPad)
                    TextField("Notas", text: $notas, axis: .vertical).lineLimit(1...4)
                }
                if failed { Text("No se pudo crear.").foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Nuevo examen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { submit() }.disabled(examinador.isEmpty || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let payload = NewExamPayload(
                refereeId: refereeId,
                tipo: tipo,
                nivelObjetivo: nivelObjetivo,
                fecha: ISODate.string(fecha),
                examinador: examinador.trimmingCharacters(in: .whitespaces),
                puntuacion: Double(puntuacion),
                resultado: resultado,
                notas: notas.isEmpty ? nil : notas
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}
