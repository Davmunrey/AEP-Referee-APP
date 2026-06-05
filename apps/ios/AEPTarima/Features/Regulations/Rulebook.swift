import Foundation

/// Un artículo del Reglamento Técnico de la IPF.
struct IpfArticle: Codable, Identifiable, Hashable {
    let num: String
    let title: String
    let text: String
    var id: String { "\(num)·\(title)" }
}

/// Un capítulo del Reglamento Técnico de la IPF (con sus artículos).
struct IpfChapter: Codable, Identifiable, Hashable {
    let num: String
    let title: String
    let articles: [IpfArticle]
    var id: String { num }
}

/// Reglamento IPF empaquetado en la app (`Resources/ipf-rulebook.json`, generado
/// desde `src/lib/ipf-chapters.ts`). Es la normativa real, no la matriz de roles.
/// Contenido estático de referencia → disponible siempre, sin red.
enum Rulebook {
    static let chapters: [IpfChapter] = {
        guard
            let url = Bundle.main.url(forResource: "ipf-rulebook", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let chapters = try? JSONDecoder().decode([IpfChapter].self, from: data)
        else { return [] }
        return chapters
    }()

    /// Capítulos cuyos artículos coinciden con la búsqueda (filtra los artículos).
    static func filtered(_ query: String) -> [IpfChapter] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return chapters }
        return chapters.compactMap { chapter in
            let matches = chapter.articles.filter {
                $0.title.lowercased().contains(q)
                    || $0.text.lowercased().contains(q)
                    || chapter.title.lowercased().contains(q)
            }
            guard !matches.isEmpty else { return nil }
            return IpfChapter(num: chapter.num, title: chapter.title, articles: matches)
        }
    }
}
