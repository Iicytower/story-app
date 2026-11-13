# D29 – Menu konta zamiast górnego paska (2026-10-30)

Status: archiwalna – górny pasek i menu konta zastąpione sidebarem z D42.

- Górny pasek `h-14` usunięty ze wszystkich stron chronionych. Stories, Toggle theme i Log out są w menu konta (`app/(protected)/account-menu.tsx`, przycisk „Account”) renderowanym w layoucie, więc działa na każdej stronie chronionej, także na 404.
- Przycisk jest `absolute` w prawym górnym rogu: odjeżdża z przewijaną stroną i nie zasłania treści. Mieści się w górnym paddingu stron (32 px), a w edytorze wiersz tytułu rezerwuje na niego miejsce. Edytor ma wysokość `h-dvh`.
- Ikona „Home” (`/stories`) w lewym górnym rogu, w layoucie i pozycjonowana tak samo jak przycisk menu. Wiersz tytułu edytora ma miejsce po obu stronach (`px-9`). Pozycja Stories w menu zostaje.
- `components/ui/dropdown-menu.tsx`: Radix z istniejącego pakietu `radix-ui`, bez nowej zależności. `ThemeToggle` zastąpiony pozycją menu; `applyTheme` wywołuje `AccountMenu`, bo treść menu jest montowana dopiero po otwarciu.
