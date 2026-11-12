# D80 – Nawigacja (2026-11-10)

Status: aktualna. Część D80, spis w [index.md](index.md).

- Sidebar (D42): Home, Feed, Biblioteka, Foldery, Fora, Wiadomości (licznik), Powiadomienia (dzwonek z licznikiem, panel), Mój profil, Moderacja (autor z publikacjami lub moderator), Admin (tylko admin), Statystyki (autor z publikacjami), Ustawienia, Wyloguj. Na wąskim ekranie w szufladzie jak dziś.
- Breadcrumb na publicznych stronach (2026-11-12, bez taska): nad tytułem folderu `Strona główna / autor`, nad tytułem rozdziału `Strona główna / autor / folder` (zastępuje tekst „folder – autor”, klucz `public.folderBy` usunięty). Komponent `app/[locale]/p/[nickname]/breadcrumb.tsx`, `nav` z `aria-label` `public.breadcrumb`; link „Spis treści” na dole rozdziału zostaje. Tylko widoki publiczne, edytor bez zmian.
