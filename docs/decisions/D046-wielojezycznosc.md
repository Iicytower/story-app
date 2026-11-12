# D46 – Wielojęzyczny interfejs z prefiksem w adresie (2026-11-03, zmienione 2026-11-04 w D54)

Status: aktualna. Zmieniona w D54.

- Zmienia zasadę „UI w całości po angielsku” i założenie prywatnej aplikacji: aplikacja docelowo jest publiczna, interfejs ma wybór języka. Na start angielski i polski; kolejny język to tylko nowy plik tłumaczeń i wpis na liście języków (decyzja użytkownika).
- Biblioteka `next-intl` (decyzja użytkownika, instalacja w tasku 43).
- Każdy adres ma prefiks `/en/...` albo `/pl/...`, także dla domyślnego angielskiego. Segmenty ścieżek są te same we wszystkich językach (`/pl/stories`). Poza prefiksem zostają Route Handlery (`/api/...`, eksport).
- Wejście bez prefiksu przekierowuje na język wybrany kolejno z: ustawienia zalogowanego użytkownika, cookie z ostatniego wyboru, `Accept-Language`, a gdy nic nie pasuje – angielski. Stare adresy (w tym publiczne `/p/...`) działają dzięki temu przekierowaniu.
- Przełącznik tylko w sidebarze (zalogowani). Niezalogowany zmienia język adresem albo ustawieniami przeglądarki.
- Komunikaty Server Actions tłumaczone na serwerze według języka żądania; kształt `{ ok, error, message }` bez zmian.
- Język interfejsu jest niezależny od języka treści folderu (D44, task 29): `lang` edytora i spellcheck zależą od folderu, nie od UI.
- Polskie tłumaczenie przygotowuje Claude, użytkownik je przegląda.
- Podział: task 43 (routing), 44 (słowniki `en`), 45 (przełącznik i `pl`).
