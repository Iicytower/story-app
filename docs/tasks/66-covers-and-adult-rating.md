# 66 – Okładki folderów i oznaczenie 18+ (zbiorczy)

Decyzja użytkownika (2026-11-09): taski [65](done/65-adult-rating.md), [26](26-cover-upload.md) i [40](40-cover-display.md) są subtaskami tego taska i są implementowane razem, w tej kolejności. Szczegóły, ustalenia, kryteria i testy są w plikach subtasków.

## Zakres

- Implementacja subtasków 65 → 26 → 40.
- Wszystko lokalnie na lokalnym stosie narzędzi (`npm run up`, task 54), który pełni rolę Mikrusa: klasyfikator ONNX z taska 26 jest nową usługą tego stosu za bramką z `X-Tools-Secret`, w `docker/tools/compose.yml`, więc na prawdziwy Mikrus trafia bez zmian razem z taskiem 28.
- Na stagingu i produkcji bez `TOOLS_API_URL` upload okładek jest wyłączony (task 26, D56), więc wydanie tego taska nie wymaga taska 28.

## Do decyzji użytkownika

Zebrane z subtasków (szczegóły i opcje w ich plikach); zapytać przed implementacją każdego subtasku:

- 65: dziedziczenie 18+ między folderem a rozdziałem, model danych, zachowanie na stronach publicznych, miejsce przełącznika, wpływ na eksport, wersje i `updatedAt`.
- 26: wartość globalnego limitu (po pomiarze w Atlasie przez użytkownika), backup przed migracją, model (OwenElliott sam czy z Marqo) i próg, zachowanie bez werdyktu, dostarczenie modelu do usługi, miejsce ponownego kodowania obrazu.
- 40: widoki z okładką.

## Branche

- `feature/66-covers-and-adult-rating` z `develop`.
- Subtaski: `feature/65-adult-rating`, `feature/26-cover-upload`, `feature/40-cover-display`, każdy z aktualnego `feature/66-covers-and-adult-rating`. Po zakończeniu subtasku jeden commit `NN: <krótki opis>`, status `[x]`, plik do `done/` i merge do brancha taska 66.
- Merge `feature/66-covers-and-adult-rating` do `develop` dopiero po wszystkich trzech subtaskach.

## Kryteria akceptacji

1. Kryteria akceptacji subtasków 65, 26 i 40 spełnione.
2. Klasyfikator działa w lokalnym stosie narzędzi (`npm run up`) i wdraża się tym samym `docker/tools/compose.yml` co reszta usług.
3. Pełny przepływ lokalnie: upload okładki folderu, ocena klasyfikatora, automatyczne 18+ z blokadą, wyświetlanie, eksport.
4. Bez `TOOLS_API_URL` upload okładek jest niedostępny, a reszta aplikacji działa bez zmian.

## Testy

Testy z plików subtasków. `manual`: kryterium 3 na lokalnym stosie narzędzi; kryterium 2 przez `npm run up` od zera.
