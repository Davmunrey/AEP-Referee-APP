import SwiftUI

struct LoginView: View {
    @Environment(SessionStore.self) private var session
    let initialMessage: String?

    @State private var email = ""
    @State private var password = ""

    var body: some View {
        VStack(spacing: 16) {
            Spacer()
            Image("AEPMark")
                .resizable()
                .scaledToFit()
                .frame(width: 96, height: 96)
                .accessibilityLabel("AEP")
            Text("AEP Tarima")
                .font(.aepLargeTitle).bold()
                .foregroundStyle(Theme.foreground)
            Text("Gestión de jueces")
                .font(.aepBody)
                .foregroundStyle(Theme.subtle)

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
                Text(message).font(.aepFootnote).foregroundStyle(Theme.danger)
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
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.background)
    }
}
