# Raport UI/UX – Story App

Data: 2026-11-12. Metoda: przejście aplikacji przez Playwright MCP (dev server, istniejące dane seed), konta `seed_anna` (autorka) i `seed_admin`, gość. Widoki: desktop 1280 px (wszystkie ekrany), mobile 375 px (strona główna, edytor), motyw jasny i ciemny, `pl` z kontrolą `en`. Ocena według heurystyk Nielsena i Kruga, skala ważności 0–4.

Priorytet zgodnie z prośbą: **najpierw funkcjonalność i wygoda, potem estetyka; prostota, mało animacji**. Rekomendacje, które usuwają animacje albo kontrolki, są oznaczone **[mniej]**.

Zrzuty: `docs/ui-ux-report/NN-*.png`.

## Ocena: 6/10

Pasmo 6–8: kilka problemów ważności 3, żaden nie blokuje głównych zadań.

Aplikacja jest spójna wizualnie, spokojna (ciepła paleta, brak zbędnych efektów), kontrast spełnia WCAG AA w obu motywach (najniższy zmierzony: 4,5:1 dla etykiety „18+”, tekst pomocniczy 5,6:1 jasny / 7,1:1 ciemny). Do 10/10 brakuje głównie: spójnego nazewnictwa, widocznych głównych akcji, stałej nawigacji i lepszego pierwszego wrażenia w edytorze.

## Top 10

| # | Problem | Ważność | Heurystyka |
|---|---------|---------|------------|
| 1 | Jedna rzecz ma trzy nazwy: „Foldery” / „Opowiadania” / „książka” | 3 | Spójność (N4) |
| 2 | „Nowe opowiadanie” i „Nowy folder” tylko w menu ⋮ | 3 | Widoczna główna akcja |
| 3 | Godziny różnią się między stronami o strefę czasową (10:38 vs 11:38) | 3 | Stan systemu (N1) – błąd |
| 4 | Edytor: połowa ekranu pusta nad tekstem; na mobile pierwszy wiersz na 528/812 px | 3 | Minimalizm (N8), „huh?” |
| 5 | Edytor na mobile najpierw renderuje układ desktopowy, potem przeskakuje | 3 | Stan systemu (N1) |
| 6 | Brak tożsamości w nawigacji: brak logo/nazwy, nicku, wylogowania (tylko w dole dialogu ustawień) | 2 | Trunk Test |
| 7 | Publiczne strony książki/rozdziału tracą sidebar (a profil publiczny go ma) | 2 | Spójność, nawigacja |
| 8 | Trzy pełne paski narzędzi naraz w edytorze (tekst + 2 × notatki) | 2 | Minimalizm **[mniej]** |
| 9 | Kontrolki wypychają treść: formularz nowego wątku nad listą, 6 emoji pod każdym postem | 2 | Minimalizm **[mniej]** |
| 10 | Różna szerokość treści na każdej stronie | 2 | Spójność |

---

## 1. Nawigacja i elementy globalne

**1.1 Brak nazwy aplikacji i tożsamości użytkownika** – ważność 2 (`03`, `04`)
Sidebar nie ma logo ani nazwy, nie pokazuje, kto jest zalogowany. Wylogowanie jest na dole długiego dialogu ustawień (`19`). Gość widzi tylko link „Zaloguj się / Załóż konto” w prawym górnym rogu (`01`).
Poprawka: na górze sidebara nazwa aplikacji (link do strony głównej); na dole zamiast „Ustawienia” blok konta: avatar + nick, menu z „Mój profil”, „Ustawienia”, „Wyloguj”. D29 (menu konta zastąpione sidebarem) i D50 (wylogowanie w dialogu) – z perspektywy UX sugeruję dodać blok konta w sidebarze; zmiana do decyzji.

**1.2 Pozycje sidebara** – ważność 1
„Feed” nieprzetłumaczone w `pl` (propozycja: „Aktualności”). „Moderacja” jest u każdego autora w głównej nawigacji, choć używana rzadko – można ją przenieść niżej (nad „Ustawienia”) **[mniej]**. „Wiadomości” nie mają licznika nieprzeczytanych, choć „Powiadomienia” mają.

**1.3 Publiczne strony bez sidebara** – ważność 2 (`15` vs `16`, `17`)
Zalogowany użytkownik na stronie książki i rozdziału traci nawigację (zostaje tylko breadcrumb), a na profilu publicznym ją ma. Poprawka: dla zalogowanych ten sam layout z sidebarem na wszystkich stronach `/p/...`; tekst rozdziału i tak ma wąską kolumnę.

**1.4 Różna szerokość treści** – ważność 2 (`04`, `08`, `09`, `10`, `13`, `18`)
Foldery i Statystyki: ~976 px, Biblioteka: ~848 px, Feed/Fora/Wiadomości/Moderacja: ~720 px, strona główna: ~720 px. Przy przechodzeniu między stronami nagłówek „skacze”. Poprawka: dwa warianty kontenera – „wąski” (lista/czytanie) i „szeroki” (tabele, folder) – i stosować je konsekwentnie.

**1.5 Dialogi z mocnym rozmyciem tła** – ważność 1 (`02`, `14`, `19`)
Logowanie, ustawienia i panel powiadomień rozmywają całe tło. Poprawka: zwykłe przyciemnienie bez `backdrop-blur` **[mniej]**.

## 2. Strona główna (D54)

**2.1 Brak skrótu do pisania dla zalogowanego** – ważność 2 (`03`)
Zalogowana autorka widzi stronę czytelnika (wyszukiwarka, listy), bez „Kontynuuj pisanie” / „Nowe opowiadanie”. Poprawka: na górze jeden wiersz „Ostatnio edytowane: <rozdział> → Kontynuuj” + przycisk „Nowe opowiadanie”.

**2.2 Bardzo długa strona** – ważność 2 (`01`, `03`)
Sekcje „Popularne w tym tygodniu”, „Najwyżej oceniane”, „Od obserwowanych”, „Popularne w kategoriach” (10 nagłówków po 1 pozycji) dają ~3600 px przewijania. Część powtórzeń to efekt małej liczby danych seed, ale „Popularne w kategoriach” rośnie z każdą kategorią. Poprawka: kategorie jako filtr (klik w chip kategorii nad listą już istnieje) zamiast osobnej sekcji; „Od obserwowanych” dubluje Feed – zostawić jedno **[mniej]**.

**2.3 Wyszukiwarka** – ważność 1
Brak przycisku, tylko „naciśnij Enter” w placeholderze (na mobile ucięty: „…naci”, `23`). Kategorie i tagi to dwa wiersze chipów bez etykiet. Poprawka: ikona lupy jako przycisk, krótszy placeholder („Szukaj opowiadań”), etykiety „Kategorie” / „Tagi” albo jeden wiersz.

**2.4 Mobile** – ważność 1 (`23`)
Hamburger to mała ikona nachodząca na nagłówek, bez paska. Data „wczoraj” spada do osobnego wiersza wyrównanego do prawej. Poprawka: cienki pasek u góry (hamburger + nazwa aplikacji), data w linii z autorem.

## 3. Foldery, folder, wersje

**3.1 Nazewnictwo** – ważność 3 (`04`, `05`, `16`, `09`)
Sidebar i nagłówek: „Foldery”; `<title>` strony: „Opowiadania”; strona główna, feed, profil, statystyki: „książka”; menu: „Nowe opowiadanie”. Użytkownik nie wie, czy folder = książka. Poprawka: jedno słowo dla kontenera (proponuję „Książki” – tak widzą to czytelnicy) i „Rozdział” dla elementu; ujednolicić `messages/*.json` i tytuły stron. D16 nazywa encję „Foldery” – zmiana dotyczy tylko UI, nie modelu.

**3.2 Główne akcje schowane w ⋮** – ważność 3 (`04`)
„Nowe opowiadanie”, „Nowy folder”, „Sortuj”, „Importuj…” są w menu „Akcje”. Na stronie folderu podobnie brak widocznego „Nowy rozdział” (`05`). Poprawka: widoczny przycisk główny „Nowe opowiadanie” (na liście) i „Nowy rozdział” (w folderze); w ⋮ zostają akcje rzadkie.

**3.3 Kolejność rozdziałów** – ważność 2 (`05`)
Rozdziały od najnowszego (4, 3, 2, 1). W książce naturalna jest kolejność 1→N, a publiczny spis treści (`16`) już tak pokazuje. Poprawka: domyślne sortowanie „ręczne / od pierwszego” dla rozdziałów (D17 pozwala na tryby – zmiana domyślnego).

**3.4 Szum na liście rozdziałów** – ważność 1 (`05`)
Każdy rozdział powtarza tagi folderu (te same 4 chipy × 4). Poprawka: pokazywać tylko tagi różniące się od folderu **[mniej]**.

**3.5 Ikony statusu bez etykiety** – ważność 2 (`04`, `05`)
Glob vs przekreślony glob różnią się kilkoma pikselami; znaczenie tylko w `aria-label`. Poprawka: mała etykieta tekstowa „Publiczny” / „Niepubliczny” zamiast samej ikony.

**3.6 Pasek publicznego linku jako pole tekstowe** – ważność 1 (`05`, `06`)
Pełny URL w polu input zajmuje cały wiersz w folderze i w edytorze. Poprawka: „Publiczny · Kopiuj link · Otwórz” jako jeden kompaktowy wiersz albo pozycja w menu **[mniej]**.

**3.7 Notatki folderu: tekst na środku pola** – ważność 2 (`05`)
Ten sam mechanizm co w edytorze (pkt 4.1) – krótka notatka wisi w połowie wysokości ramki.

**3.8 Wersje** – ważność 2 (`21`)
„Przywróć całą wersję” jest przyciskiem głównym nawet wtedy, gdy wszystkie rozdziały mają „bez zmian”. Poprawka: wyłączyć przycisk, gdy nic się nie różni; dla akcji trudnej do cofnięcia styl drugorzędny + potwierdzenie (jeśli nie ma). Checkboxy 14 px – powiększyć klikalny obszar do całego wiersza.

**3.9 Przesunięcie układu przy ładowaniu folderu** – ważność 1 (`22`)
Wiersz linku publicznego i pasek narzędzi notatek pojawiają się po chwili; wcześniej pusta ramka. Poprawka: zarezerwować miejsce (szkielet o stałej wysokości).

## 4. Edytor (D12, D19, D41, D51)

**4.1 Pusta przestrzeń nad tekstem** – ważność 3 (`06`, `24`)
`components/markdown-editor.tsx:744` – `TOP_GAP = 1/2` widoku dodawane jako `padding-top` (typewriter). Po otwarciu rozdziału na desktopie tekst zaczyna się ~300 px niżej, na mobile pierwszy wiersz jest na 528 z 812 px (po ~300 px nagłówka, linku, zakładek i dwóch wierszy paska narzędzi). Pierwsze wrażenie: „czy tekst się załadował?”. Poprawka: przy otwarciu przewinąć do początku tekstu (`scrollTop = gap`) albo zmniejszyć górny odstęp do 1–2 wierszy; dolny odstęp (pisanie na wysokości wzroku) może zostać.

**4.2 Układ desktopowy przed hydratacją na mobile** – ważność 3 (`stories/[id]/layout-store.ts:77`)
`useIsDesktop()` zwraca `true` po stronie serwera, więc wąski ekran najpierw dostaje panel boczny na pół ekranu (zakładki obcięte do „N R N”, pusty edytor), a po hydratacji przeskakuje. To nie artefakt dev – mechanizm JS działa tak samo na produkcji. (Zrzut `24` pokazuje stan po hydratacji; przeskok zaobserwowany na żywo, dowodem jest kod.) Poprawka: przełączanie układu w CSS (`md:`) albo ukrycie obu wariantów do czasu hydratacji.

**4.3 Za dużo pasków narzędzi** – ważność 2 (`06`)
Jednocześnie widoczne: pasek treści + pełny pasek „Notatki folderu” + pełny pasek „Notatki”, każdy w dwóch wierszach. Poprawka: w notatkach tylko tryb + wyszukiwanie (formatowanie skrótami lub po zaznaczeniu tekstu), albo pasek widoczny tylko w aktywnym polu **[mniej]**.

**4.4 „Podgląd” jako nazwa trybu edycji** – ważność 2
Tryb, w którym się pisze (WYSIWYG), nazywa się „Podgląd”, a obok „Źródło”. Sugeruje tylko-do-odczytu. Poprawka: „Tekst” / „Markdown”.

**4.5 Sidebar aplikacji zabiera miejsce w edytorze** – ważność 1 (`06`)
208 px nawigacji przy pisaniu. Można zwijać sidebar automatycznie na stronie edytora (przycisk „Zwiń pasek boczny” już jest – kwestia domyślnego stanu).

**4.6 Status zapisu** – ważność 1
„Zapisano” pojawia się po zapisie, w spoczynku nic. Poprawka: stały, cichy status „Zapisano” obok licznika słów w stopce – jedno miejsce, bez animacji.

**4.7 Panel Narzędzia** – ważność 1 (`07`, `25`)
Karty dochodzą do prawej krawędzi (brak marginesu). Poza tym czytelne.

## 5. Biblioteka, feed, statystyki

**5.1 Biblioteka: ustawienie nad treścią** – ważność 1 (`08`)
Checkbox „Biblioteka publiczna” z opisem stoi nad zakładkami. Poprawka: przenieść do „Zarządzaj półkami” albo do ustawień **[mniej]**.

**5.2 Feed: wszystko podkreślone** – ważność 2 (`09`)
Każdy wpis ma 3–4 podkreślone linki w jednym zdaniu; trudno zeskanować. Poprawka: jeden link na wpis (tytuł rozdziału, pogrubiony), autor i książka jako zwykły tekst/mniej wyróżnione linki bez podkreślenia; opcjonalnie fragment tekstu jak na stronie głównej.

**5.3 Statystyki: wykres pojawia się z opóźnieniem** – ważność 1 (`18`)
Przez ~1–2 s pusta przestrzeń 256 px (`ResponsiveContainer` czeka na pomiar), potem wykres z domyślną animacją recharts (w kodzie brak `isAnimationActive`). Poprawka: `isAnimationActive={false}` **[mniej]** i szkielet o stałej wysokości. Opis pod „Książki i rozdziały” (3 zdania) skrócić do jednego.

## 6. Społeczność

**6.1 Fora: lista kategorii bez informacji** – ważność 2 (`10`)
Same nazwy, bez opisu, liczby wątków i ostatniej aktywności. Poprawka: jedna linia meta pod nazwą („12 wątków · ostatni post 2 dni temu”).

**6.2 Formularz nowego wątku nad listą** – ważność 2 (`11`)
Rozwinięty formularz zajmuje górę strony, wątki są pod nim. Poprawka: przycisk „Nowy wątek” rozwijający formularz **[mniej]**.

**6.3 Reakcje pod każdym postem** – ważność 2 (`12`, `17`)
Sześć emoji zawsze widocznych pod każdym postem i rozdziałem + licznik „1 reakcja” dublujący liczbę przy emoji. Poprawka: pokazywać tylko użyte reakcje z licznikami + jeden przycisk „Dodaj reakcję”; usunąć łączny licznik **[mniej]**.

**6.4 Wiadomości: lista bez kontekstu** – ważność 2 (`13`)
Tylko nick i data – brak fragmentu ostatniej wiadomości i oznaczenia nieprzeczytanych. Poprawka: jedna linia podglądu + kropka/pogrubienie dla nieprzeczytanych.

**6.5 Powiadomienia** – ważność 1 (`14`)
Pełne daty z godziną przy każdej pozycji; brak grupowania. Poprawka: czas względny („2 godz. temu”) i grupy „Dzisiaj / Wcześniej”. (Identyczne godziny 11:38 to artefakt seed.)

**6.6 Profil: edycja w innym miejscu niż podgląd** – ważność 2 (`15`, `19`)
„Mój profil” prowadzi do widoku publicznego bez przycisku „Edytuj”; bio i avatar edytuje się w dialogu ustawień. Ten sam tekst nazywa się „O mnie” na profilu i „Bio” w ustawieniach. Poprawka: przycisk „Edytuj profil” na własnym profilu (otwiera tę samą sekcję ustawień), jedna nazwa „O mnie”.

**6.7 Strona książki** – ważność 2 (`16`)
- „Czytaj dalej” – najważniejsza akcja czytelnika – ma styl drugorzędny, taki jak „W bibliotece”. Poprawka: przycisk główny.
- Gwiazdki pokazują 3 wypełnione obok „Średnia 3,8”, a pod spodem „Twoja ocena: 3 gwiazdki” – nie wiadomo, czy gwiazdki to średnia, czy moja ocena. Poprawka: średnia jako tekst/liczba, gwiazdki tylko jako „Twoja ocena”.
- Brak okładki i opisu książki na jej stronie (okładka jest na stronie głównej).

**6.8 Rozdział publiczny** – ważność 2 (`17`, `27`)
Po tekście kolejno: zakładki, ocena rozdziału, reakcje, „Zgłoś”, dopiero potem nawigacja poprzedni/następny. Ocena istnieje i dla książki, i dla rozdziału – dwa systemy ocen obok siebie. Poprawka: nawigacja „Następny rozdział →” bezpośrednio pod tekstem (główny przycisk), potem reakcje; rozważyć ocenę tylko na poziomie książki **[mniej]**. Pływający pasek zakładek ma cień – zwykła ramka wystarczy.

## 7. Ustawienia, moderacja, admin

**7.1 Ustawienia w jednym długim dialogu** – ważność 2 (`19`)
Wygląd, język, słownik, powiadomienia (kilkanaście checkboxów), profil, hasło, wylogowanie – wszystko w przewijanym modalu (D50). Poprawka: dialog z zakładkami po lewej (Wygląd, Profil, Konto, Powiadomienia) albo osobna strona `/settings`.

**7.2 Moderacja: zakładki bez liczników** – ważność 1 (`20`)
„Zgłoszenia” nie pokazują liczby oczekujących. Poprawka: licznik przy zakładce.

**7.3 Admin: akcja destrukcyjna wygląda jak link** – ważność 2 (`28`)
„Ban seed_troll globally” jest tekstem bez ramki obok przycisków „Resolve” / „Dismiss”. Etykieta „Reported profile by seed_troll” brzmi, jakby to seed_troll zgłaszał. Poprawka: ban jako przycisk w stylu destrukcyjnym (czerwony obrys); etykieta „Zgłoszony profil: seed_troll”.

## 8. Błędy wykryte przy okazji

**8.1 Niespójne godziny (strefa czasowa)** – ważność 3
Moderacja („26 października 2026 10:38”, `20`) i admin („10:38 AM”, `28`) pokazują godziny UTC, a lista wersji w folderze (`05`, `22`) – czas lokalny (11:38 dla tych samych danych seed). Strona wersji (`21`) pokazała 10:38, choć używa `LocalDate` – prawdopodobnie zrzut sprzed hydratacji (do potwierdzenia). Kilka stron formatuje daty na serwerze z `timeZone: "UTC"` bez oznaczenia strefy: `feed/page.tsx:41`, `stats/page.tsx:39`, `moderation/page.tsx:87`, `admin/page.tsx:78`, `forum-views.tsx:41`, `comments.tsx:57`, `community-ban-notice.tsx:13`, `published-date.ts:16`. Użytkownik w Polsce widzi godziny o 1–2 h wcześniejsze niż rzeczywiste. Poprawka: wszystkie daty z godziną przez `LocalDate` (albo strefa z ustawień użytkownika); daty bez godziny mogą zostać w UTC.

## 9. Co działa dobrze

- Spokojna, ciepła paleta i typografia; brak zbędnych animacji – zgodne z oczekiwaną prostotą.
- Kontrast tekstu spełnia WCAG AA w obu motywach; tryb ciemny dopracowany (`22`, `25`, `27`).
- Tłumaczenia kompletne w sprawdzonych miejscach (`en` w edytorze bez braków).
- Czytanie rozdziału: dobra szerokość kolumny, interlinia, breadcrumb.
- Statystyki: czytelna tabela książka → rozdziały.
- Menu ⋮ w edytorze ma sensowny zestaw akcji z wyróżnionym „Usuń”.

## 10. Wykluczone z oceny

Znaczek Next.js („N”, „Rendering…”, „Compiling”), komunikaty HMR, ostrzeżenie o preload CSS, błąd hydratacji `caret-color` w polu wyszukiwania (aplikacja nie ustawia `caret-color` – artefakt automatyzacji), powtarzające się tytuły na stronie głównej i identyczne godziny powiadomień (mało danych seed).

**Nie sprawdzono:** puste stany nowego konta, komunikaty błędów (nieudany zapis, złe logowanie), nawigacja samą klawiaturą i widoczność focusu, wyniki wyszukiwania, menu ⋮ wiersza folderu, mobile poza stroną główną i edytorem.

## 11. Proponowane zadania

Kolejność zgodna z priorytetem: funkcjonalność → spójność układu → estetyka.

**Poziom 1 – funkcjonalność i wygoda**
1. Jedno nazewnictwo książka/rozdział w całym UI (3.1).
2. Widoczne „Nowe opowiadanie” / „Nowy rozdział” (3.2) + skrót „Kontynuuj pisanie” na stronie głównej (2.1).
3. Daty z godziną w lokalnej strefie (8.1).
4. Edytor: bez pustej połowy ekranu na starcie (4.1), układ mobile bez przeskoku (4.2), „Tekst / Markdown” zamiast „Podgląd / Źródło” (4.4).
5. Blok konta w sidebarze: nazwa aplikacji, nick, wylogowanie; „Edytuj profil” na własnym profilu (1.1, 6.6).
6. Domyślna kolejność rozdziałów od pierwszego (3.3).

**Poziom 2 – spójność układu i mniej kontrolek**
7. Sidebar na stronach `/p/...` dla zalogowanych (1.3) i dwa warianty szerokości kontenera (1.4).
8. Mniej kontrolek: paski narzędzi w notatkach (4.3), reakcje tylko użyte + „Dodaj” (6.3), formularz wątku pod przyciskiem (6.2), link publiczny kompaktowo (3.6), nawigacja rozdziałów pod tekstem (6.8).
9. Listy z kontekstem: fora (6.1), wiadomości (6.4), feed z jednym linkiem na wpis (5.2).
10. Ustawienia podzielone na zakładki (7.1); „Czytaj dalej” jako przycisk główny i jednoznaczne gwiazdki (6.7).

**Poziom 3 – estetyka i drobiazgi**
11. Bez `backdrop-blur` w dialogach i bez animacji wykresu (1.5, 5.3).
12. Etykiety statusu zamiast samych ikon (3.5), szkielety o stałej wysokości (3.9, 5.3), liczniki w moderacji (7.2), styl destrukcyjny dla banu (7.3), drobne poprawki mobile na stronie głównej (2.3, 2.4).
