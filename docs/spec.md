# Aplikacja do opowiadań – specyfikacja funkcjonalna

Oct 3, 2026 · @Szymek

## Cel i stack

Jednoosobowa, prywatna aplikacja webowa do pisania i przechowywania opowiadań w markdown. Opowiadania są domyślnie prywatne, a pojedyncze można udostępnić linkiem tylko do odczytu. Rozwój kończy się na funkcjach opisanych poniżej.

- Framework: Next.js (App Router)
- Hosting: Vercel
- Baza: MongoDB Atlas (zewnętrzna)
- Interfejs: w całości po angielsku (etykiety, komunikaty), tylko desktop, jasny i ciemny motyw z przełącznikiem (dark mode), wybór zapamiętywany w przeglądarce

* Język: TypeScript.
* Dostęp do bazy: Mongoose (schematy, walidacja, indeksy zadeklarowane w schemacie).
* Style: Tailwind CSS z gotowymi komponentami shadcn/ui (m.in. okienko dialogowe do tworzenia opowiadania).

## Logowanie

Dostęp ma jedno konto, zalogowane przez e-mail i hasło.

- Auth.js z providerem Credentials i sesją JWT (sesje w bazie nie działają z Credentials). Sesja trwa 30 dni i odnawia się przy każdym wejściu (licznik 30 dni zeruje się). Osobny refresh token nie jest potrzebny: odnawianie realizuje sama sesja JWT.
- Brak rejestracji i resetu hasła. Konto powstaje jednorazowym skryptem seedującym, który działa interaktywnie: pyta o e-mail, a hasło każe wpisać dwa razy (potwierdzenie).
- Hasło hashowane przez `bcryptjs` (czysty JS, bez problemów na Vercelu).
- Brak limitu prób logowania. Serwer opóźnia każdą odpowiedź logowania o 1,5 s.
- W nagłówku strony jest przycisk wylogowania.
- Wszystkie strony i endpointy API poza `/login` wymagają sesji.

Wyjątek od ochrony sesją: publiczna strona opowiadania (sekcja Udostępnianie przez link).

## Model danych

Jedna kolekcja `stories`, jeden dokument na opowiadanie. Opowiadania nie mają statusów.

| Pole | Typ | Opis |
| --- | --- | --- |
| `title` | string | Tytuł opowiadania, bez limitu długości, unikalny (duplikaty są blokowane, wielkość liter ma znaczenie, tytuły usuniętych opowiadań nie blokują ich użycia) |
| `content` | string | Treść w markdown |
| `notes` | string | Notatki autora (panel boczny) |
| `createdAt` | date | Data utworzenia |
| `updatedAt` | date | Data ostatniego zapisu, używana do kontroli konfliktów |
| shareToken | string | Losowy token publicznego linku, brak = opowiadanie prywatne |
| deletedAt | date | Data soft delete, null = opowiadanie aktywne (pole zawsze zapisane, domyślnie null) |

## Indeksy

Indeksy są zadeklarowane w schemacie Mongoose.

- Unikalność tytułu: unikalny indeks częściowy na `title` z filtrem `{ deletedAt: { $type: "null" } }`. Tytuły usuniętych opowiadań nie blokują użycia tytułu, a wielkość liter ma znaczenie (domyślne porównanie).
- Sortowanie listy: indeks na `updatedAt` (malejąco).
- Unikalny token: unikalny indeks częściowy na `shareToken` z filtrem `{ shareToken: { $type: "string" } }`, żeby wiele prywatnych opowiadań bez tokenu nie kolidowało ze sobą.
- `deletedAt` jest zawsze zapisane (domyślnie `null`), bo filtr indeksu częściowego nie obsługuje warunku „pole nie istnieje”. Zapytania o listę i edytor zawsze filtrują po `deletedAt: null`.
- Do sprawdzenia w aktualnej dokumentacji MongoDB: lista operatorów dozwolonych w filtrze indeksu częściowego. Jeśli któryś nie jest obsługiwany, tworzenie indeksu kończy się błędem od razu, więc problem wyjdzie przy pierwszym uruchomieniu.

## Lista opowiadań

Strona główna to płaska lista opowiadań, bez rozdziałów, tagów i kolekcji.

- Sortowanie po dacie ostatniej edycji, najnowsze na górze.
- Wyszukiwanie po tytule i treści (regex, bez rozróżniania wielkości liter). Wiersz listy pokazuje tytuł i fragment treści z trafieniem. Wyszukiwanie uruchamia się po Enterze. Bez wyszukiwania fragment to początek treści.
- Przycisk tworzenia nowego opowiadania. Tytuł podaje się przy tworzeniu.
- Usuwanie typu soft delete, poprzedzone potwierdzeniem: opowiadanie znika z listy i wyszukiwania, ale zostaje w bazie. Brak widoku kosza.

## Edytor

Edytor ma dwa panele obok siebie: zwykły `textarea` po lewej i podgląd na żywo po prawej.

- Markdown podstawowy: nagłówki, pogrubienie, kursywa, listy, cytaty. Pojedynczy Enter oznacza złamanie linii w podglądzie (np. przez remark-breaks).
- Komentarze `<!-- tekst -->` są widoczne w edytorze, a ukryte w podglądzie.
- Zwijany panel boczny z notatkami do opowiadania.
- Autozapis około 3 s po ostatnim naciśnięciu klawisza. Ctrl+S wymusza zapis od razu.
- Licznik słów i znaków.
- Edytor pokazuje stan zapisu (zapisywanie, zapisano, błąd zapisu), a przy błędzie wyświetla komunikat z opisem przyczyny. Edytor nie ponawia zapisu sam: próba powtarza się przy kolejnej zmianie.
- Tytuł można zmienić w edytorze. Duplikat tytułu jest blokowany.
- Brak historii wersji i skrótów formatowania (Ctrl+B/I).

Przyciski „Share” i „Stop sharing” w edytorze: opis w sekcji Udostępnianie przez link.

## Eksport

Dostępny jest tylko eksport pojedynczego opowiadania do pliku .md. Eksportu zbiorczego nie ma.

- Pojedyncze opowiadanie: przycisk „Export .md” w edytorze. Plik zaczyna się frontmatterem YAML (`title`, `createdAt`, `updatedAt`, `notes`), po nim treść. Komentarze HTML zostają w pliku. Nazwa pliku to tytuł zamieniony na bezpieczną nazwę (bez polskich znaków i znaków specjalnych), wartości YAML są bezpiecznie cytowane, a daty mają format ISO 8601.

## Udostępnianie przez link

Pojedyncze opowiadanie można udostępnić publicznie linkiem tylko do odczytu. Domyślnie wszystkie są prywatne.

- Przycisk „Share” w edytorze generuje losowy `shareToken` (minimum 16 znaków, np. `nanoid`) i pokazuje link `/s/[token]`. Identyfikator `_id` z Mongo nie jest używany, bo jest przewidywalny.
- Przycisk „Stop sharing” usuwa token, a stary link przestaje działać. Soft delete opowiadania też wyłącza link (strona zwraca 404).
- Strona `/s/[token]` jest renderowana na serwerze i pokazuje tylko tytuł i treść. Pole `notes` nie jest w ogóle pobierane z bazy.
- Treść przechodzi przez funkcję `stripComments`, która usuwa komentarze `<!-- -->` przed wysłaniem odpowiedzi. Filtr działa wyłącznie po stronie serwera, więc komentarze nie trafiają do przeglądarki odbiorcy.
- Niedomknięty komentarz (`<!--` bez `-->`) obcina tekst od tego miejsca do końca. Filtr powtarza się w pętli, aż tekst przestanie się zmieniać, a jeśli nadal zawiera `<!--`, obcina resztę.
- Funkcja ma test jednostkowy: komentarz wielolinijkowy, niedomknięty, zagnieżdżony i sklejony.
- Strona ma `noindex` (meta tag i nagłówek).
- Każdy, kto zna link, ma dostęp, a token nie wygasa sam. To nie jest kontrola dostępu.

## Architektura i ścieżki

Podział odpowiedzialności między mechanizmy Next.js:

- **Odczyt danych:** Server Components czytają z bazy bezpośrednio (lista, edytor, strona publiczna), bez własnego API.
- **Zapis danych:** Server Actions (utworzenie, autozapis, usunięcie, włączenie i wyłączenie udostępniania). Każda akcja sama sprawdza sesję, bo jest publicznym endpointem POST.
- **Błędy w akcjach:** akcje zwracają obiekt `{ ok: false, error }` z opisem przyczyny zamiast rzucać wyjątek, bo w produkcji treść wyjątków jest ukrywana. Dzięki temu edytor może pokazać konkretny komunikat (np. o konflikcie zapisu).
- **Route Handlers:** tylko tam, gdzie potrzebna jest odpowiedź HTTP: eksport pliku `.md` (nagłówek `Content-Disposition`) oraz Auth.js (`/api/auth/[...nextauth]`).

Strony:

| Ścieżka | Opis | Dostęp |
| --- | --- | --- |
| `/` | Przekierowanie do `/stories` | sesja |
| `/login` | Logowanie | publiczna |
| `/stories` | Lista opowiadań, wyszukiwanie, tworzenie | sesja |
| `/stories/[id]` | Edytor opowiadania | sesja |
| `/s/[token]` | Publiczny widok opowiadania (tylko odczyt) | publiczna |

Tworzenie opowiadania: przycisk na `/stories` otwiera okienko (modal) z polem tytułu. Po zatwierdzeniu powstaje opowiadanie z pustą treścią i następuje przejście do edytora.

## Server Actions i Route Handlers

Każda akcja sprawdza sesję i zwraca obiekt zamiast rzucać wyjątek: `{ ok: true, ... }` albo `{ ok: false, error, message }`. Pole `message` jest po angielsku i trafia do komunikatu w edytorze.

| Akcja | Wejście | Działanie |
| --- | --- | --- |
| `createStory` | `title` | Tworzy opowiadanie z pustą treścią i notatkami, zwraca `id`. Klient przechodzi do `/stories/[id]`. |
| `saveStory` | `id`, `title`, `content`, `notes`, `expectedUpdatedAt` | Zapisuje wszystkie trzy pola naraz. Używana przez autozapis, Ctrl+S i eksport. Zwraca nowy `updatedAt`. |
| `deleteStory` | `id` | Soft delete: ustawia `deletedAt` na bieżącą datę. |
| `setSharing` | `id`, `enabled` | Włączenie generuje `shareToken`, wyłączenie go usuwa. Zwraca link lub potwierdzenie wyłączenia. |

Kody błędów: `UNAUTHORIZED`, `NOT_FOUND` (także dla usuniętych), `CONFLICT` (w bazie jest nowszy `updatedAt`), `DUPLICATE_TITLE`, `EMPTY_TITLE`, `EMPTY_CONTENT` (zamiana niepustej treści na pustą).

Zasady zapisu:

- Zmiana tytułu zapisuje się razem z treścią w autozapisie.
- Przy pustym tytule autozapis w ogóle się nie uruchamia (prosty warunek na froncie). Tekst wpisany w tym czasie zapisze się dopiero po wpisaniu tytułu.
- Przy zduplikowanym tytule serwer odrzuca cały zapis z błędem `DUPLICATE_TITLE`, a treść zapisze się dopiero po zmianie tytułu na unikalny. Przejściowe duplikaty są możliwe w trakcie pisania, gdy wpisany początek jest równy innemu tytułowi.

Usuwanie: przycisk jest na liście i w edytorze, zawsze z potwierdzeniem w oknie dialogowym. Po usunięciu w edytorze następuje przejście do `/stories`.

Route Handlers:

- Eksport: `GET /stories/[id]/export`. Wymaga sesji, zwraca 404 dla usuniętych, odpowiada plikiem `.md` jako załącznikiem (`Content-Disposition`).
- Auth.js: `/api/auth/[...nextauth]`.

Przebieg eksportu: przycisk „Export .md” najpierw wywołuje `saveStory` z bieżącym stanem edytora. Dopiero po sukcesie przeglądarka pobiera plik z Route Handlera. Jeśli zapis się nie uda, eksport się nie uruchamia, a edytor pokazuje komunikat błędu.

## Uwagi implementacyjne

Brak historii wersji sprawia, że główne ryzyko to utrata tekstu, więc zapis wymaga zabezpieczeń.

- Serwer odrzuca zapis, który zamienia niepustą treść na pustą (ochrona przed błędem sieci lub przypadkowym wyczyszczeniem pola). Konsekwencja: nie da się skasować całego tekstu opowiadania. Nowe opowiadanie startuje z tytułem i pustą treścią, a pierwszy zapis niepustej treści jest dozwolony.
- Klient wysyła `updatedAt`, który widział. Jeśli w bazie jest nowszy, serwer odrzuca zapis (ochrona przed nadpisaniem z drugiej karty). Edytor pokazuje wtedy komunikat o błędzie z konkretnym opisem przyczyny, np. że opowiadanie zostało zmienione w innej karcie lub na innym urządzeniu.
- Ostrzeżenie przy zamykaniu karty z niezapisanymi zmianami.
- Klient MongoDB cache'owany globalnie, żeby funkcje serverless nie otwierały nowego połączenia przy każdym wywołaniu.
- Podgląd przez `react-markdown` bez `rehype-raw`: komentarze HTML znikają same, a treść pozostaje chroniona przed XSS.
- Atlas: Vercel nie ma stałych adresów IP, więc dostęp trzeba otworzyć na `0.0.0.0/0` i polegać na silnym haśle do bazy.
- Darmowy tier Atlasa (M0) nie ma automatycznych backupów (do potwierdzenia w aktualnej dokumentacji).

* Dokumenty Mongoose zwracaj z `.lean()` i zamieniaj `_id` oraz daty na stringi, bo Server Actions i komponenty klienckie nie przyjmują obiektów Mongoose.
* Model rejestruj jako `mongoose.models.Story ?? mongoose.model(...)`, bo przeładowanie kodu w trybie developerskim próbuje zdefiniować go ponownie.

## Zmienne środowiskowe

- `MONGODB_URI`: connection string do MongoDB Atlas (używany przez aplikację i skrypt tworzący konto).
- `AUTH_SECRET`: losowy sekret do podpisywania sesji JWT. Jego zmiana unieważnia wszystkie sesje.
- Lokalnie zmienne trzymaj w `.env.local` (plik w `.gitignore`), na Vercelu w ustawieniach projektu.
- E-mail i hasło konta nie są zmiennymi środowiskowymi: skrypt pyta o nie interaktywnie.
- Ewentualne dodatkowe zmienne Auth.js zależą od wersji i trzeba je sprawdzić w dokumentacji podczas implementacji.
