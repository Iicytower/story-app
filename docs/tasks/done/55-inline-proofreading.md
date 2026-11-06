# 55 – Korekta w głównym edytorze

Zgłoszenie użytkownika z ręcznych testów (2026-11-06). Zmienia task 23 (D59): poprawki z LanguageTool trafiają do głównego edytora rozdziału zamiast do osobnego dialogu, żeby podczas korekty można było używać słowników i innych narzędzi.

## Zakres

- Kafelek „Proofread” otwiera małe okno z pytaniem „Czy chcesz użyć narzędzia do korekty?”, dokładnym opisem mniejszą, wyszarzoną czcionką oraz przyciskami „Sprawdź” i „Anuluj”. Request do LanguageTool idzie dopiero po „Sprawdź”.
- Gdy rozdział ma otwartą korektę, okno to mówi i pyta o nowe sprawdzenie. Nowe sprawdzenie zastępuje pozostałe poprawki.
- Po sprawdzeniu okno się zamyka, a poprawki są podkreślone w głównym edytorze (Preview), z tymi samymi zakreśleniami i ✓/✗ co w D59.
- Nad edytorem jest pasek korekty: „n z m”, poprzednia i następna poprawka, „Zakończ korektę” (usuwa pozostałe poprawki, tekst zostaje).
- Dymek przy bieżącej poprawce: rodzaj, opis LT, podpowiedzi, ✓/✗ i „Dodaj do słownika”.
- ✓ zmienia tekst od razu, jak zwykła edycja. Tekst można swobodnie edytować. Gdy nie zostanie żadna poprawka, pasek znika. Nie ma końcowego „Zatwierdź”/„Odrzuć”.
- Przełączenie na Source jest zablokowane w trakcie korekty.
- Stan korekty (pozostałe poprawki, wybrane podpowiedzi, bieżąca poprawka) zapisuje się w bazie przy rozdziale, razem z autozapisem. Po otwarciu rozdziału gdziekolwiek korekta wraca w tym samym miejscu. Jedna korekta na rozdział.

## Ustalenia

- Pozycje poprawek są zapisywane jako offsety w tekście dokumentu (węzły tekstowe bez komentarzy, jak `docText` w `lib/proofreading/map.ts`), nie jako pozycje ProseMirror. Te pierwsze nie zależą od struktury bloków, która po ponownym wczytaniu markdownu może się przesunąć (puste akapity, escape, złamania linii). Przy wczytaniu offset wraca na pozycję, a tekst musi się zgadzać z zapisanym; inaczej szuka się najbliższego wystąpienia w małym oknie, a dopiero potem poprawka znika.
- Treść i stan korekty pochodzą z tej samej transakcji edytora i zapisują się razem w `saveStory`. Odrzucenie i wybór poprawki zmieniają tylko stan korekty, a i tak uruchamiają autozapis.
- Każdy inny zapis treści rozdziału (przywrócenie wersji, przywrócenie z kosza) usuwa stan korekty. Walidacja przy wczytaniu zostaje jako zabezpieczenie.
- `saveStory` waliduje stan korekty: kształt, limit liczby poprawek i długości tekstów. Offsety LT nie są zapisywane, bo po pierwszej edycji przestają pasować.
- Pole opcjonalne w modelu, bez migracji.
- Okno z pytaniem zostaje modalne przez całe sprawdzanie, więc treść nie zmienia się w trakcie, a strażnik „rozdział się zmienił” działa jak dotąd.
- ✓ przechodzi przez zwykły zapis Preview, więc wierność źródła bajt w bajt z D59 znika.

### Ustalone przy starcie (2026-11-06, D66)

- Swobodna edycja tekstu w trakcie korekty; decyzje trafiają do treści na żywo, bez „Zatwierdź”/„Odrzuć”.
- Pasek nad edytorem i dymek przy zakreśleniu; „Zakończ korektę” na pasku.
- Blokada przełączenia na Source; ponowne sprawdzenie pyta i zastępuje poprawki.
- Stan zapisuje się z autozapisem; jedna korekta na rozdział.

## Kryteria akceptacji

1. Otwarcie okna niczego nie wysyła do LanguageTool; sprawdzenie startuje po „Sprawdź”.
2. Poprawki są podkreślone w głównym edytorze; ✓ zmienia tekst, ✗ usuwa poprawkę, wybór podpowiedzi zmienia wstawiany tekst, „Dodaj do słownika” usuwa poprawki słowa.
3. Pasek pokazuje pozycję, przechodzi między poprawkami (otwierając dymek) i „Zakończ korektę” usuwa poprawki bez zmiany tekstu; po ostatniej decyzji pasek znika.
4. W trakcie korekty działają inne narzędzia, a tekst można edytować.
5. Przełączenie na Source jest zablokowane w trakcie korekty.
6. Po przeładowaniu strony korekta wraca z tymi samymi poprawkami i bieżącą pozycją.
7. Ponowne sprawdzenie przy otwartej korekcie pyta o nie i zastępuje poprawki.
8. Przywrócenie wersji usuwa stan korekty.
9. Błąd serwisu i rozdział bez błędów dają komunikat w oknie.

## Testy

Unit: offsety w tekście dokumentu tam i z powrotem (nagłówek, lista, komentarz, escape, ponowne wczytanie markdownu), walidacja zapisanego stanu. Integracyjne: `saveStory` ze stanem korekty, przywrócenie wersji usuwa stan. E2E: kryteria 1–9.
