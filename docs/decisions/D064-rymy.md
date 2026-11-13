# D64 – Rymy z kluczy fonetycznych tabeli form (2026-11-06)

Status: aktualna.

- Task 34. Kafelek „Rhymes” w Tools. Transkrypcja i klucze według researchu z taska (`lib/tools/rhyme-key.ts`, wspólne dla `dict:build` i aplikacji). Odstępstwa od specyfikacji w tasku:
  - akcent na trzeciej sylabie od końca daje `ł[aoy]by[mś]?$` z obowiązkową samogłoską (`zrobiłbym` → `iwbym`), bo wzorzec z researchu przesuwał akcent także w `-łbym`;
  - `-eusz` (Tadeusz, Mateusza) to dwie sylaby, jak `-eum` i `-eus`;
  - wyjątki ze spisu: zapożyczenia `-nia` z /j/ (mania, harmonia), `rz` jako r+z (zamarzać, marznąć), kilka pisowni obcych (pizza, boss, podcast) i spójniki ze `-śmy`/`-ście` (żebyśmy). Liczebniki `-set`/`-kroć` i przedrostki `arcy-`, `eks-`, `wice-` zostały bez zmian.
- Poziomy: Exact (ogon od akcentowanej samogłoski), Near (i=y, końcowe ą=o, spółgłoski według klasy, ciąg jednej klasy liczony raz) i Last syllable (z i=y i ą=o; przy końcówce otwartej z poprzedzającą spółgłoską, bez niej brak klucza). Słowo jest pokazane tylko na najlepszym poziomie.
- Lista częstości (decyzja użytkownika po próbie na tych samych słowach): **wordfreq `large_pl` 3.2** (CC BY-SA 4.0, © 2022 Robyn Speer; dane z Wikipedii, OpenSubtitles 2018, wiadomości, stron WWW, Twittera i Reddita). Ma częstość 306 tys. form tabeli, a FrequencyWords `pl_50k` tylko 43 tys. i ranking bliższy mowie z napisów. Plik jest przypięty do wydania sumą SHA-256 i dekodowany własnym dekoderem MessagePack (bez pakietu). Kolumna częstości czyni bazę rymów utworem share-alike: blok „Sources” podaje wordfreq z licencją i źródłami danych oraz notę, że zbudowana z nimi baza jest na CC BY-SA 4.0. `meta` bazy ma tę licencję.
- Baza: osobny plik `rhymes.sqlite` (ok. 660 MB, ok. 2 min budowy). Pisowniom bez znaków diakrytycznych, które wordfreq liczy jako częste, a PoliMorf ma tylko jako rzadkie słowa („sie”, „cie”, „juz”…), baza zeruje częstość, żeby nie wychodziły jako częste rymy. Rozmiar zaakceptował użytkownik zamiast przycinania nazw własnych lub gerundiów. Zawiera wszystkie formy z małej litery (także z q, v, x). Są w niej też nazwy własne z PoliMorfu (decyzja użytkownika), o ile to samo słowo nie występuje małą literą („Kot” obok „kot”). Częstość nazwy to częstość słowa małą literą, bo wordfreq ma tylko takie. Kolumny `form`, `phones`, `exact`, `near`, `last`, `freq` (Zipf × 100), `lemmas` (id lematów z tabeli form, z której zbudowano bazę: `meta` podaje jej datę), `flags`. Indeksy `(klucz, freq DESC)` na każdy poziom i na `form`; wiersze w kolejności odwróconej transkrypcji, więc wiersze jednego klucza leżą obok siebie. Zapytanie trwa poniżej 1 ms na poziom.
- Serwis: `POST /rhymes {forms, keys}` zwraca wiersze pisowni słowa i najwyżej 150 najczęstszych wierszy każdego poziomu. Pisownia z tabeli przynosi własne klucze (akcent według tagów `cond`/`praet`). Klucze z aplikacji (słowo spoza tabeli liczone jak czasownik) są tylko zapasem i serwis sprawdza ich znaki. Bez pliku 503 daje tylko ta trasa. Słowo bez samogłoski nie wysyła zapytania.
- Ranking w aplikacji (`rankRhymes`):
  - odrzuca samo słowo, formy jego lematów i słowa, z których jedno jest drugim z przedrostkiem słowotwórczym, także po „nie” (pisanie/napisanie, lot/przelot). Inny początek zostawia słowo (ma → mama, zima; kot → szkot; lot → samolot): sam sufiks w pisowni zerował wyniki krótkich słów (decyzja użytkownika);
  - porządkuje według najdłuższego wspólnego zakończenia transkrypcji, potem częstości;
  - pokazuje najwyżej 2 formy na lemat w całym wyniku;
  - widoczne są częste słowa (Zipf ≥ 2,5), najwyżej 40 na poziom; „Show more” dokłada do 100 rzadkich i obniżonych.
- Obniżane (do „Show more”):
  - słowa funkcyjne: forma z odczytem spójnika lub zaimka osobowego albo tylko z odczytami partykuły, przyimka lub wykrzyknika, plus krótka lista zaimkowych przysłówków (tak, tam, teraz…); „bomba” czy „koło” zostają;
  - formy z samymi odczytami gerundium lub imiesłowu;
  - rym gramatyczny: kandydat z odczytem odczasownikowym, gdy wpisane słowo też go ma, a wspólne zakończenie nie wychodzi poza klucz (kochanie → pytanie, zadanie w „Show more”, a panie, ścianie i przesłuchanie widoczne).
- Pomiar na Panu Tadeuszu (księgi 1–5, akapity wierszy o parzystej liczbie linii, kolejne linie w parach, é→e): 1687 par, mniej niż 1825 w researchu, bo inna ekstrakcja. Pokrycie z kluczami z bazy: 86,5% / 94,3% / 97,0% (próg: 83,5 / 91,0 / 94,3). Partnerów rymów w tabeli: 93,1%.
- Rymy wielowyrazowe, asonans i filtry (task 35, D65) poza zakresem.
