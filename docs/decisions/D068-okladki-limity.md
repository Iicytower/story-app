# D68 – Okładki folderów: decyzje przy starcie taska 26 (2026-11-09)

Status: aktualna.

- Globalny limit łącznego rozmiaru okładek w zmiennej `COVERS_MAX_TOTAL_MB` (domyślnie 200 MB); po pomiarze danych w Atlasie użytkownik zmienia tylko zmienną.
- Kopia przed migracją (zmienia D14): usunięcie starej kopii, nowa kopia `$out`, potem `up`; zostaje jedna kopia zamiast trzech, a kolekcja `covers` nigdy nie jest kopiowana. Backup poza Atlasem zostaje ręczny (`scripts/backup.sh` przed wydaniem, `docs/deploy.md`).
- `scripts/backup.sh` obejmuje `covers` w archiwum i w `json/`.
- Model: sam OwenElliott `image-safety-classifier-s` (ONNX, `onnx/image-safety-classifier-s.onnx`, SHA-256 `fef443ed68ae25ed693b6fef9e456071692ed3963cff4168acb39c3de6f017e7`), pobierany przy pierwszym starcie usługi do wolumenu i sprawdzany sumą. Próg 18+ (`nsfw` lub `nsfl`) w zmiennej aplikacji `COVERS_ADULT_THRESHOLD`, domyślnie 0,5, do kalibracji na próbce.
- Ponowne kodowanie obrazu (bez metadanych, WebP 600×900) w usłudze klasyfikatora (Pillow), bez nowego pakietu npm.
- Brak werdyktu: okładka zapisana jako `pending` (niewidoczna), ponowienia po 5 min, 30 min i 24 h od uploadu, potem usunięcie. Ponowienia leniwie: pierwsze żądanie czytające folder po terminie wykonuje próbę w `after()`; próbę przejmuje atomowo jedno żądanie.
- Odrzucenie po nieudanych próbach: folder zapamiętuje odrzucenie, strona folderu pokazuje komunikat do czasu nowego uploadu albo zamknięcia komunikatu.
- Implementacja: kolekcja `covers` (`data`, `size`, `state: pending | rated`, `scores`, `model`, `autoAdult`, `manualAdult`, `attempts`, `nextAttemptAt`, `userId`), w folderze `coverId` (okładka z werdyktem) i `coverRejectedAt`. Nowy upload usuwa wcześniejszą okładkę `pending` folderu; poprzednia z werdyktem zostaje do chwili oceny nowej. `autoAdult` ustawia `adult.auto` folderu (blokada z D67), usunięcie okładki je zeruje.
- Akcje w `folders/[id]/cover-actions.ts`, dialog „Okładka” w menu ⋮ nagłówka folderu (tylko z `TOOLS_API_URL`): kadr 2:3 z przeciąganiem i powiększeniem, WebP 600×900 z canvasu (JPEG, gdy przeglądarka nie koduje WebP), ręczne oznaczenie okładki jako 18+, usunięcie. Akcja przyjmuje WebP, JPEG lub PNG do 1 MB po bajtach.
- `GET /covers/<id>`: tylko okładka z werdyktem i aktualna w folderze; właściciel zawsze (`private`), inni tylko dla opublikowanego folderu (`public`), oba `max-age=31536000, immutable`.
- Eksport: `cover.webp` w zipie folderu; w `.epub`, `.docx` i `.pdf` przeglądarka zamienia okładkę na JPEG (biblioteki DOCX i PDF nie przyjmują WebP) i wstawia ją jako pierwszą stronę. Import zipa z `cover.webp` wysyła okładkę (przez ten sam filtr) tylko do nowo tworzonego folderu; błąd okładki nie przerywa importu.
