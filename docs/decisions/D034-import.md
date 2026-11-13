# D34 – Import opowiadań (2026-10-30)

Status: aktualna.

- Formaty jak w D31 oraz `.zip` (D18, D32), plik do 50 MB. Parsowanie w przeglądarce (`lib/import/`, ładowane przez `import()`), Server Action `importStories` dostaje tylko tekst. `serverActions.bodySizeLimit` to 4 MB, tekst do 3,5 MB w bajtach (reszta na kodowanie żądania). Akcja waliduje wszystko sama, także przed utworzeniem folderu. Większy tekst trzeba podzielić ręcznie.
- Wszystkie formaty z nagłówkami przechodzą przez markdown (`structureMarkdown`). Pojedyncze `# ` na początku to tytuł, rozdziały to `## `, a bez tytułu i z kilkoma `# ` rozdziały to `# `. Folderu z rozdziałami nie da się pewnie odróżnić od opowiadania z nagłówkami, więc dialog pokazuje listę i przełącznik „Split into N chapters”, domyślnie włączony. `.epub`, `.fb2` i `.zip` mają rozdziały w strukturze, `.pdf` to zawsze jeden rozdział.
- `.md` z eksportu z własnym `# ` w tekście wygląda jak kilka rozdziałów, trzeba wyłączyć przełącznik. W `.zip` plik to zawsze jeden rozdział.
- Decyzja użytkownika: ostatni nagłówek „Notes” rozdziału i końcowa sekcja „Folder notes” wracają do notatek, więc taki sam własny nagłówek też tam trafi. Komentarze zostają w tekście jako `[tekst]` kursywą. `.md` z frontmatterem odzyskuje tytuł i notatki.
- Daty: zawsze data importu, także z frontmatterem. Kolejne rozdziały różnią się o 1 ms, żeby „Newest first” było powtarzalne.
- Nowy folder ma tryb manual z kolejnością z pliku. Na `/stories` jeden rozdział idzie do wybranego folderu (nowa nazwa go tworzy), więcej rozdziałów do nowego folderu. Na stronie folderu do tego folderu, a notatki z pliku są dopisywane pod istniejącymi.
- Sufiksy jak D25 (`numberedTitle`), także w obrębie pliku. Tytuł z równoległego zapisu daje `DUPLICATE_TITLE`, a wstawione rozdziały są usuwane.
- Treść przez `turndown`: pojedynczy Enter to `\n` (D20), `\- ` na początku linii to `– ` (D28), obrazki są pomijane. `.txt` traktujemy jak markdown, pierwsza krótka linia z pustą linią pod spodem to tytuł. `.pdf`: akapity z odstępu między liniami, bez formatowania, nagłówków i pojedynczych Enterów, stąd ostrzeżenie. `.fb2` nie ma pojedynczego Entera, więc takie linie wracają jako akapity. Cytaty z `.docx` wracają jako zwykłe akapity.
- `unpdf` w wersji 2.x wymaga Node 24: taką wersję ma Vercel i domyślny nvm.
