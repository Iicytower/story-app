# D28 – Myślniki dialogowe (2026-10-30)

Status: aktualna.

- Zmienia D20 (`- ` nie tworzy już listy). Dialog zapisujemy w źródle z półpauzą: `– Tekst` to zwykły akapit, więc podgląd, strony publiczne i eksport działają bez specjalnego renderowania.
- `DialogueDash` (`lib/editor/dialogue.ts`): wpisanie `- ` na początku bloku daje `– `. Reguła ma wyższy priorytet niż reguła listy ze StarterKit. W komentarzu nie działa (`code: true`).
- `DialogueParagraph`: serializer zamienia `- ` na początku linii akapitu na `– `, bo taki tekst (wklejenie, cofnięcie reguły, linia po Shift+Enter) wróciłby z markdownu jako lista. W edytorze myślnik zostaje do ponownego wczytania.
- Listy punktowane zostają: przycisk i `* ` (także `+ `). Serializer dalej zapisuje je jako `- `, a `- ` wpisane w Source to lista.
- Bez migracji: istniejące linie `- ` zostają listą, użytkownik poprawi je ręcznie (jak w D20). Zmienia kryterium 4 taska 13.
