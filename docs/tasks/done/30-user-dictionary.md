# 30 – Słownik użytkownika w korekcie

Wynik researchu i decyzja użytkownika (2026-11-01). Imiona postaci i neologizmy nie mają wracać w każdej korekcie.

## Zakres

- Przycisk „Add to dictionary” przy błędzie pisowni w dialogu z taska 23.
- Lista słów użytkownika w ustawieniach (D24), z możliwością usuwania.
- Filtrowanie wyników po stronie aplikacji, przed pokazaniem dialogu.

## Ustalenia

- Słownik jest per konto, nie per folder.
- Dotyczy tylko błędów pisowni. Zwykłe „Reject” działa tylko w bieżącym dialogu.

## Ustalone przy starcie (2026-11-06)

- Lista: nowa sekcja w dialogu Settings, usuwanie od razu, bez „Save”.
- Porównanie jak w Hunspellu: słowo małymi literami pasuje też z wielkiej i WERSALIKAMI, słowo z wielką literą tylko dokładnie i WERSALIKAMI. Odmiany dodaje się osobno.
- Limity: 1–50 znaków po `trim()`, bez białych znaków, maks. 1000 słów.
- Filtr po rodzaju błędu „pisownia”, nie po id reguły (D60).

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Dane z LanguageTool

- Błędy pisowni pochodzą z reguły `MORFOLOGIK_RULE_PL_PL`, więc filtr po id reguły i dopasowanym fragmencie odcina tylko pisownię.
- Własny słownik serwera LT nie jest potrzebny: filtrowanie w aplikacji działa per konto.
- Ignorowanie po fragmencie tekstu i id reguły, nie po pozycji, bo pozycje zmieniają się po edycji.
- Rejestr ustawień w `lib/settings/settings.ts` (D24): wpis w `SETTINGS` + pole w modelu `Settings`.

## Kryteria akceptacji

1. Dodane słowo znika z bieżącego wyniku i nie wraca w kolejnych korektach.
2. Słowo można usunąć z listy, a błąd wtedy wraca.
3. Lista jednego użytkownika nie wpływa na innego.
4. Słownik filtruje tylko błędy pisowni.
5. Nieprawidłowa wartość daje `INVALID_INPUT`.

## Testy

Unit: dopasowanie słowa i filtrowanie wyników. Integracyjne: zapis, usuwanie, własność, walidacja. E2E: dodanie w dialogu, brak błędu w kolejnej korekcie, usunięcie.
