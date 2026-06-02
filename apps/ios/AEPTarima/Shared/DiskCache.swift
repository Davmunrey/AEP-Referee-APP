import Foundation

/// Caché de disco simple (JSON) para lectura offline. Guarda valores Codable en
/// el directorio de caché de la app. Es Foundation puro: sin dependencias y
/// fácil de razonar. Para consultas offline más ricas podría sustituirse por
/// GRDB en el futuro, pero para servir las últimas listas vistas es suficiente.
struct DiskCache: Sendable {
    static let shared = DiskCache()

    private let directory: URL

    init() {
        let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        directory = base.appendingPathComponent("aep-cache", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    private func url(for key: String) -> URL {
        directory.appendingPathComponent("\(key).json")
    }

    func save<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        try? data.write(to: url(for: key), options: .atomic)
    }

    func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = try? Data(contentsOf: url(for: key)) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
