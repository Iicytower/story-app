# 67 – Pomiar limitu okładek i kalibracja progu 18+

Przypomnienie z tasków 26 i 66 (D68). Wartości w `.env.example` są szacunkiem, nie pomiarem.

## Zakres

- Zmierzyć dane w Atlasie produkcji i stagingu (`db.stats()`, rozmiar kolekcji `stories`, `folderversions` i innych) i policzyć, ile miejsca z limitu M0 (512 MB) zostaje na okładki z zapasem na wzrost tekstu i wersji.
- Ustawić `COVERS_MAX_TOTAL_MB` na Vercelu (produkcja i staging) według pomiaru i poprawić wartość w `.env.example`.
- Skalibrować `COVERS_ADULT_THRESHOLD` na próbce okładek (bezpiecznych i 18+) z prawdziwym klasyfikatorem i ustawić go na Vercelu.
- Zapisać wynik pomiaru i kalibracji w D68.

Szacunek wyjściowy: okładka WebP 600×900 to ok. 50–100 KB, więc 150 MB mieści ok. 1500–3000 okładek, a dla tekstu i wersji zostaje ponad 300 MB.

## Kryteria akceptacji

1. `COVERS_MAX_TOTAL_MB` i `COVERS_ADULT_THRESHOLD` są ustawione na Vercelu i opisane w D68 (pomiar, data). `manual`
2. `.env.example` ma wartości z pomiaru. `manual`

## Testy

Brak nowych – limity i próg mają testy z tasku 26 (`lib/covers/covers.test.ts`, `tests/integration/covers.test.ts`).
