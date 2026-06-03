import SwiftUI
import AEPTarimaCore

/// Edición de la ficha de un juez (PATCH). No permite poner "Sancionado" (eso
/// va por el panel de sanciones). Devuelve el juez actualizado.
struct EditRefereeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let referee: Referee
    let onSave: (RefereePatch) async -> Referee?

    @State private var nombre: String
    @State private var nivel: String
    @State private var estado: String
    @State private var email: String
    @State private var licencia: String
    @State private var localidad: String
    @State private var telefono: String
    @State private var notas: String
    @State private var working = false
    @State private var failed = false

    init(referee: Referee, onSave: @escaping (RefereePatch) async -> Referee?) {
        self.referee = referee
        self.onSave = onSave
        _nombre = State(initialValue: referee.nombre)
        _nivel = State(initialValue: referee.nivel == .unknown ? "Regional" : referee.nivel.rawValue)
        _estado = State(initialValue: referee.estado == .sancionado ? "Activo" : (referee.estado == .unknown ? "Activo" : referee.estado.rawValue))
        _email = State(initialValue: referee.email ?? "")
        _licencia = State(initialValue: referee.licencia ?? "")
        _localidad = State(initialValue: referee.localidad ?? "")
        _telefono = State(initialValue: referee.telefono ?? "")
        _notas = State(initialValue: referee.notas ?? "")
    }

    private let niveles = ["Regional", "Nacional", "IPF Cat. 1", "IPF Cat. 2"]
    private let estados = ["Activo", "Inactivo"]   // "Sancionado" se gestiona aparte

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos") {
                    TextField("Nombre", text: $nombre)
                    Picker("Nivel", selection: $nivel) {
                        ForEach(niveles, id: \.self) { Text($0).tag($0) }
                    }
                    Picker("Estado", selection: $estado) {
                        ForEach(estados, id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("Contacto") {
                    TextField("Correo", text: $email)
                        .textContentType(.emailAddress).keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    TextField("Teléfono", text: $telefono).keyboardType(.phonePad)
                    TextField("Localidad", text: $localidad)
                    TextField("Licencia", text: $licencia)
                }
                Section("Notas") {
                    TextField("Notas", text: $notas, axis: .vertical).lineLimit(2...5)
                }
                if failed {
                    Text("No se pudo guardar.").foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Editar juez")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { submit() }.disabled(nombre.isEmpty || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        failed = false
        Task {
            let patch = RefereePatch(
                nombre: nombre.trimmingCharacters(in: .whitespaces),
                nivel: nivel,
                estado: estado,
                email: email.isEmpty ? nil : email,
                licencia: licencia.isEmpty ? nil : licencia,
                localidad: localidad.isEmpty ? nil : localidad,
                telefono: telefono.isEmpty ? nil : telefono,
                notas: notas.isEmpty ? nil : notas
            )
            let updated = await onSave(patch)
            working = false
            if updated != nil { dismiss() } else { failed = true }
        }
    }
}
