# 23 – Korekta tekstu w dialogu

Zgłoszenie użytkownika (2026-10-30), przebudowane po researchu z 2026-10-31. Kafelek „Proofread” w Tools sprawdza treść rozdziału przez LanguageTool, a zmiany przegląda się w dialogu. Silnik, akcja sprawdzania i język folderu: task 29. Zapamiętane słowa: task 30.

## Zakres

- Kafelek „Proofread” w Tools, działający zawsze na treści otwartego rozdziału. Notatki rozdziału i folderu są poza zakresem.
- Dialog modalny: po kliknięciu komunikat o przetwarzaniu, a po odpowiedzi widok całego rozdziału z zaznaczonymi błędami.
- Widok jak Preview (tekst sformatowany). Pozycje z LanguageTool liczone na źródle, a zmiany trafiają do markdownu.
- Przy każdym błędzie: rodzaj, opis, lista podpowiedzi, pole na własny tekst, „Reject”. Błąd bez podpowiedzi można poprawić własnym tekstem albo odrzucić. Zmienione przy starcie: zamiast pola na własny tekst dialog jest edytowalny (D59).
- Końcowe „Accept” nadpisuje treść rozdziału przez edytor. Zamknięcie dialogu bez „Accept” niczego nie zmienia.

## Ustalenia

- LLM odrzucony. Silnik to LanguageTool na własnym serwerze (decyzje użytkownika z researchu).
- Sprawdzanie startuje tylko z kafelka, nigdy samo.
- Wywołanie idzie przez Server Action, nie Route Handler (decyzja użytkownika). Kolejka akcji nie szkodzi, bo dialog blokuje edycję: przed startem kolejki autozapisu rozdziału i notatek folderu są opróżniane, więc w trakcie nie ma czego zapisywać.
- Błąd bez podjętej decyzji nie jest stosowany.
- „Accept” to jeden krok Undo w edytorze (w Preview `closeHistory`, w Source `execCommand`, jak D35), po którym zapis startuje od razu przez kolejkę autozapisu.
- Reguła `PL_WORD_REPEAT` zawsze włączona, bez ustawienia (uzupełnia wpis z backlogu; powtórzenia między zdaniami zostają w backlogu).
- Reforma ortografii 2026 niewymagana na start.

Do decyzji przy starcie taska:

- Mapowanie pozycji ze źródła na widok sformatowany i zapis wybranych zmian do markdownu.
- Czy komentarze są sprawdzane. Propozycja: nie, jako markup w parametrze `data`.
- Reguły LT do wyłączenia (np. `ZDANIA_ZLOZONE`), po próbie na prawdziwych rozdziałach.

Przy realizacji dopisać decyzję zmieniającą D21 oraz wyjątek od zasady „Server Actions do zapisu”.

### Ustalone przy starcie (2026-11-06, D59)

- Dialog jak propozycje zmian w GitHub Copilot: cały rozdział w edytowalnym widoku. Tekst do usunięcia ma czerwony zakreślacz, podpowiedź jest zielonym wstawionym tekstem, a obok są ✓ i ✗. Własny tekst wpisuje się wprost w dialogu. Kolor znaków bez zmian, odcienie dobrane dla jasnego i ciemnego motywu.
- Panel szczegółów obok tekstu (na wąskim ekranie pod nim): rodzaj, opis, lista podpowiedzi, ✓/✗, poprzedni/następny.
- Błąd bez podpowiedzi: żółty zakreślacz i tylko ✗.
- Komentarze nie są sprawdzane.
- Błędy, których zakres obejmuje składnię markdown, są odfiltrowane.
- `DISABLED_RULES = ["BOWIEM_ZAS"]` po próbie na próbce prozy (fałszywe alarmy przy „Ale” na początku zdania).

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Czego oczekiwać od LanguageTool 6.8

Czas odpowiedzi w teście na Coolify (task 29) **[pomiar]**: 6000 słów na 1 CPU to 18–23 s na ciepło, a pierwsze żądanie po starcie 66 s. Dialog musi to obsłużyć.

Test na prozie z dialogami, myślnikami, mową potoczną i celowymi błędami:

- Wykrywa: pisownię (Napewno, Wziąść, wejde, włanczałem), łączną i rozdzielną (nie miły, W pośród, z przed), interpunkcję („Mimo, że”, brak przecinka przed „tylko”), pleonazmy (cofnąć się do tyłu, wróciliśmy z powrotem, na dzień dzisiejszy), odmianę i składnię (tą książkę, półtorej roku, „Mi” na początku zdania, w każdym bądź razie), powtórzenie w zdaniu po włączeniu `PL_WORD_REPEAT`.
- Złe pierwsze podpowiedzi, stąd wybór z listy i własny tekst: Wogóle → „Ogóle”, Przyszłem → „Przyszłej”, Weszłem → „Węzłem”.
- Przeocza: Poszłem, na rozcież, ubrałem kurtkę, ogromna ilość ludzi, dwójka mężczyzn, warszawiaka (reforma 2026), powtórzenia między zdaniami.
- Fałszywe alarmy: „Brak przecinka w zdaniu złożonym” przez kropkę (raz), imiesłów bez orzeczenia po nierozpoznanym „Poszłem”. Linie nierozdzielone pustą linią sklejają kwestie dialogu w jedno zdanie (+2 alarmy).
- Bez szumu: potoczne kwestie („Spoko, będzie git”) i myślniki dialogowe.
- Stylistyka tylko podstawowa: pleonazmy, wyrazy nadużywane, powtórzenia w zdaniu.
- Czas: ~6100 słów to 5,9 s na zimno i ~3 s na ciepło, więc dialog musi pokazywać przetwarzanie.

### Mechanizmy w repo

- Next.js wysyła Server Actions jedna po drugiej na klienta (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:26-30`). `saveStory` idzie z kolejki edytora (`app/(protected)/stories/[id]/editor.tsx`), a zapis po ukryciu karty przez tę samą kolejkę (D22, `lib/autosave.ts`). Akcji nie da się przerwać z klienta (nie znaleziono tego w dokumentacji), więc spóźnioną odpowiedź trzeba zignorować, a zapis może czekać do końca limitu.
- Nowe wdrożenie może dać w otwartej karcie „Failed to find Server Action” (`server-actions.md:174`).
- Zamiana z jednym Undo: `replaceInDoc` z `closeHistory` w `lib/editor/find-highlight.ts`, w Source `execCommand` (`replaceInTextarea` w `components/markdown-editor.tsx`), D35.
- Podział na bloki i pozycje w markdownie: `blockStarts` w `lib/editor/source-blocks.ts` (D27).
- Dekoracje ProseMirror (`find-highlight.ts`) nadają się do zaznaczeń, gdy widok korekty używa Tiptap.
- Dialog otwiera się z panelu Tools, a przejście na wąski ekran (D12) nie może go zgubić.

### Odrzucone

- Zaznaczenia błędów w samym edytorze i lista w Tools: zastąpione dialogiem z decyzją przy każdej zmianie.
- Route Handler do sprawdzania: omijałby kolejkę, ale użytkownik wybrał Server Action.

## Kryteria akceptacji

1. Kliknięcie kafelka zapisuje niezapisane zmiany, otwiera dialog z komunikatem o przetwarzaniu i blokuje edycję.
2. Po odpowiedzi dialog pokazuje cały rozdział sformatowany, z zaznaczonymi błędami każdego rodzaju (ortografia, gramatyka, interpunkcja, styl).
3. Przy błędzie można wybrać podpowiedź, wpisać własny tekst albo odrzucić zmianę; wybór podpowiedzi można zmienić przed ✓, a tekst poprawiać ręcznie do „Accept”.
4. Błąd bez podpowiedzi pokazuje rodzaj i opis oraz daje własny tekst albo odrzucenie.
5. „Accept” zmienia tylko zaakceptowane fragmenty, nie psuje markdownu, jest cofane jednym Undo i zapisuje się od razu.
6. Zamknięcie dialogu bez „Accept” zostawia tekst bez zmian.
7. Zamknięcie dialogu w trakcie przetwarzania odblokowuje edytor, a spóźniona odpowiedź jest ignorowana.
8. Błąd silnika, przekroczony czas albo „Failed to find Server Action” daje komunikat w dialogu i nie zmienia tekstu ani nie blokuje dalszej edycji.
9. Rozdział bez błędów daje komunikat zamiast pustego widoku.
10. Myślniki dialogowe i potoczne kwestie nie dają fałszywych alarmów ze sklejania akapitów.
11. Bez zmiennych serwera narzędzi (D56) kafelek jest widoczny, a kliknięcie daje komunikat o niedostępności narzędzia.

## Testy

Unit: mapowanie pozycji, składanie markdownu z wybranych zmian, stany decyzji. Integracyjne: atrapa akcji z taska 29, obsługa błędów. E2E: kafelek, dialog, komunikat bez zmiennych serwera narzędzi, podpowiedź, własny tekst, odrzucenie, „Accept” z Undo i zapisem, zamknięcie bez zmian. `manual`: jakość wyników dla polskiego na prawdziwych rozdziałach.
