import Foundation
import AEPTarimaCore
import Supabase

/// Implementa `TokenProvider` (del núcleo) con el SDK de Supabase. El SDK
/// persiste la sesión (access + refresh) de forma segura y la auto-refresca;
/// aquí exponemos el token actual y un refresh explícito para los 401.
struct SupabaseTokenProvider: TokenProvider {
    let client: SupabaseClient

    func accessToken() async -> String? {
        // `session` devuelve la sesión vigente, refrescando si hace falta.
        try? await client.auth.session.accessToken
    }

    func refresh() async -> String? {
        try? await client.auth.refreshSession().accessToken
    }
}
