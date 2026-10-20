# 06 – Edytor WYSIWYG z trybem Source

Jedno pole zamiast dwóch kolumn (edytor + podgląd). Pisze się w sformatowanym tekście, a markdown jest zapisywany pod spodem. Ten sam edytor obsługuje treść, notatki rozdziału i notatki folderu. Zależy od 05. Nowy pakiet: biblioteka edytora wybrana w spike'u (zgoda użytkownika).

## Spike (przed implementacją)

Porównać Tiptap i Milkdown w aktualnej dokumentacji i na małym prototypie. Każdy punkt to pass/fail:

1. Pojedynczy Enter ze starych opowiadań (remark-breaks: nowa linia = złamanie linii) przetrwa wczytanie i zapis bez zmiany wyglądu.
2. Komentarz `<!-- -->` wczytuje się jako edytowalny węzeł i wraca do źródła bez zmian.
3. HTML wyrównania i koloru z tasku 07 przetrwa serializację.
4. Działa jako Client Component w React 19 / Next 16 (SSR bez błędów hydracji).
5. Rozmiar pakietu i aktywność utrzymania.

Wynik (rekomendacja + tabela) przedstawić użytkownikowi do akceptacji przed instalacją.

## Zakres

- Pasek: przełącznik **Preview / Source**. Przy otwarciu zawsze Preview, wybór nie jest zapamiętywany. Source pokazuje surowy markdown w textarea, a przełączanie zachowuje treść i niezapisane zmiany.
- Przyciski i skróty:
  - Bold (Ctrl+B), Italic (Ctrl+I);
  - H1–H3;
  - lista punktowana i numerowana;
  - cytat;
  - linia pozioma;
  - link (Ctrl+K, dialog z adresem; dozwolone tylko `http`, `https` i `mailto`);
  - Comment (wstawia `<!-- -->`);
  - Undo / Redo.

  Cmd zamiast Ctrl na macOS.
- Enter = nowy akapit, Shift+Enter = złamanie linii (w Preview). W Source bez zmian.
- Komentarze w Preview widoczne jako wyróżniony, edytowalny blok. Na stronach publicznych dalej usuwane (`stripComments`).
- Normalizacja źródła przez serializer jest dopuszczalna (np. `*a*` → `_a_`), ale samo otwarcie opowiadania niczego nie zapisuje. Zapis następuje dopiero po zmianie treści.
- Autozapis, Ctrl+S, ochrona przed pustą treścią, konflikty i licznik słów działają jak dotąd (D9). Licznik liczy z markdowna.
- Notatki rozdziału i folderu: ten sam komponent edytora, w tym przełącznik Preview / Source.
- Mobile: przełącznik Preview / Source w pasku, zakładki z tasku 05 bez zmian.
- Strona publiczna i eksport bez zmian (renderowane z markdowna).
- Decyzja w `decisions.md`: wybrana biblioteka, Enter/Shift+Enter, skróty formatowania (odstępstwo od spec „brak skrótów”).

## Kryteria akceptacji

1. Jedno pole edycji w trybie Preview, bez osobnej kolumny podglądu.
2. Każdy przycisk i skrót daje oczekiwany markdown w Source.
3. Source ↔ Preview zachowuje treść, a zmiany z Source są widoczne w Preview.
4. Stare opowiadanie z pojedynczymi nowymi liniami wygląda po wczytaniu tak samo jak w v1.0. Otwarcie bez edycji nie wywołuje zapisu.
5. Enter tworzy akapit, Shift+Enter złamanie linii.
6. Komentarz widoczny i edytowalny w Preview, zachowany w źródle, nieobecny na stronie publicznej.
7. Link `javascript:` jest odrzucany.
8. Autozapis, Ctrl+S, konflikt i pusta treść zachowują się jak w v1.0 (istniejące testy E2E zielone).
9. Notatki mają ten sam edytor i przełącznik.

## Testy

- Jednostkowe: konwersja markdown ↔ dokument edytora na fikstruach (stare opowiadanie z remark-breaks, komentarze, listy, linki) (3, 4, 6, 7).
- E2E: przyciski i skróty → zawartość Source (2), przełączanie (3), Enter/Shift+Enter (5), brak zapisu po otwarciu (4), komentarz na stronie publicznej (6), notatki (9). Istniejące testy edytora dostosowane (8).
