# D56 – Serwer narzędzi lokalnie w Dockerze, flaga po zmiennych (2026-11-06)

Status: aktualna.

- Decyzje użytkownika. Wszystko, co miało działać na Mikrusie, na czas developmentu działa lokalnie (task 54). W `docker-compose.yml` są Coolify i serwer docelowy w kontenerze (DinD z SSH), a Coolify wdraża na niego usługi jak na Mikrusie: bramkę z sekretem (54), LanguageTool (29), serwis słownikowy (25). Jedno polecenie stawia całość i dopisuje `TOOLS_API_URL` i `TOOLS_API_SECRET` do `.env.local`.
- Prawdziwy serwer (task 28) powstaje na końcu kolejki, po narzędziach z niego korzystających. Pomiary limitów czasu i RAM robimy lokalnie z limitami CPU i pamięci, a w tasku 28 je powtarzamy.
- Flaga: narzędzia korzystające z serwera (korekta, kafelki słownikowe) działają tylko, gdy ustawione są obie zmienne. Bez nich kafelek jest widoczny, a kliknięcie lub szukanie daje komunikat o niedostępności, bez wywołania sieci. Na stagingu i produkcji narzędzia włączają się po ustawieniu zmiennych na Vercelu, bez zmian w kodzie. Klient serwera narzędzi i flagę buduje task 29, pozostałe z nich korzystają.
