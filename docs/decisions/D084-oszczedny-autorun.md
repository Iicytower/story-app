# D84 – Oszczędniejszy autorun (2026-11-13)

Status: aktualna. Zmienia D83 (warianty `ui-checker` po subtaskach).

- Bez taska, decyzja użytkownika po analizie przebiegu `/autorun 51` (2026-11-12/13): 15 subtasków, ok. 10 h pracy i 13 h czekania na limit 5 h konta. Odczyt z cache 178M: `implementer` (Opus) 65%, `ui-checker` 21%, sesja główna 11%. Wąskim gardłem jest limit, więc mniej tokenów to krótszy przebieg.
- `scripts/autorun-night.sh`: sesja główna na Sonnecie (`AUTORUN_MODEL`, domyślnie `sonnet`); po limicie śpi do godziny resetu z CLI (`rate_limit_event.resetsAt` albo tekst „resets 7:30pm”) plus minuta; próby zakończone limitem nie liczą się do `AUTORUN_MAX_ATTEMPTS`; błąd API (np. 403 Cloudflare) – ponowienie po 5 min, stop po 12 błędach z rzędu; log w `stream-json`.
- Skill `autorun`: zlecenie dla `implementer` podaje pliki do zmiany i cytuje potrzebne punkty decyzji zamiast kazać czytać całe pliki; zmiany mechaniczne skryptem; testy raz po wszystkich zmianach. Model `implementer` z linii `Model:` w pliku taska, bez niej Opus dla uprawnień, danych, bezpieczeństwa i dużych refaktorów, Sonnet dla reszty.
- `ui-checker` po subtasku: jeden wariant (1280 jasny `/pl`, 375 ciemny `/pl` przy zmianie układu mobilnego), tylko dotknięte strony, do ok. 20 tur. Wszystkie warianty tylko w audycie końcowym. Zmienia zasadę dwóch wariantów z D83.
- Planowanie przebiegu: subtask do ok. 30 min pracy `implementer`; linia `Model:` w każdym pliku taska; start tuż po resecie limitu, bez używania konta w trakcie.
