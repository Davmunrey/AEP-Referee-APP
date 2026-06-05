import SwiftUI

/// Reglamento Técnico de la IPF: capítulos y artículos con búsqueda de texto
/// completo. Es el reglamento real (empaquetado en la app), no la matriz de
/// roles. Disponible siempre, sin conexión.
struct RegulationsView: View {
    @State private var query = ""

    private var chapters: [IpfChapter] { Rulebook.filtered(query) }

    var body: some View {
        Group {
            if Rulebook.chapters.isEmpty {
                ContentUnavailableView("Reglamento no disponible", systemImage: "book.closed")
            } else if chapters.isEmpty {
                ContentUnavailableView.search(text: query)
            } else {
                List {
                    ForEach(chapters) { chapter in
                        Section {
                            ForEach(chapter.articles) { article in
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                                        Text("\(chapter.num).\(article.num)")
                                            .font(.aepCaption).bold().monospacedDigit()
                                            .foregroundStyle(Theme.accent)
                                        Text(article.title)
                                            .font(.aepHeadline)
                                            .foregroundStyle(Theme.foreground)
                                    }
                                    Text(article.text)
                                        .font(.aepFootnote)
                                        .foregroundStyle(Theme.foregroundSecondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                                .padding(.vertical, 6)
                            }
                        } header: {
                            Text("\(chapter.num). \(chapter.title)")
                                .font(.aepCaption).bold()
                                .foregroundStyle(Theme.subtle)
                        }
                    }
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Reglamento IPF")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Buscar en el reglamento")
    }
}
