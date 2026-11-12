# D54 – Strona główna z hero i ostatnio opublikowanymi (2026-11-04)

Status: aktualna. Zmienia D38, D42, D46.

- Zmienia D38, D42 i D46 (task 49). `/` zostaje jedną stroną dla gościa i zalogowanego, wyszukiwarka zostaje na `/`. Gość widzi hero (nagłówek, opis, „Create account” i „Log in”), potem wyszukiwarkę i „Recently published”; zalogowany to samo bez hero, z sidebarem. Sidebar traci pozycję Search, zostaje Home (decyzje użytkownika).
- Dialog logowania z D42 bez zmian; przycisk w prawym górnym rogu i CTA hero otwierają ten sam dialog, CTA w trybie rejestracji albo logowania.
- „Recently published”: rozdziały widoczne publicznie (warunki jak w wyszukiwarce), sortowane po `publishedAt` malejąco, remis `_id` malejąco. Serwer pobiera 15, klient pokazuje 5 i dokłada po 5. Lista nie zużywa `SEARCH_LIMIT`. Data względna do 7 dni, starsza jako data w języku interfejsu, liczona na serwerze w UTC.
- Nowe pole `stories.publishedAt`: moment pierwszej publikacji rozdziału, ustawiany raz i nigdy nie zmieniany ani nie usuwany (decyzja użytkownika 2026-11-04, zastępuje wcześniejsze „każda publikacja od nowa, ukrycie robi `$unset`”). Dostaje go rozdział, który staje się publiczny i jeszcze go nie ma (Publish folderu, Publish all, Publish rozdziału; `stampPublishedAt` w `lib/publish/mutations.ts`). Unpublish, przeniesienie i przywrócenie z wersji go nie ruszają; o obecności na liście decydują warunki widoczności. Zapisy z `timestamps: false`: edytor wysyła `updatedAt` jako wersję oczekiwaną, więc zmiana publikacji nie może go zmieniać (decyzja użytkownika).
- Rozdział bez `publishedAt` nie trafia na listę. Powtarzalna migracja `006-published-at` daje widocznym rozdziałom bez pola datę uruchomienia (także tym opublikowanym przez starą wersję w trakcie builda). Indeks `{ publication: 1, publishedAt: -1 }`.
- Link Home w sidebarze ma `prefetch={false}`: render `/` czyta listy publiczne, a prefetch z każdej strony (także edytora) robiłby to przy każdym wejściu; jego spóźniona odpowiedź psuła też zaznaczenie w testach E2E edytora.
- Tytuł strony głównej „Story App – write and publish stories” z opisem z hero. U gościa `h1` to nagłówek hero, u zalogowanego „Search stories”.
- Odstępstwo od „tylko desktop” (D46): strona główna jest dopracowana pod wąski ekran (od 375 px); reszta aplikacji w tasku 51 (decyzja użytkownika).
