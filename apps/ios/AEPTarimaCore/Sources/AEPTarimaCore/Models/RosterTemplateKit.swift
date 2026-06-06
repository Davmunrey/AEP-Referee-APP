import Foundation

/// Utilidades para construir y editar plantillas de tarima desde el cliente.
///
/// Espeja el catálogo de roles y los conjuntos por defecto de `src/lib/mock-data.ts`
/// y `ROLE_LABELS` de `src/lib/roster-template.ts`. Solo se replica el catálogo
/// (pequeño y estable); los presets completos siguen viviendo en el backend
/// (`getPresetForEventType`) y se aplican vía POST para no duplicar datos.
public enum RosterTemplateKit {
    /// Un tipo de rol disponible en el catálogo (clave + etiqueta legible).
    public struct RoleType: Identifiable, Hashable, Sendable {
        public let key: String
        public let label: String
        public var id: String { key }
    }

    /// Catálogo ordenado de roles (espeja `ROLE_LABELS`, en orden de cuadrante AEP).
    public static let roleCatalog: [RoleType] = [
        RoleType(key: "central", label: "Juez Central"),
        RoleType(key: "lateral", label: "Juez Lateral"),
        RoleType(key: "ordenador", label: "Ordenador"),
        RoleType(key: "speaker", label: "Speaker / Mesa"),
        RoleType(key: "control", label: "Juez Control"),
        RoleType(key: "jurado", label: "Jurado"),
        RoleType(key: "liftingcast", label: "Liftingcast / OpenLifter"),
        RoleType(key: "mesa", label: "Mesa"),
        RoleType(key: "pesaje", label: "Pesaje"),
        RoleType(key: "equipamiento", label: "Control Equipamiento"),
        RoleType(key: "material", label: "Material"),
    ]

    /// Etiqueta legible para una clave de rol (fallback: la propia clave capitalizada).
    public static func label(forRoleKey key: String) -> String {
        roleCatalog.first { $0.key == key }?.label ?? key.capitalized
    }

    /// Roles de competición por defecto según el tipo (espeja COMPETICION_ROLES_*).
    public static func defaultRoles(for tipo: EventType) -> [RosterRole] {
        switch tipo {
        case .aep1:
            return [
                RosterRole(rol: "Juez Central", slots: 1, key: "central"),
                RosterRole(rol: "Juez Lateral", slots: 2, key: "lateral"),
                RosterRole(rol: "Ordenador", slots: 1, key: "ordenador"),
                RosterRole(rol: "Speaker / Mesa", slots: 1, key: "speaker"),
                RosterRole(rol: "Juez Control", slots: 1, key: "control"),
                RosterRole(rol: "Jurado", slots: 3, key: "jurado"),
            ]
        case .aep2, .aep3, .unknown:
            return [
                RosterRole(rol: "Juez Central", slots: 1, key: "central"),
                RosterRole(rol: "Juez Lateral", slots: 2, key: "lateral"),
                RosterRole(rol: "Ordenador", slots: 1, key: "ordenador"),
                RosterRole(rol: "Juez Control", slots: 1, key: "control"),
                RosterRole(rol: "Speaker / Mesa", slots: 1, key: "speaker"),
            ]
        }
    }

    /// Bloque de pesaje por defecto (espeja PESAJE_ROLES).
    public static func defaultPesajeRoles() -> [RosterRole] {
        [
            RosterRole(rol: "Pesaje", slots: 1, key: "pesaje"),
            RosterRole(rol: "Control Equipamiento", slots: 1, key: "equipamiento"),
        ]
    }

    /// Crea una sesión en blanco con los roles por defecto del tipo dado.
    /// `number` define el id de sesión (`S<number>`), que debe ser único.
    public static func blankSession(number: Int, tipo: EventType) -> RosterSession {
        RosterSession(
            sesion: "S\(number)",
            nombre: "Sesión \(number)",
            dia: "",
            categorias: [],
            horarioCompeticion: "",
            horarioPesaje: "",
            roles: defaultRoles(for: tipo),
            pesajeRoles: defaultPesajeRoles()
        )
    }

    /// Reasigna ids de sesión correlativos (`S1`, `S2`, …) para garantizar
    /// unicidad tras añadir/eliminar/reordenar. Conserva el resto de campos.
    public static func renumber(_ sessions: [RosterSession]) -> [RosterSession] {
        sessions.enumerated().map { index, session in
            var copy = session
            copy.sesion = "S\(index + 1)"
            return copy
        }
    }
}
