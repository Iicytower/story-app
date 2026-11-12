# D65 – Filtry rymów (2026-11-06)

Status: aktualna.

- Task 35. Kafelek „Rhymes” ma pod polem słowa filtr części mowy i zakres liczby sylab „od–do” (decyzje użytkownika, wzorem Rymera). Filtrowanie robi serwis w SQL przed limitem 150 wierszy na poziom (decyzja użytkownika), więc lista jest pełna także przy wąskim filtrze. Ranking, „Show more” i limit form na lemat działają bez zmian na przefiltrowanej puli. Wiersze pisowni wpisanego słowa nie są filtrowane, bo z nich biorą się jego lematy i klucze.
- Części mowy (`partsOfSpeech` w `lib/tools/rhymes-import.ts`): pięć grup jako bity, a forma należy do grup wszystkich swoich odczytów („koło”: rzeczownik i inna):
  - rzeczownik: `subst`, `depr`, `ger`;
  - przymiotnik: `adj`, `adjc`, `pact`, `ppas`;
  - czasownik: `fin`, `bedzie`, `praet`, `impt`, `inf`, `imps`, `cond`, `winien`, `pcon`, `pant`;
  - przysłówek: `adv`, `pacta`;
  - inna: pozostałe, także `adja` (polsko-) i `adjp` (po polsku).
  
  Gerundia i imiesłowy odmienne są przy słowach, jak które się odmieniają. Nazwy własne mają tag `subst`, więc są rzeczownikami. Test pilnuje, że każda klasa z tabeli tagów ma grupę.
- Liczba sylab to liczba samogłosek transkrypcji z taska 34 (`syllableCount`): `i` zmiękczające i `u` w `au`/`eu` czytanym jako `w` nie tworzą sylaby. Zakres 1–6, gdzie 6 znaczy „6 i więcej”. W polu „do” nie da się wybrać wartości mniejszej niż „od”, i odwrotnie.
- Baza rymów: kolumny `pos` (bity) i `syllables`. Indeksy poziomów rozszerzone do `(klucz, freq DESC, pos, syllables)`, więc filtr sprawdza się w indeksie bez czytania wierszy. Najgorszy przypadek (klucz `my`, 607 tys. form, filtr bez wyników) trwa 48 ms zamiast 120 ms. Baza ma ok. 734 MB.
- Serwis: `POST /rhymes` przyjmuje opcjonalne `filters: {pos?, min?, max?}` (bity 1–31, `min` 1–6, `max` 1–5 jako górna granica, bo 6 to „6 i więcej”; `min ≤ max`). Błędne dają 400, a aplikacja wysyła tylko filtry zawężające. Akcja `lookUpRhymes(word, filters)` sprawdza filtry tak samo (`parseRhymeFilters`). Błędne dają `INVALID_INPUT`, bez cichego pokazywania pełnej listy. Wynik niesie filtry, z którymi go znaleziono.
- Interfejs: zmiana filtra od razu szuka ponownie słowa z ostatniego wyniku (nie tekstu z pola, jeśli zmieniony bez szukania). Filtry nie są blokowane w trakcie wyszukiwania, więc przechodzenie strzałkami po opcjach nie gubi fokusu. Zmiany z tego czasu dają jedno kolejne wyszukiwanie z aktualnymi filtrami. Pola sylab są w grupie „Syllables”. Filtry są w stanie modułu, jak ostatnie wyszukiwanie (D62). Pusty wynik przy aktywnych filtrach ma osobny komunikat. „Clear filters” wraca do pełnej listy i przenosi fokus na pierwszy filtr.
- Wdrożenie: najpierw `dict:upload rhymes`, potem `npm run up`. Stary kod serwisu wybiera kolumny po nazwie i działa z nową bazą, a nowy kod ze starą bazą dawałby 500.
