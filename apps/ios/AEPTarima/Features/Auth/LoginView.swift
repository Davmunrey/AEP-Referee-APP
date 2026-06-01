import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    let initialMessage: String?

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(.tint)
            Text("AEP Tarima").font(.largeTitle).bold()
            Text("Gestión de jueces").foregroundStyle(.secondary)

            VStack(spacing: 12) {
                TextField("Correo", text: $email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                SecureField("Contraseña", text: $password)
                    .textContentType(.password)
            }
            .textFieldStyle(.roundedBorder)

            if let message = initialMessage {
                Text(message).font(.footnote).foregroundStyle(.red)
            }

            Button {
                Task { await session.signIn(email: email, password: password) }
            } label: {
                if session.isWorking {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Entrar").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(email.isEmpty || password.isEmpty || session.isWorking)

            Spacer()
        }
        .padding(24)
    }
}
