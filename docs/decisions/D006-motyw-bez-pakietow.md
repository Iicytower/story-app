# D6 – Motyw bez dodatkowych pakietów (2026-10-06)

Status: aktualna.

- Bez `next-themes`: inline `<script>` w `<head>` root layoutu czyta `localStorage["theme"]` i dodaje klasę `dark` do `<html>` przed pierwszym renderem (`suppressHydrationWarning` na `<html>`).
- Domyślnie jasny motyw (bez wyboru użytkownika nie patrzymy na `prefers-color-scheme`).
- Strony chronione w grupie tras `app/(protected)/` ze wspólnym nagłówkiem; wylogowanie przez Server Action `logout` (`signOut({ redirectTo: "/login" })`).
