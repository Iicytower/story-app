# 64 – Rozważenie predefiniowanych tagów

Do rozważenia (task koncepcyjny – najpierw decyzja, czy i w jakiej formie, dopiero potem ewentualna implementacja). Dziś tagi są w pełni dowolne: użytkownik wpisuje własne, podpowiedzi pochodzą tylko z jego dotychczasowych tagów (`lib/tags/tags.ts`, task [24](done/24-tags.md)). Nie ma wspólnego, kuratorowanego słownika (np. gatunki, formy, tematy), więc te same pojęcia zapisują się różnie (`sci-fi`, `science fiction`, `scifi`) i słabo nadają się do przeglądania między autorami.

## Do rozważenia / decyzji

- **Czy w ogóle.** Predefiniowane tagi mają sens głównie razem z odkrywaniem treści (publiczna wyszukiwarka, task [39](done/39-public-search.md)); jeśli priorytetem zostają tagi prywatne, może wystarczyć status quo. Najpierw ta decyzja.
- **Model współistnienia:** wyłącznie lista zamknięta, czy lista predefiniowana **plus** nadal dowolne własne tagi (prawdopodobnie to drugie – mniej ograniczające).
- **Źródło listy:** stała lista w kodzie / słownikach (jak `messages/*.json`, bo tagi gatunków bywają tłumaczone, D46) czy kolekcja w bazie zarządzana osobno. Tłumaczenie vs. wartość zapisywana w rekordzie (klucz kanoniczny + etykieta lokalizowana).
- **Zasięg:** czy predefiniowane dotyczą folderów, rozdziałów, czy obu (jak dziś, oba poziomy).
- **UI:** podpowiedzi/wybór z listy obok pola na własne tagi; oznaczenie wizualne tagów predefiniowanych.
- **Publiczna wyszukiwarka:** czy predefiniowane tagi stają się oficjalnymi filtrami/kategoriami w wyszukiwarce i na stronach autorów.
- **Migracja:** co z istniejącymi dowolnymi tagami, które pokrywają się z nową listą (mapowanie czy pozostawienie bez zmian).
- **i18n:** każdy predefiniowany tag musi mieć tekst w `messages/en.json` i `messages/pl.json` (D46).

Wynik rozważań zapisać jako decyzję w `decisions.md`; jeśli wychodzi „robimy", ten task może zostać rozbity na konkretny task implementacyjny (z numerem dalej).

## Kryteria akceptacji

1. W `decisions.md` zapisana decyzja: czy wprowadzamy predefiniowane tagi, w jakim modelu (zamknięta lista vs. lista + dowolne), z jakim źródłem i zasięgiem.
2. Jeśli „tak": lista predefiniowanych tagów i ich lokalizacja (kod/słowniki/baza) oraz plan migracji istniejących tagów.
3. Jeśli „nie": krótkie uzasadnienie w decyzji, task zamknięty bez zmian w kodzie.

## Testy

Brak kodu na tym etapie (task koncepcyjny). Testy zdefiniuje ewentualny task implementacyjny, jeśli powstanie.
