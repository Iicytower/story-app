# 34 – Rymy

Wynik researchu. Kafelek „Rhymes” w Tools. Filtry: task 35.

## Zakres

- Funkcja transkrypcji i kluczy rymu w TypeScript, według specyfikacji niżej.
- Klucze liczone przy budowie bazy, z tabeli form z taska 25.
- Trzy poziomy wyników: Exact, Near, Last syllable.
- Ranking: najdłuższy wspólny sufiks fonetyczny, potem częstość.
- Odrzucanie: to samo słowo, ten sam lemat, kandydat zawierający zapytanie jako sufiks lub odwrotnie.
- Obniżanie rymów gramatycznych i słów funkcyjnych, 1–2 formy na lemat, „Show more” dla rzadkich słów.

## Ustalenia

- Słownik otwiera się dla języka folderu otwartego rozdziału (D58). Dziś lista języków folderu to tylko polski; nowy język dochodzi do listy, gdy obsługują go korekta i słowniki.
- Klucz uwzględnia akcent: czwarta sylaba od końca w `(li|ły)by(śmy|ście)$`, trzecia w trybie przypuszczającym i `-liśmy`, reszta przedostatnia. Tag czasownika sprawdza dopasowanie, a mała tabela obsługuje wyjątki.
- Near: i=y, końcowe ą=o oraz spółgłoski według klasy artykulacyjnej.
- Last syllable przy końcówce zamkniętej. Przy otwartej wymaga poprzedzającej spółgłoski (`-ki`); tego wariantu nie zbudowano w prototypie.
- Asonans poza zakresem (backlog).

Do decyzji przy implementacji, lista częstości:

- **FrequencyWords `pl_50k`**: 50 tys. słów z napisów, 2018, CC BY-SA 4.0, 676 kB.
- **wordfreq `large_pl`** filtrowany przez listę form: 453 tys. słów z 6 źródeł, CC BY-SA 4.0.
- **N-gramy NKJP**: CC BY, nie pobrano.

Kolumna z listy CC BY-SA czyni tabelę bazą share-alike, więc opisać ją jako osobny artefakt. Decyzja po próbie na tych samych słowach.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Gotowe źródła: brak

Datamuse i RhymeZone nie mają polskiego. rymy.pl i rymy.org to domeny parkowane, rymowanka.pl na sprzedaż. Rymer ma dobre wyniki, filtry i rymy wielowyrazowe, ale bez API. czterycztery.pl to rymy z wierszy, prywatne API, korpus 8100 rymów do ewentualnych testów. `czyrym` tylko sprawdza parę (91,2%). Wiktionary: 154 tys. słów z rymem, użyteczne jako test. Skrapowanie odpada z tych samych powodów co sjp.pl (ustawa o bazach danych).

### Transkrypcja i klucz

1. Małe litery, tylko litery.
2. Dwuznaki: `dzi dź dż dz cz sz rz ch`. Mapowanie ł→w, h→x, ó→u, w→v.
3. `i` przed samogłoską po spółgłosce nie tworzy sylaby: zmiękcza n s z c dz do ń ś ź ć dź, a inaczej staje się j. `i` przed spółgłoską lub na końcu też zmiękcza i zostaje samogłoską.
4. `au`, `eu` → a+w, e+w, poza rodzimym przedrostkiem (nauka) i -eum/-eus.
5. Nosówki według następnej głoski: p,b → om/em; t,d,c,dz,cz,dż,k,g → on/en; ć,dź → oń/eń; l,ł → o/e; szczelinowe → nosowa; końcowe ą zostaje, końcowe ę → e.
6. Dźwięczność od prawej: końcowe obstruenty ubezdźwięczniane, zbitki przejmują dźwięczność ostatniego obstruentu, v i rz jej nie wywołują i stają się f i sz po bezdźwięcznej.
7. Ogon od samogłoski N od końca: N=4 dla `(li|ły)by(śmy|ście)$`; N=3 dla `ł[aoy]?by[mś]?$`, `liby$`, `(li|ły)(śmy|ście)$`; inaczej N=2; jednosylabowe od jedynej samogłoski.

Przykłady: państwo→`aństfo`, łóżko→`uško`, kaszka→`aška`, trzy→`y`, twój→`uj`, mąka→`onka`, sąd→`ont`, historii→`orji`, auto→`awto`, nauka→`uka`, miałbym→`awbym`.

Końcowe ę równe e na poziomie dokładnym; końcowe ą odrębne, łączone z o na poziomie Near. `ł[aoy]?by` może trafić w rzadkie przymiotniki (`osłaby`), więc potrzebny tag czasownika.

Wyjątki do tabeli: zapożyczenia `-nia` z /j/ (mania, harmonia), nosówka przed `ch` (węch), `rz` jako r+z (zamarzać, marznąć), angielskie i włoskie pisownie (pizza, boss, podcast), liczebniki -set/-sta/-kroć, spójniki ze -śmy/-ście, `arcy-`, `eks-`, `wice-`.

Akcent **[pomiar]**: w 6940 ze 132 812 słów (5,2%) pada na trzecią lub dalszą sylabę, głównie `-ście` 1474, `-yśmy` 1101, `-łoby` 390, `-tyka` 179. Oksytoniczne: 39. `-yka` zostaje przedostatnie, a porządkuje je głębokość sufiksu (`gramatyka` przed `języka`). Alternatywa odrzucona: jeden klucz przedostatni, który łączy `chodziliśmy` z `czytaliśmy`.

### Pomiary

Zgodność z polem rymu Wiktionary: 99,27% z 132 812 słów, częściowo kolista, bo oba zbiory to reguły. Dane: [kaikki, wydanie angielskie](https://kaikki.org/dictionary/Polish/kaikki.org-dictionary-Polish.jsonl.gz).

1825 par z ksiąg 1–5 [Pana Tadeusza](https://www.gutenberg.org/cache/epub/31536/pg31536.txt), parzyste akapity, é→e:

| Poziom | Pary | Narastająco | Przykład |
| --- | --- | --- | --- |
| Dokładny ogon | 1524 | 83,5% | |
| i=y, końcowe ą=o | 120 | 90,1% | miny/przyczyny |
| Samogłoski, spółgłoski według klasy | 16 | 91,0% | ręce/młodzieńce |
| Ostatnia sylaba | 56 | 94,0% | nóżki/pończoszki |
| Ostatnia sylaba, i=y, ą=o | 5 | 94,3% | |
| Brak | 104 | 100% | dalej/poufali |

Klasy: zwarte, szczelinowe, zwarto-szczelinowe, nosowe, płynne, półsamogłoski, ciągi łączone. Mierzą kompletność, nie to, co autor przyjąłby jako rym. Test na jednym poemacie z 1834 r.

Skala na `sjp-odm` (4,2 mln form): 61 308 kluczy dokładnych, 20 242 bliskich, 1308 ostatniej sylaby, 271 asonansu. Końcówki: `emu` 163 650, `ego` 163 580, `ymi` 143 957, `ami` 138 711 form. Klucz `e` rozchodzi się na 3983 klucze i 15 188 słów (23,6 ms wobec 0,6–3,7 ms przy zamkniętych). Pełny import kluczy ok. 25 s. Pokrycie partnerów z Pana Tadeusza: wszystkie formy 89,8%, tylko wordfreq 82,2%, limit 300 na klucz 81,4%.

Przykłady: `woda` → szkoda, młoda, pogoda; `kot` → od, pod, kod, lot, a ostatnia sylaba: samolot, przedmiot, pilot; `miłość` → zawiłość, a ostatnia sylaba: większość, dość, możliwość, wolność, gość; `kota` → robota, idiota, złota, sobota; `krew` → szef, drew, wbrew, gniew; `wiatr` → teatr, kadr; `marzenie` → 16 508 rymów, prawie same gramatyczne; `serce`, `księżyc`, `słońce`: prawie brak.

### Listy częstości

|  | FrequencyWords `pl_50k` | wordfreq `large_pl` |
| --- | --- | --- |
| Słowa | 50 tys. | 453 320 |
| Źródła | OpenSubtitles | Wikipedia, napisy, news, OSCAR, Twitter, Reddit |
| Rozmiar | 676 kB | 2,4 MB gzip |
| Ranking form | maks. ok. 1,2% z 4,2 mln | 309 029 form sjp, ok. 7,4% |
| Świeżość | 2018 | do ok. 2021 |
| Szum | obce słowa, mowa | 135 600 pozycji spoza sjp (`the`, `xd`, `moze`), `not` i `hot` zawyżone |

Adresy: [FrequencyWords](https://github.com/hermitdave/FrequencyWords), [wordfreq](https://github.com/rspeer/wordfreq), [NKJPNGrams](https://zil.ipipan.waw.pl/NKJPNGrams). Inne: Leipzig (CC BY 4.0), SUBTLEX-PL (licencja nieznana).

### Poza zakresem

Rymy wielowyrazowe (`na stół`–`chwastu`). LLM do wyboru z listy kandydatów lub propozycji wielowyrazowych: opcjonalnie później, zawsze z weryfikacją przez klucze. Asonans ma 271 kluczy i wyniki bliskie losowym (backlog).

## Kryteria akceptacji

1. Znane pary rymują się na oczekiwanym poziomie (kota/złota, miny/przyczyny, nóżki/pończoszki).
2. Na 1825 parach z ksiąg 1–5 Pana Tadeusza pokrycie na poziomach nie spada poniżej pomiarów z researchu (83,5%, 91,0%, 94,3%), przy czym wynik sprawdza się po wyborze tabeli form.
3. Formy tego samego lematu i pary typu pisanie/napisanie nie pojawiają się w wynikach.
4. Końcówka otwarta nie daje wyników typu `nie się że ale`.
5. Gerundia nie wypełniają listy dla słowa `kochanie`.
6. Forma odmieniona rymuje się jako wpisana, bez zamiany na lemat.
7. Brak wyników daje komunikat, a blok „Sources” podaje dane i licencje.
8. Bez zmiennych serwera narzędzi (D56) kafelek jest widoczny, a szukanie daje komunikat o niedostępności narzędzia.

## Testy

Unit: transkrypcja, klucze, poziomy, ranking, końcówki otwarte. Integracyjne: akcja z atrapą serwisu i bez zmiennych serwera narzędzi. E2E: szukanie i „Show more”. `manual`: pomiar na Panu Tadeuszu i ocena jakości na współczesnym tekście.
