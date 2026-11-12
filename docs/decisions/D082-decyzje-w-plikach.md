# D82 – Decyzje w osobnych plikach (2026-11-12)

Status: aktualna.

- Bez taska, decyzje użytkownika. Cel: wygoda i mniej tokenów – zamiast czytać `docs/decisions.md` (746 linii) Claude czyta spis i jeden plik.
- `docs/decisions.md` usunięty. Każda decyzja ma plik `docs/decisions/DNNN-slug.md` (numer z zerami, slug po polsku bez znaków diakrytycznych). Duża decyzja dzieli się na folder `DNNN-slug/` z `index.md` (wstęp, lista części) i plikami części (D80).
- Nagłówek każdego pliku, także części: `# Dnn – Tytuł (data)`, pusta linia, linia statusu. Status: `Status: aktualna.` (opcjonalnie `Zmieniona w Dxx.`) albo `Status: archiwalna – <przez co zastąpiona / czemu zamknięta>.` Części folderu: `Status: aktualna. Część Dnn, spis w [index.md](index.md).`
- Spis `docs/decisions/index.md`: sekcja „Aktualne” z grupami tematycznymi i sekcja „Archiwalne”; wiersz to link z numerem, tytuł i jedno zdanie, czego dotyczy, plus relacje („Zmieniona w…”, „Zastępuje…”).
- Archiwalna: w całości zastąpiona albo jednorazowe ustalenie dotyczące zamkniętego etapu (np. branch zmergowany). Częściowo zmieniona zostaje aktualna z adnotacją. Pliki się nie przenoszą – zmiana statusu nie zmienia ścieżki.
- Nowa decyzja: kolejny numer, nowy plik i wiersz w odpowiedniej grupie spisu. Gdy zmienia starszą: w starszym pliku i jej wierszu dopisz „Zmieniona w Dnn”; gdy ją w całości zastępuje: status starszej `archiwalna – zastąpiona przez Dnn` i wiersz przeniesiony do „Archiwalne”. Treści starszej nie przepisujemy.
- Wpisy do istniejącej decyzji (rozstrzygnięcia z tasków, drobne zmiany) trafiają do jej pliku (D80: plik obszaru).
- Pierwszy podział: archiwalne D11, D13, D29, D44, D59, D70, D78. Pliki części D80 zachowały angielskie nazwy (`scope.md` itd.).
