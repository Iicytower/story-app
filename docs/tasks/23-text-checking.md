# 23 – Rozwinięcie sprawdzania tekstu

Zgłoszenie użytkownika (2026-10-30). Rozwija D21: dziś pisownię sprawdza tylko przeglądarka, z włączonym polskim słownikiem.

## Zakres

- Język ustawiany per folder i obowiązujący dla wszystkich jego rozdziałów oraz notatek. Istniejące i nowe foldery domyślnie mają polski.
- Pisownia sprawdzana na bieżąco w całym polu, według języka folderu.
- Pełne sprawdzenie na żądanie (przycisk w pasku `MarkdownEditor`) w całym polu: ortografia, gramatyka, interpunkcja, stylistyka.
- Błędy zaznaczone w tekście, z rodzajem błędu, opisem i podpowiedziami; podpowiedź można zastosować albo błąd zignorować.
- Działa w każdym `MarkdownEditor`: treść rozdziału, notatki rozdziału, notatki folderu.

## Ustalenia

- Na bieżąco tylko pisownia; gramatyka i styl wyłącznie po kliknięciu przycisku (decyzja użytkownika).

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Silnik pełnego sprawdzania: LanguageTool (publiczne API, Premium, własny serwer), LLM albo inny. Porównanie obejmuje jakość dla polskiego, koszt, limity i prywatność. Każda z tych opcji zmienia D21 (tekst poza przeglądarką albo płatny hosting).
- Silnik pisowni na bieżąco: przeglądarka z `lang` z folderu (D21) albo słowniki w aplikacji. Przeglądarka nadal zależy od słowników zainstalowanych u użytkownika.
- Lista obsługiwanych języków, zależna od silnika.
- Sposób mapowania błędów na tekst w Preview i Source, gdzie pozycje się różnią (D35).
- Czy komentarze są sprawdzane.

## Kryteria akceptacji

1. Język folderu można zmienić na stronie folderu; zmiana obowiązuje we wszystkich jego rozdziałach i notatkach.
2. Folder bez ustawionego języka działa jak polski, także po migracji.
3. Literówka w tekście jest zaznaczana na bieżąco zgodnie z językiem folderu, także w języku innym niż polski.
4. Przycisk sprawdza całe pole i pokazuje błędy ortograficzne, gramatyczne, interpunkcyjne i stylistyczne wraz z ich rodzajem.
5. Żadne sprawdzenie gramatyki ani stylu nie startuje bez kliknięcia przycisku.
6. Zastosowanie podpowiedzi zmienia tylko ten fragment, jest cofane jednym Undo i zapisuje się autozapisem.
7. Zignorowany błąd znika z bieżącego wyniku.
8. Edycja tekstu po sprawdzeniu nie zostawia zaznaczeń na złych fragmentach.
9. Błąd silnika lub przekroczony limit daje komunikat i nie blokuje edycji ani zapisu.
10. Działa w treści rozdziału, notatkach rozdziału i notatkach folderu, w Preview i Source.
11. Sprawdzanie cudzego rozdziału lub folderu kończy się `NOT_FOUND`, a klucze silnika nie trafiają do klienta.

## Testy

Unit: mapowanie wyników silnika na bloki tekstu, zastosowanie podpowiedzi, normalizacja języka. Integracyjne: zapis języka folderu, własność, migracja, obsługa błędów silnika (silnik zastąpiony atrapą, bez wywołań sieciowych). E2E: zmiana języka, sprawdzenie na żądanie, zastosowanie podpowiedzi z Undo i autosave. `manual`: jakość wyników prawdziwego silnika dla polskiego.
