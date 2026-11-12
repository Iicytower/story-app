# D72 – Limity rozmiaru i liczby danych (2026-11-10)

Status: aktualna.

- Taski 59 i 62, decyzje użytkownika. Wartości w `lib/limits.ts`: nazwa folderu i tytuł rozdziału do 200 znaków (jak tytuł w imporcie), treść rozdziału do 500 000 znaków, notatki rozdziału i folderu do 100 000 znaków. Znaki to `String.length` zapisywanego markdownu, tak samo w przeglądarce i w akcji.
- Liczby: 1000 folderów na konto (bez usuniętych), 500 rozdziałów w folderze (jak limit rozdziałów importu), 100 wersji folderu. Przy limicie wersji zapis jest blokowany z komunikatem „Usuń starą wersję…”; nic nie znika samo. Przywracanie wersji też go wymaga, bo najpierw zapisuje stan folderu jako wersję. Liczby sprawdzane przed zapisem, więc równoległe żądania mogą je minimalnie przekroczyć (to ochrona bazy, a nie dokładny limit).
- Import: rozdział dłuższy niż 500 000 znaków albo z za długimi notatkami odrzuca cały import z komunikatem, który podaje tytuł rozdziału. Notatki folderu dopisywane do istniejących też muszą zmieścić się w limicie. `MAX_IMPORT_TEXT_BYTES` (3,5 MB na cały plik) zostaje.
- Istniejące dane ponad limit da się otworzyć; zapis jest odrzucany, dopóki wartość jest ponad limitem, więc wystarczy ją skrócić.
- UI: `maxLength` w polach nazw i tytułów. Edytor treści i notatek (Tiptap) nie ma `maxLength`, więc przy przekroczeniu pod treścią pojawia się komunikat, a zapis i autozapis nie wysyłają żądania i pokazują komunikat w statusie. Tekst zostaje w edytorze.
