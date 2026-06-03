import SwiftUI
import AEPTarimaCore

/// Alta de campeonato. El delegado de zona queda fijado a su zona.
struct NewCompetitionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let user: SessionUser
    let onCreate: (NewCompetitionPayload) async -> Bool

    @State private var nombre = ""
    @State private var tipo = "AEP-3"
    @State private var fecha = Date()
    @State private var fechaFin = Date()
    @State private var sede = ""
    @State private var sesiones = 3
    @State private var requeridos = 9
    @State private var zona = ""
    @State private var working = false
    @State private var failed = false

    private var isZonaDelegate: Bool { user.role == .delegadoZona }
    private var canSubmit: Bool { !nombre.isEmpty && !sede.isEmpty && fechaFin >= fecha }

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos") {
                    TextField("Nombre", text: $nombre)
                    Picker("Tipo", selection: $tipo) {
                        Text("AEP-1").tag("AEP-1")
                        Text("AEP-2").tag("AEP-2")
                        Text("AEP-3").tag("AEP-3")
                    }
                    TextField("Sede", text: $sede)
                    DatePicker("Inicio", selection: $fecha, displayedComponents: .date)
                    DatePicker("Fin", selection: $fechaFin, displayedComponents: .date)
                }
                Section("Plazas") {
                    Stepper("Sesiones: \(sesiones)", value: $sesiones, in: 1...6)
                    Stepper("Requeridos: \(requeridos)", value: $requeridos, in: 1...60)
                }
                if !isZonaDelegate {
                    Section("Zona") {
                        TextField("Código de zona (opcional)", text: $zona)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }
                }
                if failed {
                    Text("No se pudo crear. Revisa los datos.")
                        .foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Nuevo campeonato")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { submit() }.disabled(!canSubmit || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let payload = NewCompetitionPayload(
                nombre: nombre.trimmingCharacters(in: .whitespaces),
                tipo: tipo,
                fecha: ISODate.string(fecha),
                fechaFin: ISODate.string(fechaFin),
                sede: sede.trimmingCharacters(in: .whitespaces),
                sesiones: sesiones,
                requeridos: requeridos,
                zona: isZonaDelegate ? user.zona : (zona.isEmpty ? nil : zona)
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}

/// Formateo de fecha ISO (YYYY-MM-DD) estable, independiente del locale.
enum ISODate {
    static func string(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}
