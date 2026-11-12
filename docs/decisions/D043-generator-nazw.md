# D43 – Generator nazw (2026-11-02)

Status: aktualna.

- Generator działa w całości w przeglądarce, bez AI i bez modeli uczonych na danych (decyzja użytkownika). Dlatego sylaby z tabel głosek i morfemy zamiast łańcucha Markowa, który wymagałby list nazw i trudniej reagowałby na filtry. Szczegóły: `docs/tasks/42-name-generator.md`.
- Nazwy znaczące: styl Polish/Slavic składa je z polskich członów, pozostałe style z angielskich albo wymyślonych. Mix styles dotyczy tylko sylab, nie takich członów.
- Lista 10 nazw jest zastępowana przy „Next 10”, a powtórki są wykluczane do zamknięcia dialogu. Wyniki nie są zapisywane; można je tylko skopiować.
- Sprzeczne filtry są blokowane (decyzja użytkownika): wybranie jednego odznacza ten, który przeszkadza, według osobnej listy par. Wartość, której kliknięcie coś odznaczy, ma przerywaną ramkę. Komunikat o braku wyników zostaje dla pól tekstowych i kombinacji trzech i więcej filtrów, których lista par nie obejmuje.
- Filtry w `localStorage` wygasają 7 dni po ostatniej zmianie (decyzja użytkownika).
- Ustalone przy implementacji: Polish letters jest domyślnie włączony (nazwy polskie mają diakrytyki), a Apostrophes and hyphens działa dwustronnie: włączony wymaga znaku w każdej nazwie, wyłączony go zabrania. Unpronounceable i Balanced to dodatkowa sprzeczność, bo mutacja usuwająca samogłoskę nie mieści się w 36–54% samogłosek.
- Rdzenie wulgarne obejmują polski, angielski i rosyjski (rosyjski w transliteracji łacińskiej, bo generator nie tworzy cyrylicy). Są w bundlu klienta, ładowane z generatorem dopiero po otwarciu kafelka.
