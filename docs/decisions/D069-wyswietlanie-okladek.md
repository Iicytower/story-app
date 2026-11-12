# D69 – Wyświetlanie okładek (2026-11-09)

Status: aktualna.

- Task 40 (subtask 66), decyzje użytkownika. Okładka folderu jest widoczna na liście folderów (`/stories`, miniatura 40×60), na stronie folderu właściciela (120×180), w publicznym spisie folderu (160×240), na każdej publicznej stronie rozdziału (120×180, między tytułem a treścią), w publicznej wyszukiwarce i w „Ostatnio opublikowanych” na stronie głównej (miniatura przy wyniku). Nie ma jej w edytorze. Folder bez okładki nie renderuje obrazka.
- Okładka 18+ (ocena filtra albo ręczne oznaczenie właściciela) na publicznych listach jest zastąpiona polem ze znaczkiem 18+, a w publicznym spisie i na stronie rozdziału jest rozmyta z przyciskiem „Pokaż okładkę (mam ukończone 18 lat)”. Przycisk ustawia to samo cookie co ostrzeżenie przed rozdziałem (D67), więc potwierdzenie działa w obie strony. Właściciel widzi swoje okładki zawsze bez rozmycia.
- Adres `/covers/<id>` zmienia się przy każdej wymianie okładki, więc nowa okładka pokazuje się od razu mimo `immutable`.
