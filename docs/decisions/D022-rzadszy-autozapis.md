# D22 – Rzadszy autozapis (2026-10-21)

Status: aktualna.

- Zmienia spec („około 3 s”): autozapis 20 s po ostatnim naciśnięciu klawisza (`AUTOSAVE_DELAY_MS` w `lib/autosave.ts`) w edytorze rozdziału i w notatkach folderu. Przy ciągłym pisaniu zapis czeka na przerwę.
- Ukrycie karty (`visibilitychange` → `hidden`) zapisuje od razu przez tę samą kolejkę; bez zmian i przy pustym tytule nie wysyła żądania. Ctrl+S, `beforeunload` i zapis przed zmianą rozdziału bez zmian.
- E2E przewijają czas `page.clock` zamiast czekać.
