# 25 – Serwis słownikowy i tabela form

Zgłoszenie użytkownika (2026-10-30), przebudowane po researchu z 2026-10-31. Baza SQLite i mały serwis na Mikrusie oraz lematyzacja, z których korzystają kafelki z tasków 32–34. Widoczne narzędzia powstają w tych taskach.

## Zakres

- Serwis HTTP na serwerze z taska 28, czytający SQLite, dostępny tylko z sekretem.
- Tabela form (forma, lemat, tag) z indeksami po formie i lemacie.
- Lematyzacja: „kota” → kot, kota, z listą lematów przy wieloznaczności.
- Skrypt budujący bazę lokalnie i wgrywający plik na serwer.
- Klient po stronie aplikacji: Server Action z sesją, `AbortSignal.timeout(2000)` i wynikiem `{ ok, ... }`.
- Wspólny blok „Sources” do atrybucji w narzędziach.

## Ustalenia

- Bez zewnętrznych API w czasie działania. Do serwisu trafia tylko szukane słowo.
- Narzędzia tylko wyszukują: bez wysyłania zaznaczenia i bez podmiany w tekście (decyzja użytkownika z researchu, kryteria 3–5 poprzedniej wersji odpadają).
- Tylko polski. Pole `lang` dojdzie, gdy język folderu (task 29) obejmie inne języki.
- Baza budowana lokalnie, odświeżana na żądanie, bez ustalonego rytmu.
- Bez cache po stronie serwera. Szukanie tylko po zatwierdzeniu, a formularz jest zablokowany, dopóki trwa poprzednie, bo Server Actions idą kolejno i wstrzymują autozapis.
- Tabele każdego źródła osobno, scalanie przy odpowiedzi, a każda pozycja ma etykietę źródła (licencje). Dane poza publicznym repo, z opisem licencji.
- Bez filtrowania wulgaryzmów.

Do decyzji przy implementacji, po testach:

- **Morfologik** (dane z 2016 r., 4,67 mln form, eksport przez Javę) czy **Polimorf** (2026-10-18, 5,46 mln form, gotowy TSV), oba BSD. Na obu zmierzyć: rozmiar SQLite, RAM serwisu obok LT, czas zapytania, rozpoznanie listy słów współczesnych i literackich, wyniki rymów na 1825 parach z Pana Tadeusza i na tych samych próbkach słów.
- Język i biblioteka serwisu oraz SQLite (nowe pakiety wymagają zgody).

Przy realizacji dopisać decyzję o Server Actions do odczytu, serwisie i wybranych źródłach, z wynikami testów obu tabel form.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Tabela form: oba źródła

|  | Morfologik | Polimorf |
| --- | --- | --- |
| Wydanie | 2.1 PoliMorf z 2016-02-13; stempel „2.0, 2013” w README jest nieaktualny, także `morfologik-polish` 2.2.0 z 2026 ma dane z 2016 r. | 2026-10-18, nowe co kilka tygodni |
| Rozmiar **[pomiar]** | 4 811 854 wpisów, 4 668 625 form, 315 689 lematów, 1336 tagów, TSV 333 MB | ok. 8,51 mln wierszy, 5,46 mln form, 390 tys. lematów, 471 MB tekstu, 47,4 MB gzip |
| Pozyskanie | jednorazowy eksport `polish.dict` biblioteką `morfologik-stemming` (Java) | gotowy TSV: forma, lemat, tag, typ nazwy, kwalifikatory; pierwsze kilkadziesiąt linii to licencja |
| Tagi | `subst:sg:acc:m2+subst:sg:gen:m2` | `subst:sg:gen.acc:m2` |
| Licencja | BSD, © Marcin Miłkowski, zachować notki | BSD (Morfeusz) |
| Adres | [LanguageTool resource/pl](https://github.com/languagetool-org/languagetool/tree/master/languagetool-language-modules/pl/src/main/resources/org/languagetool/resource/pl) | [download.sgjp.pl/morfeusz/20261018](http://download.sgjp.pl/morfeusz/20261018/) |

Kod mapujący tagi pisać pod jedno źródło. Sama baza SGJP (5,03 mln form, 42,7 MB gzip) ma lematy z sufiksem homonimu (`kot:Sm2`). Odrzucone: `sjp-odm` (2026-09-01, GPL 2 / LGPL 2.1 / CC BY 4.0 / Apache 2.0, 4,59 mln form, bez tagów, a tagi są potrzebne filtrom i rankingowi rymów), Hunspell (0 pól morfologicznych w `dictionary-pl`), `morfeusz2-node-bindings` (brak licencji, prebuild tylko Windows), własny czytnik CFSA2 (zbędny przy SQLite).

Wieloznaczność **[pomiar]**: 2,9% form ma więcej niż jeden lemat. Przykłady: kota → kot, kota; mam → mieć, mama, mamić; zamku → zamek; szła → iść; poszedłem → pójść; ludzi → człowiek; lepszy → dobry; psa → pies.

### Miejsce i rozmiar danych

- Mikrus 3.5: 4 GB RAM, 40 GB dysku, dzielone z Coolify i LT. W teście na Coolify (task 28) stos z LT zajmował ok. 1,2–1,4 GB RAM, a LT do 666 MB.
- Test infrastruktury na Coolify (2026-11-01, kod atrapy w tasku 28) **[pomiar]**: atrapa z SQLite na wolumenie `/data` za bramką z sekretem zajmuje ok. 12 MB RAM przy limicie 128 MB, zwraca wiele lematów (`kota` → kot, kota), a dopisany wiersz przetrwał restart usługi i serwera. To nie jest pomiar prawdziwej bazy ani docelowego serwisu.
- Rozmiar SQLite niezmierzony; baza nie musi siedzieć w pamięci. Budowa lokalnie, bo przetwarza gigabajtowy JSONL obok działającego LT.
- Odrzucone miejsca: Atlas M0 (0,5 GB z indeksami, dzielone przez produkcję i staging, 100 ops/s; form→lemat to ok. 254 MB BSON przed indeksami), plik w paczce funkcji Vercela, Vercel Blob (po przekroczeniu blokada na 30 dni), Edge Config (1 MB), dane w przeglądarce (pobieranie i kopia danych u każdego użytkownika), żywe API Wikimedia.

### Kolejka Server Actions

- Next.js wysyła Server Actions jedna po drugiej na klienta, a druga czeka na koniec pierwszej (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md:26-30`). `saveStory` idzie tą samą drogą (`app/(protected)/stories/[id]/editor.tsx`), także po ukryciu karty (D22). Wiszące wywołanie wstrzyma zapis.
- Stąd `AbortSignal.timeout(2000)` przy każdym `fetch`. Najgorsze opóźnienie autozapisu równa się temu limitowi. Opóźnienie Vercel → Finlandia jest niezmierzone.
- Akcji nie da się przerwać z klienta, więc kolejne zapytania by się ustawiały: stąd blokada formularza.
- Nowe wdrożenie może dać „Failed to find Server Action” (`server-actions.md:174`).
- Akcje są dla mutacji (`docs/spec.md:103`, dokumentacja Next), więc odczyt wymaga wpisu w `decisions.md`. Zaleta: słowo jedzie w treści POST, a nie w URL zapisywanym w logach.
- Sesję sprawdza `requireUser()` (`lib/auth/session.ts`), który zwraca wynik zamiast rzucać.

### Cache

Na serwerze zbędny, bo powtarzałby indeksowany odczyt. Najwyżej `Map` po stronie klienta, kluczowany słowem i narzędziem. HTTP cache odpada przy POST, a `use cache` wymaga `cacheComponents`, czyli zmiany modelu renderowania całej aplikacji.

### Licencje

Share-alike dotyczy danych, nie kodu aplikacji. Aplikacja ma wiele kont, więc nie opierać się na wyjątku prywatnym. Wiersze CC BY-SA nie mieszać z LGPL/GPL w jednej tabeli (zgodność niepotwierdzona). Bloki „Sources” w kafelkach: Wikisłownik CC BY-SA 4.0, tezaurus LGPL, Słowosieć z notką, dane form BSD, lista częstości CC BY-SA.

## Kryteria akceptacji

1. Serwis odpowiada na szukane słowo tylko z poprawnym sekretem.
2. Słowo odmienione znajduje lemat; przy wieloznaczności zwracane są wszystkie, a brak daje pusty wynik.
3. Zawieszony serwis kończy akcję po 2 s wynikiem `{ ok: false, ... }`, a zapis czeka najwyżej tyle.
4. Niedostępny serwis, przekroczony czas i „Failed to find Server Action” dają komunikat i nie blokują edycji ani zapisu.
5. Do serwisu trafia tylko szukane słowo, a adres i sekret nie trafiają do klienta.
6. Działanie wymaga zalogowania.
7. Skrypt odtwarza bazę z danych źródłowych, a wgranie jej nie wymaga zmian w kodzie.

## Testy

Unit: normalizacja zapytania, mapowanie odpowiedzi serwisu. Integracyjne: sesja, atrapa serwisu, timeout, błędy (bez wywołań sieciowych). Test autozapisu przy zawieszonym serwisie. `manual`: sekret na prawdziwym serwisie (1), odtworzenie i wgranie bazy (7), połączenie ze stagingu, pomiary źródeł.
