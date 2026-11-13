# D73 – Zapis dużej treści a dekoder React Flight (2026-11-10)

Status: aktualna.

- Task 62. Przyczyna F8: dekoder argumentów Server Actions w React (`decodeReply`) sumuje długości napisów (jednostki UTF-16, nie bajty) leżących bezpośrednio w tablicy argumentów i odrzuca żądanie powyżej `arraySizeLimit` = 1 000 000 („Maximum array nesting exceeded”). Next.js 16.4.6 nie pozwala zmienić tej wartości. Aktualizacja z taska 56 (React 19.3.1) nie zmieniła progu. Import przechodzi, bo jego napisy leżą w obiektach.
- Limit z D72 (treść 500 000 + notatki 100 000 + tytuł 200, a w `saveStory` także obiekt korekty) daje najwyżej ok. 600 300, czyli zapas ok. 400 000 do progu (pomiar: `encodeReply` → `decodeReply`, także z maksymalną korektą i polskimi znakami).
- Edytor nie wysyła treści ponad limitem: pokazuje komunikat pod treścią i w statusie zapisu, a tekst zostaje (także przy autozapisie). Żądanie spreparowane ręcznie (500 000–~1 000 000) dostaje `INVALID_INPUT`. Powyżej 1 000 000 dalej jest 500 z dekodera, zanim akcja ruszy, i aplikacja nie ma na to wpływu. Wymaga to sesji i nie zmienia danych.
