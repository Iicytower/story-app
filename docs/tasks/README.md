# Taski

Źródło wymagań: [`../spec.md`](../spec.md) + [`../decisions/index.md`](../decisions/index.md) (ma pierwszeństwo). Wersja 1.0 (tag `v1.0.0`) jest na produkcji; taski dotyczą zmian po 1.0. Szczegóły otwartego tasku w `NN-<slug>.md` (sekcje Zakres, Kryteria akceptacji, Testy). Zakończone taski: wiersz zostaje w tabeli ze statusem `[x]`, a plik przenosimy do [`done/`](done/) (`git mv`, w commicie taska) i poprawiamy link w tabeli. Numeracja rośnie dalej, żeby nie powtarzać nazw branchy.

Status: `[ ]` do zrobienia, `[~]` w trakcie, `[x]` zrobione (zmergowane do `develop`).

Otwarte taski są w tabeli w kolejności realizacji (ustalonej 2026-11-06, D56): najpierw lokalny serwer narzędzi w Dockerze (54) i taski od niego zależne, potem wygląd i okładki folderów (w MongoDB), na końcu prawdziwy serwer na Mikrusie (28).

| # | Task | Zależy od | Status |
| --- | --- | --- | --- |
| 12 | [Pozycja przewijania przy przełączaniu widoków](done/12-keep-scroll-position.md) | – | [x] |
| 13 | [Myślniki dialogowe zamiast listy](done/13-dialogue-dashes.md) | – | [x] |
| 14 | [Mniejszy górny pasek](done/14-compact-header.md) | – | [x] |
| 15 | [Przewijanie poza początek i koniec tekstu](done/15-scroll-past-edges.md) | 12 | [x] |
| 16 | [Lokalny backup bazy](done/16-local-backup.md) | – | [x] |
| 17 | [Nowe formaty eksportu](done/17-export-formats.md) | – | [x] |
| 18 | [Import opowiadań](done/18-import.md) | 17 | [x] |
| 19 | [Zip z osobnym plikiem na rozdział](done/19-chapter-files-zip.md) | 17 | [x] |
| 20 | [Tylko przycisk „Export as…”](done/20-export-as-only.md) | 19 | [x] |
| 21 | [Aktualizacja unpdf do 2.x](done/21-unpdf-2.md) | 18 | [x] |
| 22 | [Wyszukiwanie i zamiana w polu](done/22-find-replace.md) | – | [x] |
| 24 | [Tagi](done/24-tags.md) | – | [x] |
| 36 | [Logowanie przez nick](done/36-nickname-login.md) | – | [x] |
| 38 | [Publikacja opowiadań](done/38-publish.md) | 36 | [x] |
| 41 | [Zmiana hasła](done/41-change-password.md) | 36 | [x] |
| 37 | [Rejestracja](done/37-registration.md) | 36 | [x] |
| 27 | [Zakładka Tools](done/27-tools-tab.md) | – | [x] |
| 42 | [Generator nazw](done/42-name-generator.md) | 27 | [x] |
| 39 | [Publiczna wyszukiwarka](done/39-public-search.md) | 24, 37, 38 | [x] |
| 43 | [Routing z prefiksem języka](done/43-locale-routing.md) | – | [x] |
| 44 | [Słowniki tekstów interfejsu](done/44-ui-dictionaries.md) | 43 | [x] |
| 45 | [Przełącznik języka i polski interfejs](done/45-polish-ui.md) | 44 | [x] |
| 46 | [Dialog ustawień zamiast osobnych pozycji w sidebarze](done/46-settings-dialog.md) | 45 | [x] |
| 47 | [Usunięcie trybu kolumn w edytorze](done/47-remove-split.md) | – | [x] |
| 50 | [Podpowiedzi przy przyciskach z samą ikoną](done/50-icon-tooltips.md) | – | [x] |
| 48 | [Łagodniejszy kontrast i motyw kolorystyczny](done/48-softer-colors.md) | – | [x] |
| 49 | [Przebudowa strony głównej](done/49-home-page.md) | – | [x] |
| 52 | [Menu akcji (⋮) i przeciąganie zamiast strzałek](done/52-action-menus.md) | – | [x] |
| 54 | [Lokalny serwer narzędzi (Coolify w Dockerze)](done/54-local-tools-server.md) | – | [x] |
| 29 | [LanguageTool na serwerze, akcja sprawdzania i język folderu](done/29-languagetool.md) | 54 | [x] |
| 23 | [Korekta tekstu w dialogu](done/23-proofreading.md) | 27, 29 | [x] |
| 30 | [Słownik użytkownika w korekcie](done/30-user-dictionary.md) | 23 | [x] |
| 25 | [Serwis słownikowy i tabela form](done/25-dictionary-service.md) | 54, 29 | [x] |
| 32 | [Definicje](done/32-definitions.md) | 25, 27 | [x] |
| 33 | [Synonimy](done/33-synonyms.md) | 25, 27 | [x] |
| 34 | [Rymy](done/34-rhymes.md) | 25, 27 | [x] |
| 35 | [Filtry rymów](done/35-rhyme-filters.md) | 34 | [x] |
| 55 | [Korekta w głównym edytorze](done/55-inline-proofreading.md) | 23 | [x] |
| 51 | [Poprawa UX i UI (zbiorczy)](51-ui-polish.md) | – | [ ] |
| 93 | ↳ [Nazewnictwo „Książka/Rozdział” i nowe adresy](done/93-books-naming-routes.md) (subtask 51) | – | [x] |
| 94 | ↳ [Daty w lokalnej strefie i czas względny](94-local-dates.md) (subtask 51) | 93 | [ ] |
| 95 | ↳ [Sidebar: nazwa aplikacji, blok konta, pasek mobile](95-sidebar-account.md) (subtask 51) | 93 | [ ] |
| 96 | ↳ [Szerokości treści i sidebar na stronach publicznych](96-layout-widths.md) (subtask 51) | 95 | [ ] |
| 97 | ↳ [Główne akcje i kolejność rozdziałów](97-book-actions-order.md) (subtask 51) | 93 | [ ] |
| 98 | ↳ [Strona książki, opis i wersje](98-book-page.md) (subtask 51) | 97 | [ ] |
| 99 | ↳ [Edytor: odstęp, układ mobile, paski, nazwy trybów](99-editor-ux.md) (subtask 51) | 95 | [ ] |
| 100 | ↳ [Strona główna: skrót do pisania i mniej sekcji](100-home-page.md) (subtask 51) | 97 | [ ] |
| 101 | ↳ [Dialog ustawień z zakładkami](101-settings-tabs.md) (subtask 51) | 95 | [ ] |
| 102 | ↳ [Profil, biblioteka, statystyki](102-profile-library-stats.md) (subtask 51) | 101 | [ ] |
| 103 | ↳ [Reakcje i fora](103-reactions-forums.md) (subtask 51) | 94 | [ ] |
| 104 | ↳ [Wiadomości i aktualności](104-messages-feed.md) (subtask 51) | 94, 95 | [ ] |
| 105 | ↳ [Publiczna strona książki i rozdziału](105-public-book-chapter.md) (subtask 51) | 96, 98, 103 | [ ] |
| 106 | ↳ [Moderacja i panel admina](106-moderation-admin.md) (subtask 51) | 95 | [ ] |
| 107 | ↳ [Audyt końcowy UI/UX i raport po poprawkach](107-ui-audit.md) (subtask 51) | 93–106 | [ ] |
| 66 | [Okładki folderów i oznaczenie 18+ (zbiorczy)](done/66-covers-and-adult-rating.md) | – | [x] |
| 65 | ↳ [Oznaczenie 18+](done/65-adult-rating.md) (subtask 66) | – | [x] |
| 26 | ↳ [Upload okładek](done/26-cover-upload.md) (subtask 66) | 65 | [x] |
| 40 | ↳ [Wyświetlanie okładek](done/40-cover-display.md) (subtask 66) | 26 | [x] |
| 28 | [Serwer na Mikrusie](28-mikrus-server.md) | 54, 25, 29 | [~] |
| 67 | [Pomiar limitu okładek i kalibracja progu 18+](67-covers-limits-calibration.md) | 28 | [ ] |
| – | [Aktualizacja zależności (2026-11-09)](done/dependency-updates-2026-11-09.md) | – | [x] |
| 56 | [Aktualizacja Next.js i podatnych zależności](done/56-dependency-updates.md) | – | [x] |
| 57 | [Zaufany adres klienta w limitach](done/57-trusted-client-ip.md) | – | [x] |
| 58 | [Unieważnianie sesji](done/58-session-revocation.md) | – | [x] |
| 59 | [Limity rozmiaru i liczby danych](done/59-data-limits.md) | – | [x] |
| 60 | [Nagłówki bezpieczeństwa](done/60-security-headers.md) | – | [x] |
| 61 | [Typy argumentów Server Actions](done/61-action-input-types.md) | – | [x] |
| 62 | [Zapis dużej treści rozdziału kończy się 500](done/62-large-content-save.md) | – | [x] |
| 63 | [Kody odzyskiwania konta](done/63-recovery-codes.md) | – | [x] |
| 64 | [Predefiniowane tagi](done/64-predefined-tags.md) | 24 | [x] |
| 53 | [Projekt systemu społecznościowego i plan tasków](done/53-social-system-plan.md) | – | [x] |
| 68 | [System społecznościowy (zbiorczy)](done/68-social.md) | – | [x] |
| 69 | ↳ [Fundament społeczności](done/69-social-foundation.md) (subtask 68) | – | [x] |
| 70 | ↳ [Profil użytkownika](done/70-profile.md) (subtask 68) | 69 | [x] |
| 71 | ↳ [Obserwowanie autorów](done/71-follow.md) (subtask 68) | 70 | [x] |
| 72 | ↳ [Biblioteka i półki](done/72-library.md) (subtask 68) | 70 | [x] |
| 73 | ↳ [Postęp czytania i nowe rozdziały](done/73-reading-progress.md) (subtask 68) | 72 | [x] |
| 74 | ↳ [Zakładki i notatki czytelnika](done/74-reader-notes.md) (subtask 68) | 73 | [x] |
| 75 | ↳ [Feed aktywności](done/75-feed.md) (subtask 68) | 71, 72 | [x] |
| 76 | ↳ [Komentarze](done/76-comments.md) (subtask 68) | 69, 70, 75 | [x] |
| 77 | ↳ [Reakcje](done/77-reactions.md) (subtask 68) | 76 | [x] |
| 78 | ↳ [Oceny](done/78-ratings.md) (subtask 68) | 69 | [x] |
| 79 | ↳ [Moderacja autora](done/79-author-moderation.md) (subtask 68) | 76 | [x] |
| 80 | ↳ [Zgłoszenia](done/80-reports.md) (subtask 68) | 79 | [x] |
| 81 | ↳ [Powiadomienia](done/81-notifications.md) (subtask 68) | 71, 72, 73, 76, 77, 78, 79, 80 | [x] |
| 82 | ↳ [Wzmianki @nick](done/82-mentions.md) (subtask 68) | 81 | [x] |
| 83 | ↳ [Statystyki autora](done/83-author-stats.md) (subtask 68) | 71, 72, 73, 76, 77, 78 | [x] |
| 84 | ↳ [Rankingi na stronie głównej](done/84-rankings.md) (subtask 68) | 71, 83 | [x] |
| 85 | ↳ [Wiadomości prywatne](done/85-direct-messages.md) (subtask 68) | 81 | [x] |
| 86 | ↳ [Blokowanie w pełnym zakresie](done/86-blocking.md) (subtask 68) | 82, 84, 85 | [x] |
| 87 | ↳ [Fora autora i globalne](done/87-forums.md) (subtask 68) | 75, 77, 80, 81, 82, 86 | [x] |
| 88 | ↳ [Panel admina](done/88-admin-panel.md) (subtask 68) | 80, 87 | [x] |
| 89 | ↳ [Usuwanie konta](done/89-account-deletion.md) (subtask 68) | 69–88 | [x] |
| 90 | ↳ [Realtime: serwis SSE w stosie narzędzi](done/90-realtime.md) (subtask 68) | 81, 85 | [x] |
| 91 | ↳ [Audyt bezpieczeństwa i E2E całości](done/91-social-audit.md) (subtask 68) | 69–90 | [x] |
| 92 | [Wydanie systemu społecznościowego: kroki ręczne](92-social-release-manual.md) (**ręcznie – użytkownik**) | 68 | [ ] |

## Backlog

Pomysły bez pliku taska – do obgadania, zanim staną się taskami.

- Inne generatory niż generator nazw z taska 42 (szczegóły do ustalenia).
- Obrazki w tekście opowiadania (po tasku 26).
- Powtórzenia między zdaniami w korekcie (powtórzenia w zdaniu są w tasku 23).
- Kafelek odmiany: paradygmat z tabeli form zapytaniem po lemacie, wymaga indeksu po lemacie i czytelnego układu tagów (Morfologik ma ich 1336) (po tasku 25).
- Asonans w rymach, zwinięty pod wynikami; 271 kluczy na 4,2 mln form, wyniki bliskie losowym (po tasku 34).
- narzędzie do znajdywania etymologii
- narzędzie do frazeologizmów. wytłumaczenie frazeologizmu oraz znalezienie na zadany opis. 

## Branche

- `main` – produkcja (Vercel Production). Nigdy nie pushujemy na `main`; merge ze `staging` przy wydaniu robi użytkownik.
- `staging` – środowisko testowe (Vercel Preview przypięty do brancha `staging`). Merge z `develop` na prośbę użytkownika.
- `develop` – integracja: tu trafiają zakończone taski.
- `feature/NN-<slug>` – jeden branch na task, tworzony z `develop`.
- `security` – lokalny branch zbiorczy poprawek bezpieczeństwa (taski 56–63 i aktualizacja zależności z 2026-11-09), z `develop`. Branche tasków z niego i merge do niego; do `develop` merguje użytkownik po przeglądzie.
- `feature/social` – lokalny branch zbiorczy systemu społecznościowego (task 68, subtaski 69–91, D80), z `develop`. Branche subtasków z niego i merge do niego; nie jest pushowany, do `develop` merguje użytkownik po przeglądzie. `develop` mergujemy do niego okresowo.
- `fix/ui` – lokalny branch zbiorczy poprawy UX i UI (task 51, subtaski 93–107, D83), z `feature/social`. Branche subtasków `feature/NN-<slug>` z niego i merge do niego; nie jest pushowany, dalej merguje użytkownik.
- Task zbiorczy (np. 66): jego branch z `develop`, a branch każdego subtasku z brancha zbiorczego; subtask merge'ujemy do brancha zbiorczego, a ten do `develop` dopiero po wszystkich subtaskach.

## Definicja „zrobione” (każdy task)

- Kryteria akceptacji z pliku taska spełnione, a testy z sekcji „Testy” napisane i zielone (zasady: [`../testing.md`](../testing.md)).
- `npm run verify` przechodzi.
- Każdy nowy tekst interfejsu w słownikach `messages/en.json` i `messages/pl.json` (D46), bez literałów w komponentach i akcjach.
- Status w tej tabeli zaktualizowany.
