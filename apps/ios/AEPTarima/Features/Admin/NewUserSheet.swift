import SwiftUI
import AEPTarimaCore

/// Formulario de alta de usuario. Devuelve el resultado de la creación; si tiene
/// éxito, se cierra.
struct NewUserSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onCreate: (NewUserPayload) async -> Bool

    @State private var email = ""
    @State private var password = ""
    @State private var nombre = ""
    @State private var role = "solo_ver"
    @State private var zona = ""
    @State private var working = false

    private let roles: [(value: String, label: String)] = [
        ("solo_ver", "Solo lectura"),
        ("delegado_zona", "Delegado de Zona"),
        ("delegado_jueces", "Comité de Jueces"),
        ("super_admin", "Super Admin"),
    ]

    private var roleLabel: String { roles.first { $0.value == role }?.label ?? role }
    private var needsZona: Bool { role == "delegado_zona" }
    private var canSubmit: Bool {
        !email.isEmpty && password.count >= 8 && !nombre.isEmpty && (!needsZona || !zona.isEmpty)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Cuenta") {
                    TextField("Correo", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    SecureField("Contraseña (mín. 8)", text: $password)
                    TextField("Nombre", text: $nombre)
                }
                Section("Rol") {
                    Picker("Rol", selection: $role) {
                        ForEach(roles, id: \.value) { Text($0.label).tag($0.value) }
                    }
                    if needsZona {
                        TextField("Zona (código)", text: $zona)
                            .textInputAutocapitalization(.characters)
                            .autocorrectionDisabled()
                    }
                }
            }
            .navigationTitle("Nuevo usuario")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { submit() }
                        .disabled(!canSubmit || working)
                }
            }
        }
    }

    private func submit() {
        working = true
        Task {
            let payload = NewUserPayload(
                email: email.trimmingCharacters(in: .whitespaces).lowercased(),
                password: password,
                nombre: nombre.trimmingCharacters(in: .whitespaces),
                rolLabel: roleLabel,
                role: role,
                zona: needsZona ? zona.trimmingCharacters(in: .whitespaces) : nil
            )
            let ok = await onCreate(payload)
            working = false
            if ok { dismiss() }
        }
    }
}
