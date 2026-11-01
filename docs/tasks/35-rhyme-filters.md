# 35 – Filtry rymów

Decyzja użytkownika (2026-11-01). Uzupełnia task 34.

## Zakres

- Filtr części mowy i liczby sylab w widoku „Rhymes”.
- Kolumny części mowy i liczby sylab w bazie.

## Ustalenia

- Część mowy wynika z tagów tabeli form, więc mapowanie zależy od wyboru z taska 25.

Do decyzji przy starcie taska: lista części mowy w filtrze i czy liczba sylab to zakres, czy jedna wartość.

## Dane z researchu

Stan z 2026-10-31. **[pomiar]** to wynik policzony na pobranym pliku, **[wniosek]** to interpretacja, **[do weryfikacji]** nie potwierdzono u źródła. Uwagi o licencjach to odczyt tekstów, nie porada prawna.

### Dane

- Wzorzec: [Rymer](https://www.rymer.org/4.0.1/) ma filtr części mowy i zakres liczby sylab.
- Tagi w tabeli form: Morfologik `subst:sg:acc:m2+subst:sg:gen:m2`, Polimorf `subst:sg:gen.acc:m2`. Morfologik ma 1336 różnych tagów. Pierwszy segment to część mowy.
- Liczba sylab to liczba samogłosek po transkrypcji z taska 34 (`i` zmiękczające nie tworzy sylaby).
- Oba pola dodają rozmiar do bazy, niezmierzony.

## Kryteria akceptacji

1. Filtr części mowy zawęża wyniki na każdym poziomie.
2. Filtr liczby sylab zawęża wyniki na każdym poziomie.
3. Filtry działają razem i z „Show more”.
4. Filtr bez wyników daje komunikat, a jego wyzwolenie wraca do pełnej listy.

## Testy

Unit: mapowanie tagów, liczenie sylab. Integracyjne: akcja z filtrami i atrapą serwisu. E2E: filtry w widoku.
