import SwiftUI
import AEPTarimaCore

/// Edición de un campeonato (PATCH /competitions/:id).
struct EditCompetitionSheet: View {
    @Environment(\.dismiss) private var dismiss
    let competition: Competition
    let onSave: (CompetitionPatch) async -> Bool

    @State private var nombre: String
    @State private var tipo: String
    @State private var fecha: Date
    @State private var fechaFin: Date
    @State private var sede: String
    @State private var sesiones: Int
    @State private var requeridos: Int
    @State private var working = false
    @State private var failed = false

    init(competition: Competition, onSave: @escaping (CompetitionPatch) async -> Bool) {
        self.competition = competition
        self.onSave = onSave
        _nombre = State(initialValue: competition.nombre)
        _tipo = State(initialValue: competition.tipo == .unknown ? "AEP-3" : competition.tipo.rawValue)
        _fecha = State(initialValue: ISODate.date(competition.fecha))
        _fechaFin = State(initialValue: ISODate.date(competition.fechaFin))
        _sede = State(initialValue: competition.sede)
        _sesiones = State(initialValue: max(1, min(6, competition.sesiones)))
        _requeridos = State(initialValue: max(1, competition.requeridos))
    }

    private var canSubmit: Bool { !nombre.isEmpty && !sede.isEmpty && fechaFin >= fecha }

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos") {
                    TextField("Nombre", text: $nombre)
                    Picker("Tipo", selection: $tipo) {
                        Text("AEP-1").tag("AEP-1"); Text("AEP-2").tag("AEP-2"); Text("AEP-3").tag("AEP-3")
                    }
                    TextField("Sede", text: $sede)
                    DatePicker("Inicio", selection: $fecha, displayedComponents: .date)
                    DatePicker("Fin", selection: $fechaFin, displayedComponents: .date)
                }
                Section("Plazas") {
                    Stepper("Sesiones: \(sesiones)", value: $sesiones, in: 1...6)
                    Stepper("Requeridos: \(requeridos)", value: $requeridos, in: 1...60)
                }
                if failed { Text("No se pudo guardar.").foregroundStyle(.red).font(.footnote) }
            }
            .navigationTitle("Editar campeonato")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { submit() }.disabled(!canSubmit || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let patch = CompetitionPatch(
                nombre: nombre.trimmingCharacters(in: .whitespaces),
                tipo: tipo,
                fecha: ISODate.string(fecha),
                fechaFin: ISODate.string(fechaFin),
                sede: sede.trimmingCharacters(in: .whitespaces),
                sesiones: sesiones,
                requeridos: requeridos
            )
            let ok = await onSave(patch)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}
