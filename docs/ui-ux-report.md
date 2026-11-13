# Raport UI/UX – propozycje poprawek

Data: 2026-11-14, branch `feature/social`. Bez screenshotów (stan po e9b80ff; poprzednie raporty są w historii gita). Nie powtarza tego, co jest w D083 i w backlogu `docs/tasks/README.md`.

Metoda:
- Audyt wizualny Playwright (`ui-checker`): `/pl`, desktop 1280×800 jasny (większość stron) i ciemny (książka, czytelnik, admin, profil), mobile 375×812 tylko ciemny. Nie sprawdzono: jasnego motywu na mobile, pełnych przepływów wiadomości i publikacji, 404.
- Przegląd kodu i wzorców (`researcher`): kod UI, zasady z `guidelines.md`, Royal Road, iA Writer, Baymard i inne. Źródła wtórne oznaczone.
- Ograniczenie: MCP shadcn nie było dostępne w sesji badawczej. Dopasowania do komponentów shadcn pochodzą z wiedzy o rejestrze – przed implementacją sprawdzić je przez `view_items_in_registries`.
- Konsola: brak błędów JS i CSP, brak poziomego scrolla na sprawdzonych widokach mobile.

Skala: nakład S/M/L, wpływ wysoki/średni/niski.

## 1. Co działa dobrze

- Spójna ciepła paleta, poprawny ciemny motyw.
- Sidebar: czytelny aktywny element, badge'e z `aria-label`, drawer na mobile.
- `/feed` jako karty, `/stats` z wykresem z `aria-label` i podpowiedzią przewijania tabeli.
- Edytor na desktopie: licznik słów, status „Zapisano", przyciski z nazwami dostępnymi.
- Strona czytelnika: breadcrumbs, Poprzedni/Następny, komunikat „Ukryte przez moderatora".
- Polskie liczby mnogie poprawne, brak angielskich napisów w UI `/pl` (te w danych pochodzą z seeda).

## 2. Problemy zaobserwowane w działającej aplikacji

| # | Miejsce | Problem | Poprawka | Nakład | Wpływ |
|---|---|---|---|---|---|
| A1 | Edytor, mobile | Otwiera się na zakładce „Narzędzia" zamiast „Tekst" (przyczyna niepotwierdzona, możliwe że zapamiętana z desktopu). Kilka sekund pustki bez szkieletu. Nagłówek, zakładki i toolbar zajmują ok. 260 z 812 px. | Na mobile zawsze startować od „Tekst". Szkielet/„Ładowanie…". Toolbar w jednym rzędzie z przewijaniem poziomym. | M | wysoki |
| A2 | Edytor, mobile | Cele dotykowe: przyciski toolbaru 28×28, przełącznik Tekst/Markdown 20 px wysokości, „Kopiuj link"/„Otwórz" 28 px. | Poniżej `md` 36–44 px. | M | wysoki |
| A3 | `/stats`, `/books/[id]` | Brak stanów ładowania: wykres to pusty szary prostokąt, panel „Notatki książki" pusty do czasu doładowania edytora – wygląda jak błąd. | Skeleton lub „Ładowanie…" z `aria-busy`. | S | średni |
| A4 | Publiczna książka | Podwójna numeracja („1. Rozdział 1. …"). Linki rozdziałów wyglądają jak zwykły tekst. Autor nie ma linku „Edytuj książkę". | Pominąć numer listy, gdy tytuł go zawiera. Wyróżnić linki. Link „Edytuj" dla autora. | S | średni |
| A5 | Profil publiczny | „Książki" i „Biblioteka" jako goły tekst bez okładek i metadanych, nie wyglądają na linki. Awatar 96 px dominuje nad treścią. | Karty/wiersze jak w `/books` (liczba rozdziałów, status, okładka). | M | średni |
| A6 | `/moderation` | Badge „1" dotyczy zgłoszeń, ale strona otwiera „Ukryte treści". | Domyślna zakładka z licznikiem > 0. | S | średni |
| A7 | Czytelnik, mobile | Gwiazdki 28 px, „Odpowiedz"/„Zgłoś"/„Skomentuj"/„Zakładka" 28 px. „Zakładka", „Zakładki i notatki", „Spis treści" wyglądają na wyłączone (też w jasnym motywie). | Cele 36–40 px, kontrast drugorzędnych przycisków co najmniej AA. | S | średni |
| A8 | Home, mobile | Chipy kategorii/tagów 20 px. Strzałki karuzeli (28 px) zbędne na dotyku. Karty bez okładki to duże puste prostokąty, tytuł pod zgięciem. | Chipy min. 32 px. Ukryć strzałki dla `pointer: coarse`. Mniejszy placeholder okładki. | S | średni |
| A9 | `/books/[id]` | „Wersje" pod zgięciem, pod ~380 px panelem notatek z tekstem wycentrowanym pionowo. „Publiczny" wygląda biernie. | Status jako badge z akcją. Niższy panel notatek, tekst od góry. „Wersje" wyżej. (Menu „⋮" sprawdzone tylko wizualnie.) | M | średni |
| A10 | `/messages` | Brak awatarów i wskaźnika nieprzeczytanych (nie potwierdzono, czy rozmowa z seed_ben jest nieprzeczytana). „Wiadomości" bez badge'a, „Powiadomienia" ma. | Kropka/pogrubienie, badge w sidebarze. | S | średni |
| A11 | `/admin`, szerokości | „Admin" bez licznika zgłoszeń. Niespójne szerokości: `/books`, `/stats`, `/admin` ~976 px, `/feed`, `/forums`, `/library`, `/messages` ~720 px. | Badge przy „Admin". Dwie standardowe szerokości. | S | niski |
| A12 | Ustawienia → Profil | Zapis „O mnie", awatar i „Zobacz profil" w jednym wierszu. Nieaktywne zakładki o niskim kontraście, „Zapisz" przygaszony w ciemnym. | Rozdzielić sekcje, podnieść kontrast. | S | niski |
| A13 | Wątek forum | „Cytuj" wcięte inaczej niż treść. Przycisk reakcji mały, bez widocznej etykiety (nazwa dostępna niesprawdzona). Breadcrumb szary i mały. | Wyrównać pasek akcji, sprawdzić `aria-label`, podnieść kontrast. | S | niski |
| A14 | `/forums`, `/library` | Kategorie for bez opisów i wskaźnika nieprzeczytanych, „Brak wątków" wygląda jak aktywne. Biblioteka: dużo pustki, niejasne „Czytaj dalej" obok „2 nowe rozdziały". | Opisy i badge. Okładki w bibliotece, jaśniejsza etykieta. | S | niski |
| A15 | Edytor, panel „Narzędzia" | Pięć dużych kafli i pusta reszta, korekta to 2 kliknięcia. | Ostatnio użyte narzędzie na wierzchu lub skróty. | M | niski |

Przepływy: nowa książka 2 kliknięcia, nowy rozdział 1–2, czytanie 2, publikacja min. 3 (niezweryfikowane).

## 3. Propozycje z przeglądu kodu i wzorców

Fakty z kodu: w `app/` brak `loading.tsx`, `error.tsx`, `global-error.tsx`; brak komponentu Skeleton; pending w formularzach to ręczny ternary w ok. 36 plikach; `max-w-none` w `markdown-preview.tsx:6` daje ok. 90–100 znaków w linii (Baymard: optimum 50–75); czytelnik bez ustawień i bez kroju szeryfowego; brak trybu skupienia i celów słów w edytorze; skróty klawiszowe niewidoczne w UI.

| # | Propozycja | Gdzie | Nakład | Wpływ |
|---|---|---|---|---|
| B1 | `error.tsx` w `[locale]` i `(protected)` oraz `global-error.tsx` (komunikaty przez next-intl, „Spróbuj ponownie"). Dziś wyjątek serwera gubi sidebar. | `app/[locale]/…` | S–M | wysoki |
| B2 | `loading.tsx` i szkielety dla books, feed, messages, library, strony publicznej; `motion-safe:` dla pulsowania. Sprawdzić `node_modules/next/dist/docs/` (AGENTS.md). Obejmuje A3. | `app/[locale]/(protected)/` | M | wysoki |
| B3 | Domyślna szerokość czytania ~65ch, `leading-relaxed`, krój szeryfowy tylko dla prozy czytelnika (nie edytora). | `components/markdown-preview.tsx`, `globals.css` | S | wysoki |
| B4 | Ustawienia czytania (przycisk „Aa", popover): rozmiar, szerokość, krój, interlinia; start od `localStorage` (wzorzec Royal Road). | strona rozdziału publicznego | L | wysoki |
| B5 | Wspólny `Empty` z CTA zamiast gołych `<p>` (`books/page.tsx:96`, `messages/page.tsx:32`, `library/page.tsx:158`, `moderation/page.tsx:401`, `notifications.tsx:390`, `public-search.tsx:91`); wzorzec z `feed/page.tsx:34`. | `components/ui/empty.tsx` | S–M | średni |
| B6 | Tryb skupienia w edytorze: najpierw typewriter (jest `trackScrollGap`), potem zdanie/akapit. Ryzyko: WYSIWYG oparty na nakładce (`markdown-editor.tsx:733`). Wzorzec iA Writer. | edytor | M–L | wysoki dla autorów |
| B7 | Onboarding nowego autora: lista „pierwsze kroki" na home i w pustym `/books`, wyliczana z danych. Tańszy wariant: przykładowy rozdział w pierwszej książce. | `app/[locale]/page.tsx` | M | wysoki (retencja) |
| B8 | Paleta poleceń Ctrl+K (`command.tsx` i `cmdk` już są): skok do książki/rozdziału, nowa książka/rozdział, ustawienia, motyw, język. | `app-sidebar.tsx` | M | średni–wysoki |
| B9 | Ściąga skrótów (`Kbd`, dialog po `?`). | edytor, menu „Narzędzia" | S | średni |
| B10 | Selektor rozdziałów w czytniku (lista z `aria-current`, nieprzeczytane oznaczone) i cienki pasek postępu. | strona rozdziału, `reading-tracker.tsx` | M | średni |
| B11 | Mobilny czytnik: pasek zakładek `reader-marks.tsx:44` (`sticky bottom-4`) – cele 44 px, `safe-area-inset-bottom`, ewentualne chowanie przy przewijaniu. Łączy się z A7. | czytelnik | M | średni |
| B12 | Sonner jako wspólny feedback krótkich potwierdzeń (dziś `role="status"` w 12 plikach, `role="alert"` w ok. 42) oraz `Button loading` ze Spinnerem zamiast 36 ternary. Stopniowo. | `components/ui/` | M | średni |
| B13 | Breadcrumb ze shadcn z `aria-current="page"` na ostatnim elemencie; zamiast ręcznych strzałek wstecz (`follow-list.tsx:89`, `editor.tsx:426`, `proofreading.tsx:77`); dodać w `books/[id]` i wersjach. | `p/[nickname]/breadcrumb.tsx` | S | niski–średni |
| B14 | Powiadomienia: grupowanie („5 osób zareagowało…"), „Oznacz wszystkie", filtr nieprzeczytanych. | `components/notifications.tsx` | M | średni |
| B15 | `Field`/`FieldError` w formularzach: błąd inline, fokus na pierwszym błędzie, `aria-describedby`/`aria-invalid`. Najpierw sprawdzić zakres – część już to robi. | `login-form.tsx`, `action-form.tsx` | M | średni |
| B16 | `Badge` zamiast 9 ręcznych pigułek `rounded-full`. | `tag-chips.tsx`, `moderation/page.tsx`, `app-sidebar.tsx` i in. | S | niski |
| B17 | Toast „Usunięto · Cofnij" zamiast części `AlertDialog` (soft-delete jest w `deletedAt`). Nieodwracalne zostają z dialogiem. | `delete-story-dialog.tsx` | M | niski–średni |
| B18 | Ostrzeżenie o niezapisanych zmianach przy nawigacji wewnętrznej (`beforeunload` tylko w `editor.tsx:280` i `folder-notes.tsx:81`). | notatki, edytor | S | niski |

Pozycje z backlogu pokrywające się z raportem (nie duplikować w nowych taskach): 404 w układzie aplikacji, tytuły kart, pasek notatek 67 px – razem z B1.

## 4. Proponowana kolejność

1. **Szybkie i widoczne:** B3, B1, B2 (z A3), B5, A6, A4.
2. **Mobile:** A1, A2, A7, A8, B11.
3. **Wartość dla autora:** B7, B6 (typewriter najpierw), B8, B9.
4. **Wartość dla czytelnika:** B4, B10, A5.
5. **Porządkowanie komponentów:** B12, B13, B15, B16, A11.
6. **Niski priorytet:** A9, A10, A12–A15, B14, B17, B18.

Do decyzji właściciela przed startem:
- Cele słów dla rozdziału/sesji (kolizja z „prostotą, mało animacji" z D083) – nie ujęte wyżej.
- Digest e-mail dla powiadomień.
- Cofnij zamiast dialogu (B17).
- Czy ustawienia czytania (B4) zapisywać w `localStorage`, czy w koncie.
- Duplikat „Mój profil" w nawigacji i menu konta – niegroźny, do uznania.
