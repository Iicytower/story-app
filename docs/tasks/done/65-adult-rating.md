# 65 – Oznaczenie 18+

Subtask zbiorczego taska [66](../66-covers-and-adult-rating.md) (branch, kolejność, środowisko lokalne).

Zgłoszenie użytkownika (2026-11-08), wcześniej punkt backlogu „oznaczenie folderu lub rozdziału jako 18+”. Wspólny system oznaczeń 18+ dla folderów, rozdziałów i obrazków. Ten task wprowadza oznaczenie folderu i rozdziału oraz miejsce na źródło automatyczne; obrazki (okładki) i automatyczny filtr podłącza task [26](../26-cover-upload.md).

## Zakres

- Ręczne oznaczenie folderu i rozdziału jako 18+ przez właściciela oraz zdjęcie tego oznaczenia.
- Jeden mechanizm dla folderów, rozdziałów i obrazków: oznaczenie ma źródło ręczne (właściciel) albo automatyczne (filtr obrazków z taska 26).
- Blokada (decyzja użytkownika): gdy automat oznaczy obrazek jako 18+, rozdział (lub folder), do którego obrazek należy, jest 18+, a właściciel nie może tego zmienić, dopóki nie usunie albo nie wymieni obrazka. Po usunięciu obrazka zostaje oznaczenie ręczne, jeśli było.
- Właściciel może też sam oznaczyć obrazek jako 18+ (mechanizm w tym tasku, UI obrazków w tasku 26); ręczne oznaczenie obrazka nie blokuje rozdziału.
- Znaczek 18+ przy rozdziale i folderze w widokach właściciela i na stronach publicznych (wyszukiwarka, strona czytania, ostatnio opublikowane).
- Teksty w `messages/en.json` i `messages/pl.json`, także wyjaśnienie, dlaczego przełącznik jest zablokowany.

**Do decyzji użytkownika** (zapytać przed implementacją; wynik jako nowa decyzja w `decisions.md`):

- Dziedziczenie: czy folder 18+ czyni 18+ wszystkie swoje rozdziały (i czy rozdział może być wtedy „nie 18+”), czy rozdział 18+ oznacza folder, czy poziomy są niezależne. Przeniesienie rozdziału między folderami.
- Model danych: np. `adult: { manual: boolean, autoLocked: boolean }` na folderze i rozdziale albo pole wyliczane z obrazków przy odczycie. Migracja istniejących rekordów (domyślnie nie 18+).
- Zachowanie na stronach publicznych: tylko znaczek, ostrzeżenie przed czytaniem („Masz 18 lat?”), filtr w wyszukiwarce (ukryj / pokaż 18+), ustawienie czytelnika.
- Gdzie przełącznik: menu akcji (⋮, D55), dialog ustawień folderu, edytor.
- Czy oznaczenie 18+ wpływa na eksport, wersje folderów (D25) i `updatedAt` (jak D11 – raczej nie).

## Kryteria akceptacji

1. Właściciel może oznaczyć folder i rozdział jako 18+ i zdjąć to oznaczenie; cudzy folder lub rozdział daje `NOT_FOUND`.
2. Oznaczenie automatyczne blokuje przełącznik: akcja zdjęcia 18+ zwraca błąd, a UI pokazuje powód. Po usunięciu źródła automatycznego zostaje oznaczenie ręczne, jeśli było, w przeciwnym razie oznaczenie znika.
3. Dziedziczenie między folderem a rozdziałem działa zgodnie z decyzją przy starcie, także po przeniesieniu rozdziału.
4. Znaczek 18+ widać w widokach właściciela i na stronach publicznych ustalonych przy starcie.
5. Zmiana oznaczenia nie zmienia `updatedAt` rozdziału, więc otwarty edytor nie dostaje `CONFLICT`.
6. Po migracji nic nie jest oznaczone jako 18+.

## Testy

Unit: wyliczenie efektywnego oznaczenia (ręczne, automatyczne, dziedziczenie, blokada). Integracyjne: akcje oznaczania, własność, blokada przy źródle automatycznym (symulowanym bez obrazków z taska 26), przeniesienie rozdziału, migracja, `updatedAt`. E2E: oznaczenie i zdjęcie 18+ rozdziału i folderu, znaczek w wyszukiwarce, zablokowany przełącznik.

## Do głębszego rozważenia: automat 18+ dla tekstu bez AI

Poza zakresem i kryteriami akceptacji tego taska (pytanie użytkownika 2026-11-08). Wstępny research z wiedzy ogólnej, bez pomiarów; przed decyzją trzeba to przemyśleć głębiej.

- **Pomysł:** słowniki lematów ryzykownych (wulgaryzmy, słownictwo seksualne, gore, narkotyki) i punktacja gęstości (trafienia na 1000 słów z wagą kategorii); próg oznacza rozdział jako 18+.
- **Co już mamy:**
  - Lematyzacja przez serwis słownikowy (task [25](25-dictionary-service.md), PoliMorf): lista trzyma lematy, odmiana trafia sama.
  - Etykieta „wulgarnie” z Wikisłownika w bazie definicji (D62) jako źródło listy wulgaryzmów; rdzenie wulgarne z generatora nazw (D43).
  - Język tekstu z ustawienia folderu (D58).
- **Do zbudowania:** ręcznie ułożone listy słownictwa seksualnego, gore i narkotyków, osobno dla polskiego i angielskiego (kilkaset lematów na język, szac.).
- **Ograniczenia:**
  - Pominięcia: erotyka pisana eufemizmami, przemoc opisana zwykłymi słowami, przemoc wobec dzieci bez wulgaryzmów, czyli najpoważniejsze przypadki.
  - Fałszywe alarmy: wieloznaczność („członek zarządu”, „kutas” przy czapce), kontekst medyczny, przekleństwa postaci w tekście dla młodzieży. Gęstość łagodzi, nie usuwa.
  - Zaprzeczenia i metafory są niewidoczne dla zliczania.
  - Klasyczne ML (np. naive Bayes na ocenach z AO3) to już „AI”, wymaga oznaczonego zbioru i ma problem licencyjny z cudzymi tekstami.
- **Wstępny wniosek:** nadaje się raczej na sugestię („rozważ oznaczenie 18+”) niż na automatyczne oznaczenie z blokadą jak przy obrazkach; za dużo pominięć i fałszywych alarmów.
- **Do rozważenia:** sugestia, automat bez blokady czy z blokadą; kiedy liczyć (zapis, publikacja); koszt wywołań serwisu słownikowego dla długich rozdziałów (lematyzacja całego tekstu); próbka testowa tekstów do ustawienia progów.
