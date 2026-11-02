# 42 – Generator nazw

Zgłoszenie użytkownika (2026-11-01), zakres ustalony 2026-11-02. Decyzje: D43.

## Zakres

Kafelek „Name generator” w Tools (task 27) zastępuje atrapę `ComingSoon`. Działa wyłącznie w przeglądarce: bez AI, modeli uczonych na danych, serwera, bazy i Server Actions. Bez nowych pakietów.

### Działanie

- Przycisk „Generate” pokazuje 10 nazw spełniających filtry. „Next 10” zastępuje listę kolejnymi 10, także przy tych samych filtrach.
- Nazwy się nie powtarzają, dopóki dialog jest otwarty. Zmiana filtrów nie czyści listy pokazanych.
- Przy każdej nazwie jest „Copy”, a przy liście „Copy all” (10 widocznych nazw, jedna w wierszu).
- Gdy filtry wykluczają się mimo blokady (zob. „Sprzeczne filtry”), widać tyle nazw, ile się udało, i komunikat „Only N names match these filters.”. Przy zerowym wyniku: „No names match these filters.”. Generator nigdy się nie zawiesza.
- Filtry zapisują się w `localStorage` razem z datą ostatniej zmiany. Po 7 dniach od niej albo przy uszkodzonym zapisie wracają domyślne.

### Filtry

Każda grupa pojedynczego wyboru ma też wartość `Any` (domyślną, jeśli nie podano innej). Wartości w grupie wykluczają się. Sprzeczności między grupami są blokowane, zob. „Sprzeczne filtry”.

| Grupa | Wybór | Wartości |
| --- | --- | --- |
| Type | jeden | Postacie: First name, Surname, Full name, Epithet. Miejsca: City, Village, River, Mountains, Forest, Kingdom, Inn. Organizacje: Guild, Order, House, Company, Faction. Rzeczy i istoty: Weapon, Artifact, Ship, Spell, Species, Monster, Deity. Domyślnie First name, bez `Any` |
| Gender | jeden | Male, Female, Neutral; tylko dla First name i Full name |
| Style | wiele | Polish/Slavic, English, German, Nordic, Latin, Celtic, Elvish, Dwarven, Orcish, Sci-fi |
| Mix styles | przełącznik | Wyłączony: cała nazwa z jednego zaznaczonego stylu. Włączony: sylaby z różnych zaznaczonych stylów w jednej nazwie |
| Sound | jeden | Hard, Soft, Neutral |
| Length | jeden | Short (1–2 sylaby), Medium (3), Long (4+); liczone na każde słowo |
| Pronunciation | jeden | Easy, Exotic, Unpronounceable |
| Crude part | jeden | Exclude (domyślnie), Allow, Only |
| Letter balance | jeden | Vowel-heavy, Balanced, Consonant-heavy |
| Mood | jeden | Dark, Noble, Comic, Ethereal, Common |
| Starts with, Ends with, Contains | pole tekstowe | Bez rozróżniania wielkości liter |
| Excludes | pole tekstowe | Fragmenty po przecinku |
| Alliteration | przełącznik | Wszystkie słowa zaczynają się od tej samej głoski; tylko nazwy wielowyrazowe |
| Repeated syllable | przełącznik | Np. Lulu, Bobo |
| Polish letters | przełącznik | Domyślnie włączony. Wyłączony odrzuca ą, ć, ę, ł, ń, ó, ś, ź, ż |
| Apostrophes and hyphens | przełącznik | Włączony: każda nazwa ma apostrof albo łącznik (Kal'thar, Vex-7, cyfry tylko w Sci-fi). Wyłączony: żadna nie ma |
| Word count | jeden | One, Two, Three; Full name zawsze ma dwa, a Epithet to przydomek typu „the Grey” |
| Easy to inflect | przełącznik | Końcówka odmieniająca się regularnie po polsku |

### Sprzeczne filtry

- Zbiór wartości nie może być sprzeczny. Wybranie wartości odznacza tę, która jej przeszkadza, a jej grupa wraca do `Any` (przełącznik do wyłączonego). Odznaczona wartość nie wraca sama po cofnięciu wyboru.
- Sprzeczności to osobna lista par w `conflicts.ts`, niezależna od generatora. Relacja jest symetryczna.
- Lista początkowa:

| Wartość | Sprzeczna z |
| --- | --- |
| Pronunciation: Easy | Letter balance: Consonant-heavy |
| Pronunciation: Unpronounceable | Letter balance: Vowel-heavy, Letter balance: Balanced, Repeated syllable |
| Sound: Hard | Style: Elvish, Mood: Ethereal |
| Sound: Soft | Style: Orcish, Style: Dwarven |
| Mood: Ethereal | Letter balance: Consonant-heavy |
| Alliteration | Word count: One |

- Style to wielokrotny wybór, więc odznacza się tylko sprzeczny styl. Gdy nie zostanie żaden, wybór wraca do `Any`.
- Lista jest uzupełniana przy implementacji: test parami sprawdza każdą dozwoloną parę wartości, a para bez 10 nazw trafia na listę.
- Filtry, które nie dotyczą danego typu (Gender, Word count, Alliteration), są ukryte i ignorowane, ale nie są czyszczone. Mix styles jest nieaktywny przy dokładnie jednym zaznaczonym stylu.
- Pola tekstowe nie są objęte blokadą. Sprzeczności między nimi albo trzech i więcej filtrów nadal kończą się komunikatem o braku wyników.

Oznaczenia:

- Grupy pojedynczego wyboru to okrągłe pigułki, a wielokrotny wybór i przełączniki to prostokąty z zaokrąglonymi rogami.
- Wartość, której kliknięcie coś odznaczy, ma przerywaną ramkę i `title` „Clears Hard” (`title` jest też opisem dla czytników ekranu; `aria-description` odpada, bo ESLint a11y go nie wspiera). Wartości bez konfliktu wyglądają zwyczajnie.

### Algorytm

Czyste funkcje w `lib/name-generator/`, sterowane wstrzykiwanym PRNG z ziarnem (`mulberry32`, kilka linii, bez pakietu). Domyślne ziarno jest losowe.

1. **Tokenizacja:** tekst dzielony na głoski według dwuznaków stylu (`sz`, `cz`, `rz`, `ch`, `th`, `ph`...). Wszystkie cechy liczone są na głoskach, nie na literach.
2. **Generowanie z uprzedzeniem:** PRNG losuje szablon sylaby (`CV`, `CVC`, `V`...) i głoski z tabel stylu `{ onsets, nuclei, codas }` z wagami. Filtry zmieniają wagi: Sound i Letter balance faworyzują klasy głosek, Mood wybiera szablony, wagi i oznaczone morfemy, a Length ustala liczbę sylab.
3. **Morfemy:** typy niebędące imionami składane są z członów opisanych tagami stylu i nastroju, np. `Czarno`+`gród`, `Stone`+`fall`, „Order of the Silver Sun”. Nazwiska i imiona korzystają z końcówek zależnych od stylu i płci.
4. **Fragmenty narzucone:** Starts with, Ends with i Contains wstawiane są jako segmenty, zamiast czekać, aż wylosują się same. W trybie Crude part = Only tak samo wstawiany jest człon z listy.
5. **Sprawdzenie:** kandydat przechodzi przez predykaty wszystkich twardych filtrów, a potem przez odrzucenie powtórek. Limit to 5000 kandydatów na 10 nazw; po nim generator zwraca to, co ma.

Mood jest jedynym filtrem miękkim: zmienia prawdopodobieństwa, ale nie ma predykatu. Pozostałe filtry są twarde: każdy wynik musi je spełniać.

### Predykaty

- **Sound:** `score = (twarde - miękkie) / (twarde + miękkie)` na spółgłoskach. Twarde: zwarte, zwarto-szczelinowe, `r`, `x`, `sz`, `ż`. Miękkie: `l`, `ł`, `m`, `n`, `ń`, `j`, `w`, `f`, `h`, `s`, `ś`, `ź`. Hard ≥ 0,33, Soft ≤ -0,33, reszta Neutral. Progi można skalibrować przy implementacji.
- **Pronunciation:** ocena zbitek na głoskach względem dozwolonych zbitek stylu. Easy: tylko zbitki z tabeli i co najwyżej 2 samogłoski z rzędu. Exotic: co najmniej jedna rzadka zbitka, nadal z samogłoską w każdej sylabie. Unpronounceable: zbitka 4+ spółgłosek albo sylaba bez samogłoski; generator tworzy ją mutacją (usuwa samogłoskę).
- **Crude part:** nazwa normalizowana (małe litery; najpierw `ch`→`h`, `ó`→`u`, `rz`→`ż`, `kh`→`h`, `ya`→`ja`, `yo`→`jo`, `yu`→`ju`; potem usunięcie diakrytyków i podwojonych liter) i porównywana z listą rdzeni PL + EN + RU. Rdzenie rosyjskie są w transliteracji łacińskiej, bo generator nie tworzy cyrylicy. Dopasowanie: fragment nazwy równy rdzeniowi albo, dla rdzeni od 4 liter, oddalony o 1 w odległości edycyjnej. Fałszywe trafienia trafiają na listę wyjątków.
- **Letter balance:** udział samogłosek wśród głosek. Vowel-heavy ≥ 55%, Consonant-heavy ≤ 35%.

### Pliki

- `lib/name-generator/`: `rng.ts`, `phonemes.ts`, `predicates.ts`, `crude.ts`, `generate.ts`, `conflicts.ts`, `filters.ts` (typy, wartości domyślne, zapis z datą), `data/` (tabele stylów, morfemy, rdzenie).
- `app/(protected)/stories/[id]/name-generator.tsx`: widok narzędzia, ładowany przez `lazy()` razem z danymi, żeby nie powiększać strony edytora (jak generatory eksportu, D31).
- `tools.tsx`: wpis `name-generator` wskazuje nowy widok. Grupy filtrów jako przyciski z `aria-pressed` i komponenty z `components/ui`, bo nie ma tam radio ani checkboxa.
- Dialog narzędzia musi pomieścić filtry; szerokość i przewijanie ustalane przy implementacji, także na wąskim ekranie (D41).

Poza zakresem: wstawianie do tekstu, ulubione, sprawdzanie użycia nazwy w opowiadaniu, prawdziwe bazy imion.

## Kryteria akceptacji

1. Kafelek otwiera generator, a „Generate” pokazuje 10 różnych nazw.
2. „Next 10” zastępuje listę nazwami, których jeszcze nie było, także bez zmiany filtrów.
3. „Copy” kopiuje jedną nazwę, a „Copy all” wszystkie widoczne.
4. Każdy typ z tabeli generuje nazwy w każdym stylu.
5. Każdy wynik spełnia wszystkie wybrane filtry twarde, także w kombinacjach.
6. Wartości w grupie pojedynczego wyboru wykluczają się, a Gender jest widoczny tylko dla typów z imieniem.
6a. Wybranie filtru sprzecznego z innej grupy odznacza ten, który przeszkadza; jest to widoczne przed kliknięciem (przerywana ramka) i rodzaje wyboru różnią się kształtem.
6b. Każda para wartości dopuszczona przez listę sprzeczności daje co najmniej 10 nazw.
7. Mood wyraźnie zmienia rozkład wyników względem `Any`.
8. Style zaznaczone bez Mix styles nie mieszają się w nazwie, a z Mix styles się mieszają.
9. Crude part = Exclude nie przepuszcza rdzeni ani form podobnie brzmiących, Only zwraca wyłącznie takie, a Allow nie filtruje.
10. Ten sam seed daje te same nazwy.
11. Filtry bez wyników (pola tekstowe, kombinacje trzech i więcej) kończą się komunikatem, bez zawieszenia.
12. Filtry wracają po ponownym otwarciu, a po ponad 7 dniach lub przy uszkodzonym zapisie wracają domyślne.
13. Generator nie wykonuje zapytań do aplikacji poza pobraniem własnego kodu i nie jest częścią początkowego bundla edytora.

## Testy

Unit, Vitest (`*.test.ts` w `lib/name-generator/`):

- `rng`: determinizm dla ziarna (10).
- `phonemes`: tokenizacja dwuznaków dla PL i EN.
- `predicates`: przykłady graniczne dla Sound, Length, Pronunciation, Letter balance, Easy to inflect (5).
- `crude`: rdzenie, wersje podobnie brzmiące (`huj`/`chuj`, `kórwa`/`kurva`), transliteracje rosyjskie (`blyat`/`bljat`, `khui`/`hui`), wielkie litery, diakrytyki, lista wyjątków (9).
- `generate`: dla wielu ziaren, wszystkich typów i stylów niepusty wynik (4), właściwość „każdy wynik spełnia predykaty” dla losowych kombinacji filtrów (5), brak powtórek przy podanym zbiorze pokazanych (2), rozkład cech z Mood względem `Any` (7), pochodzenie sylab z Mix styles i bez (8), Crude part dla trzech stanów (9), sprzeczne filtry i limit kandydatów (11).
- `conflicts`: symetria listy, odznaczanie wartości i stylu, powrót do `Any`, wyliczenie „Clears …” (6a).
- `generate`: test parami po wszystkich dozwolonych parach wartości (6b).
- `filters`: zapis i odczyt, wygaśnięcie po 7 dniach z wstrzykniętym czasem, uszkodzony JSON (12).

E2E, Playwright (`tests/e2e/name-generator.spec.ts`):

- Kafelek → Generate → 10 nazw → Next 10 → inne nazwy (1, 2).
- Copy i Copy all z uprawnieniem do schowka (3).
- Grupa Sound przełącza się jak radio, a Gender znika przy typie City (6).
- Kliknięcie Letter balance: Vowel-heavy przy Unpronounceable odznacza Unpronounceable, a przycisk ma przerywaną ramkę przed kliknięciem (6a).
- Filtry tekstowe bez wyników pokazują komunikat (11).
- Filtry wracają po przeładowaniu strony (12).
- Generowanie nie wysyła żadnych żądań (13).

`manual`: w zakładce Network chunk generatora pobiera się dopiero po kliknięciu kafelka (13); przejrzenie po 50 nazw z każdego stylu pod kątem brzmienia.
