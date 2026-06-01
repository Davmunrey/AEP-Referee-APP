import Foundation

/// Lee la configuración del entorno desde Info.plist (alimentado por
/// Config.xcconfig). Compone las URLs con esquema https en código, porque
/// .xcconfig no permite escribir "//".
enum AppConfig {
    private static func string(_ key: String) -> String {
        (Bundle.main.object(forInfoDictionaryKey: key) as? String) ?? ""
    }

    /// Base de la API REST, p. ej. https://deploy.vercel.app/api/v1
    static var apiBaseURL: URL {
        let host = string("API_HOST")
        let path = string("API_BASE_PATH")
        guard let url = URL(string: "https://\(host)\(path)") else {
            fatalError("API_HOST/API_BASE_PATH inválidos en Config.xcconfig")
        }
        return url
    }

    static var supabaseURL: URL {
        guard let url = URL(string: "https://\(string("SUPABASE_HOST"))") else {
            fatalError("SUPABASE_HOST inválido en Config.xcconfig")
        }
        return url
    }

    static var supabaseAnonKey: String { string("SUPABASE_ANON_KEY") }
}
