// swift-tools-version: 5.9
import PackageDescription

// Núcleo reutilizable de la app iOS de AEP Tarima: modelos Codable que espejan
// src/lib/types.ts del backend y la capa de red sobre /api/v1. Es Foundation
// puro (sin dependencias externas), así compila y se testea con `swift build`
// y `swift test` en cualquier máquina. Las piezas con dependencias nativas
// (Supabase SDK para auth, GRDB para caché offline) y la UI SwiftUI viven en el
// target de app que se crea en Xcode y depende de este paquete. Ver README.md.
let package = Package(
    name: "AEPTarimaCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "AEPTarimaCore", targets: ["AEPTarimaCore"]),
    ],
    targets: [
        .target(name: "AEPTarimaCore"),
        .testTarget(name: "AEPTarimaCoreTests", dependencies: ["AEPTarimaCore"]),
    ]
)
