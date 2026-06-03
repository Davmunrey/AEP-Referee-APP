import SwiftUI
import AEPTarimaCore

/// Administración de usuarios (push-friendly). Listar, activar/desactivar y
/// crear cuentas. Solo para el comité nacional; el servidor revalida.
struct AdminUsersView: View {
    @Environment(SessionStore.self) private var session
    @State private var model: AdminUsersViewModel?
    @State private var showNew = false

    var body: some View {
        Group {
            if let model {
                LoadableView(state: model.state, retry: { await model.load() }) { users in
                    List(users) { user in
                        AdminUserRow(user: user, disabled: model.isWorking) { activo in
                            Task { await model.setActive(user, activo) }
                        }
                    }
                    .listStyle(.insetGrouped)
                }
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Usuarios")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { showNew = true } label: { Image(systemName: "plus") }
            }
        }
        .sheet(isPresented: $showNew) {
            NewUserSheet { payload in
                await model?.create(payload) ?? false
            }
        }
        .alert(
            "No se pudo completar",
            isPresented: Binding(
                get: { model?.errorMessage != nil },
                set: { if !$0 { model?.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) { model?.errorMessage = nil }
        } message: {
            Text(model?.errorMessage ?? "")
        }
        .task {
            if model == nil { model = AdminUsersViewModel(api: session.api) }
            if case .idle? = model?.state { await model?.load() }
        }
    }
}

private struct AdminUserRow: View {
    let user: AdminUser
    let disabled: Bool
    let onToggle: (Bool) -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(user.nombre).font(.headline)
                Text(user.email).font(.caption).foregroundStyle(.secondary)
                Text(roleLabel + (user.zona.map { " · \($0)" } ?? ""))
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            Spacer()
            Toggle("", isOn: Binding(get: { user.activo }, set: { onToggle($0) }))
                .labelsHidden()
                .disabled(disabled)
        }
        .padding(.vertical, 2)
    }

    private var roleLabel: String {
        switch user.role {
        case .superAdmin: "Super Admin"
        case .delegadoJueces: "Comité de Jueces"
        case .delegadoZona: "Delegado de Zona"
        case .soloVer: "Solo lectura"
        case .unknown: user.rolLabel
        }
    }
}
