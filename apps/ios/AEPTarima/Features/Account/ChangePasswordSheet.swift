import SwiftUI

/// Cambio de contraseña propia. `onChange` devuelve nil si fue correcto, o un
/// mensaje de error a mostrar.
struct ChangePasswordSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onChange: (_ current: String, _ new: String) async -> String?

    @State private var current = ""
    @State private var nuevo = ""
    @State private var confirm = ""
    @State private var working = false
    @State private var errorText: String?

    private var canSubmit: Bool {
        !current.isEmpty && nuevo.count >= 8 && nuevo == confirm && nuevo != current
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    SecureField("Contraseña actual", text: $current)
                    SecureField("Nueva contraseña (mín. 8)", text: $nuevo)
                    SecureField("Repite la nueva", text: $confirm)
                }
                if !confirm.isEmpty && nuevo != confirm {
                    Text("Las contraseñas no coinciden.").foregroundStyle(.red).font(.footnote)
                }
                if let errorText {
                    Text(errorText).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("Cambiar contraseña")
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
        errorText = nil
        Task {
            let error = await onChange(current, nuevo)
            working = false
            if error == nil { dismiss() } else { errorText = error }
        }
    }
}
