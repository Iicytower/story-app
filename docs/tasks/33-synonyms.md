# 33 – Synonimy

Wynik researchu. Kafelek „Synonyms” w Tools.

## Zakres

- **Najpierw dodatkowy research** źródeł, wskazany przez użytkownika, z wnioskiem do akceptacji przed importem.
- Import wybranych źródeł do osobnych tabel.
- Widok: wyniki pogrupowane według znaczeń, z etykietą rejestru i źródłem, duplikaty scalone przy odpowiedzi.

## Do decyzji przy implementacji

Tezaurus (zapisane oba źródła):

- **LibreOffice** `th_pl_PL_v2.dat`: LGPL 2.1, 27 060 haseł, zamrożony od 2017 r.
- **Dobry słownik 0.8.76** `pl-dict-latest.oxt`: LGPL 2.1 w `.oxt`, GPL 2+ w `.txt.gz`, 30 941 haseł, wydania kwartalne. Odczyt licencji per pakiet jest wywnioskowany, kontakt: redakcja@dobryslownik.pl.

Słowosieć: czy w ogóle, czy coś innego, a jeśli tak, to która wersja:

- **4.2**: gotowy loader `plwordnet`, notka licencyjna wymienia tę wersję.
- **4.5**: ostatnie otwarte wydanie, schemat niesprawdzony, pobranie niepotwierdzone.
- **5.0**: dostęp po wniosku, warunki nieznane.
- Sygnały licencyjne są sprzeczne: rozstrzyga LICENSE w paczce. Średnio 1,29 jednostki na synset, więc potrzebny wybór relacji.

Wikisłownik zostaje jako źródło (decyzja użytkownika): 38 979 haseł z synonimami, CC BY-SA 4.0, wymaga czyszczenia etykiet.

Przy realizacji dopisać do `decisions.md` wnioski z researchu i wybrane źródła.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Tezaurus

- Pakiet [`pl-dict-latest.oxt`](https://pobierz.dobryslownik.pl/pl-dict-latest.oxt) (2 429 517 bajtów): `th_pl_PL_v2.dat` 3,2 MB i `.idx`. Tekst: [`thesaurus.txt-latest.gz`](https://pobierz.dobryslownik.pl/thesaurus.txt-latest.gz) (2,9 MB, `hasło;syn1;(rejestr) syn2`). Wydania: 1 stycznia, kwietnia, lipca, października.
- Dobry słownik 0.8.76 **[pomiar]**: 30 941 haseł, 41 217 znaczeń, 204 920 synonimów, 29 565 wielowyrazowych. LibreOffice 2017: 27 060, 34 774, 195 654, plik 2,68 MB, [repo](https://github.com/LibreOffice/dictionaries/tree/master/pl_PL), generacja 2017-05-07.
- Format MyThes: `hasło|liczba_znaczeń`, potem `-|syn1|syn2|…`. Hasła w formie podstawowej, bez części mowy i opisów znaczeń, więc pierwsze słowa wiersza służą jako podpowiedź znaczenia.
- Etykiety rejestru: potocznie 9599, książkowo 3645, bardzo potocznie 940, rzadziej 687, specjalistycznie 685, ekspresywnie 683, eufemistycznie 545, przestarzale 329, pogardliwie 262, żartobliwie 252.
- Copyright: 2004–2014 Marcin Miłkowski, 2014–2026 Dobry słownik, zachować oba. Strona stawia „LGPL” przed pakietami OpenOffice/LibreOffice i „GPL” przed tekstowym i KWord; wprost nie napisano, że te same dane są pod LGPL. Regulamin nie obejmuje plików i nie pozwala skrapować strony.
- Jakość: `hejt` jest, `smartfon` nie, `piękny` obejmuje `prawy`, `śmiertelny` obejmuje `przemijający`. W 2017 brak `westchnąć`, `uśmiechnąć się`; nowej wersji nie sprawdzono.
- Próbka 2017: kot → mruczek, dachowiec, sierściuch; szept → szmer, mamrotanie; smutny → markotny, ponury, posępny.

### Wikisłownik

Plik [`kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz`](https://kaikki.org/plwiktionary/raw-wiktextract-data.jsonl.gz), filtr `lang_code == "pl"` (domyślny „Polish” na kaikki ma angielskie definicje). **[pomiar]** 38 979 haseł z synonimami (ok. 31%), 111 415 synonimów. Synonimy mają `sense_index`, a wpisy część mowy i definicje, np. `zamek`: warownia, twierdza, forteca przy 1.1. Etykiety wyciekają (`gw. (Śląsk Cieszyński) dóm`). Atrybucja: link do hasła, CC BY-SA 4.0.

### Słowosieć

- Wersje: 5.0 aktualna, ok. 196 tys. lematów i 297 tys. znaczeń, zrzuty [po wniosku](https://slowosiec.pl/en/experts). 4.5: 2021-07-23, [`wordnet_work_4_5.zip`](https://clarin-pl.eu/dspace/handle/11321/834?show=full), 444 MB, zrzut bazy, pobranie niepotwierdzone. 4.2: `plwordnet_4_2_CLARIN_BIZ_START_with_PWN3.1.zip`, [b2find](https://b2find.eudat.eu/dataset/e95079be-9225-5734-9e2c-832a6d6c3a02), hdl 11321/891 [do weryfikacji]. 4.0 i 3.0 też na CLARIN.
- 4.2 (praca z 2025): 194 107 lematów, 294 842 jednostek, 228 308 synsetów, 160 937 definicji, 240 741 przykładów. Starsze liczby z CLARIN i pakietu `plwordnet` są niespójne.
- Loader: [`plwordnet`](https://github.com/maxadamski/plwordnet) (MIT), `plwnxml` dla 2.1–4.2, bez metody synonimów: członkowie synsetu i relacje.
- Licencja ([tekst](https://slowosiec.pl/pl/about#license)): użycie za darmo w dowolnym celu, także komercyjnym, ale notka i zastrzeżenia na wszystkich kopiach, także zmienionych. Notka: „plWordNet 4.2 © 2020 by Wrocław University of Technology. All rights reserved.” Nazwy uczelni nie wolno używać w promocji. Stopka strony mówi CC BY-SA 4.0, ale może dotyczyć tylko strony. Dołączone dane Princeton mogą mieć własną licencję. Projekt prosi o cytowanie Rudnicka, Alberski, Piasecki 2025.
- Ekstrakt niezmierzony. Domeny CLARIN były zablokowane w sesji researchu.

### Inne kandydaty i odrzucone

- OpenThesaurus PL to dziś Dobry słownik; `synonimy.ux.pl` przekierowuje.
- `synonimy.pl`, `synonim.net`, npm `synonyms-pl`: bez licencji na dane, skrapowanie odpada z tych samych powodów co sjp.pl (ustawa o bazach danych).
- LanguageTool nie ma polskich synonimów. ConceptNet nic nie wnosi. AlterVista to dane OpenOffice przez API z kluczem. Lexicala i Zyla: płatne, niezweryfikowane.

### Poza zakresem: zachowanie formy

Odpadło przez „tylko wyszukiwanie”. Jeśli wróci: `domu` → budynku, `ładnego` → pięknego działają przez dopasowanie tagów do paradygmatu z tabeli form. Rzeczowniki: liczba i przypadek; przymiotniki: pełny tag; czasowniki: bez aspektu i zwrotności. `biegnie` → pobiegnie zmienia czas, `poszła` → udała gubi `się`.

## Kryteria akceptacji

1. Wpisane słowo pokazuje synonimy według znaczeń; forma odmieniona pokazuje „shown for: kot” i wyniki dla każdego lematu.
2. Każda pozycja ma etykietę źródła, a rejestr jest widoczny, gdy źródło go podaje.
3. Duplikaty między źródłami są scalone z zachowaniem wszystkich etykiet.
4. Brak wyniku daje komunikat.
5. Blok „Sources” podaje źródła i licencje, ze wszystkimi wymaganymi notkami.
6. Wynik zostaje po przełączeniu zakładki.

## Testy

Unit: parsery źródeł, czyszczenie etykiet, scalanie duplikatów. Integracyjne: akcja z atrapą serwisu. E2E: szukanie, etykiety, brak wyniku. `manual`: jakość na próbce słów z researchu.
