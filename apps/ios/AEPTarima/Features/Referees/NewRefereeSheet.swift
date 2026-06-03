import SwiftUI
import AEPTarimaCore

/// Alta de juez. El delegado de zona queda fijado a su zona.
struct NewRefereeSheet: View {
    @Environment(\.dismiss) private var dismiss
    let user: SessionUser
    let onCreate: (NewRefereePayload) async -> Bool

    @State private var nombre = ""
    @State private var zona = ""
    @State private var nivel = "Regional"
    @State private var estado = "Activo"
    @State private var email = ""
    @State private var licencia = ""
    @State private var working = false
    @State private var failed = false

    private let niveles = ["Regional", "Nacional", "IPF Cat. 1", "IPF Cat. 2"]
    private let estados = ["Activo", "Inactivo", "Sancionado"]

    private var isZonaDelegate: Bool { user.role == .delegadoZona }
    private var effectiveZona: String { isZonaDelegate ? (user.zona ?? "") : zona }
    private var canSubmit: Bool { !nombre.isEmpty && !effectiveZona.isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                Section("Datos") {
                    TextField("Nombre", text: $nombre)
                    if isZonaDelegate {
                        LabeledContent("Zona", value: user.zona ?? "—")
                    } else {
                        TextField("Zona (código)", text: $zona)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }
                    Picker("Nivel", selection: $nivel) {
                        ForEach(niveles, id: \.self) { Text($0).tag($0) }
                    }
                    Picker("Estado", selection: $estado) {
                        ForEach(estados, id: \.self) { Text($0).tag($0) }
                    }
                }
                Section("Contacto (opcional)") {
                    TextField("Correo", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField("Licencia", text: $licencia)
                }
                if failed {
                    Text("No se pudo crear. Revisa los datos.")
                        .foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Nuevo juez")
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
            let payload = NewRefereePayload(
                nombre: nombre.trimmingCharacters(in: .whitespaces),
                zona: effectiveZona,
                nivel: nivel,
                estado: estado,
                email: email.isEmpty ? nil : email.trimmingCharacters(in: .whitespaces),
                licencia: licencia.isEmpty ? nil : licencia.trimmingCharacters(in: .whitespaces)
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() } else { failed = true }
        }
    }
}
