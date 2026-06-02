import SwiftUI

/// Aviso de que se están mostrando datos en caché por falta de conexión.
struct OfflineBanner: View {
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi.slash")
            Text("Sin conexión · datos en caché")
            Spacer()
        }
        .font(.caption)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.yellow.opacity(0.2))
        .foregroundStyle(.secondary)
    }
}
