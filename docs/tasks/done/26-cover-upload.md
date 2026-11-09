# 26 – Upload okładek

Subtask zbiorczego taska [66](../66-covers-and-adult-rating.md) (branch, kolejność, środowisko lokalne).

Zgłoszenie użytkownika (2026-10-30), wydzielone z dawnego taska „Okładki”. Upload okładki folderu, pliki w osobnej kolekcji MongoDB (zmiana 2026-11-09, wcześniej Cloudflare R2). Wyświetlanie: task 40. Okładki rozdziałów i obrazki w tekście są poza zakresem (backlog).

## Zakres

- Dodanie, wymiana i usunięcie okładki folderu (na razie tylko folderu, decyzja użytkownika 2026-11-09).
- Skalowanie i kompresja obrazka w przeglądarce przed wysłaniem; plik trafia do Server Action (limit żądania 4,5 MB na Vercel Hobby), która sprawdza bajty i zapisuje okładkę.
- Serwowanie przez Route Handler (poza `[locale]`, jak eksport) z długim cache (`immutable`); identyfikator w adresie zmienia się przy każdej wymianie okładki.
- Automatyczny filtr 18+ okładek (zgłoszenie użytkownika 2026-11-08, research w sekcji „Dane z researchu”): okładka nie jest serwowana, dopóki serwer jej nie oceni (przepływ i usługa klasyfikatora w sekcji „Przepływ i usługa klasyfikatora”).
- Okładka oceniona jako 18+ automatycznie oznacza folder jako 18+ przez wspólny system oznaczeń z taska [65](65-adult-rating.md): właściciel nie może zdjąć tego oznaczenia, dopóki nie usunie albo nie wymieni okładki. W wynikach wyszukiwania okładka 18+ jest ukryta za znaczkiem 18+. Właściciel może też sam oznaczyć okładkę jako 18+ (bez blokady folderu).
- Twardy limit łącznego rozmiaru okładek (decyzja użytkownika 2026-11-09), bo zapełnienie M0 zablokowałoby zapis opowiadań.
- Zmiana kopii przed migracją (D14): przed migracją backup poza Atlasem (forma, sposób i miejsce: do decyzji użytkownika), usunięcie kopii sprzed poprzedniej migracji, nowa kopia, migracja. Zostaje jedna kopia zamiast trzech.

## Ustalenia

Analiza 2026-11-09 (R2, pliki na Mikrusie, MongoDB na Mikrusie, cała baza na Mikrusie, Atlas): wybrany Atlas M0, bo bez nowego magazynu, backupu i punktu awarii, a pojemność na start wystarcza.

- Okładki w osobnej kolekcji (np. `covers`: obrazek jako `Buffer`, typ, rozmiar, stan, wyniki filtra) z odniesieniem do folderu. Kopie przed migracją pomijają tę kolekcję, a wersje rozdziałów nie kopiują okładek (decyzje użytkownika).
- Staging nie dostaje żadnych danych z produkcji, więc okładki zajmują miejsce w klastrze tylko raz (produkcja i staging dzielą klaster M0, `docs/deploy.md`).
- Pojemność: (512 MB − ok. 50 MB zapasu − dane bez okładek z jedną kopią obu baz) / rozmiar okładki. Przy 100 KB na okładkę i 50 MB tekstu na bazę to ok. 2600 okładek. Przy starcie taska zmierzyć rzeczywisty rozmiar danych (`db.stats()` albo Atlas → Collections) i z tego ustawić limit.
- Gdy limit zacznie przeszkadzać: przeniesienie okładek na pliki na Mikrusie (serwis za bramką z `X-Tools-Secret`, serwowanie przez Vercel z cache). Cała baza na Mikrusie odrzucona na razie (opóźnienie Vercel → Finlandia, jeden serwer bez SLA, przepisanie warstwy danych przy wariancie z NestJS).
- Użytkownik nie ma własnej domeny.

Decyzje użytkownika (2026-11-09):

- Okładka nie jest częścią wersji folderów (D25), jak notatki.
- Soft delete folderu od razu usuwa jego okładkę (przywrócony folder wraca bez niej).
- Eksport: okładka w zipie folderu (`cover.webp`, D18, import ją wczytuje) oraz jako strona tytułowa w `.epub`, `.docx` i `.pdf`. Do sprawdzenia przy starcie: czy biblioteki eksportu przyjmują WebP, czy trzeba konwertować do JPEG/PNG.
- Format: WebP 2:3, 600×900, kadrowanie w przeglądarce; wejście JPEG, PNG lub WebP do 10 MB.
- Limity: 10 okładek na konto i globalny limit łącznego rozmiaru; po przekroczeniu komunikat, wymiana istniejącej okładki dalej działa.
- Klasyfikator: tylko własny model ONNX w kontenerze stosu narzędzi (lokalnie Docker z taska 54, na produkcji Mikrus z taska 28), bez OpenAI i innych zewnętrznych API. Bez `TOOLS_API_URL` upload okładek jest wyłączony (jak narzędzia, D56), więc na stagingu i produkcji okładki działają dopiero po tasku 28.
- Dwa progi: zwykła / 18+, bez odrzucania. Bez OpenAI nie ma sygnału samookaleczeń, a bez progu odrzucenia każda treść zostaje zapisana (ryzyko CSAM z „Dane z researchu” zostaje do rozwiązania razem z moderacją, task 53).
- Fałszywy alarm: bez odwołania; właściciel usuwa lub wymienia okładkę, a komunikat wyjaśnia blokadę. Odwołania razem z moderacją (task 53).

**Do decyzji użytkownika** (zapytać przed implementacją; wynik jako nowa decyzja w `decisions.md`):

- Wartość globalnego limitu: po pomiarze danych w Atlasie. Pomiar robi użytkownik (Claude nie ma dostępu do produkcyjnej bazy): Atlas → Database → Browse Collections, Storage Size baz `story-app` i `story-app-staging`.
- Backup przed migracją: forma, sposób i miejsce (np. `scripts/backup.sh`, D26) oraz czy obejmuje okładki.
- Model: OwenElliott sam czy z Marqo jako drugą opinią; progi z próbki 50–100 okładek.
- Brak werdyktu: zapis ze stanem `pending` i ponowienie czy brak zapisu i komunikat (krok 5 przepływu).
- Model w usłudze: pobierany przy starcie i sprawdzany SHA-256 czy wgrywany jak bazy słownikowe; ponowne kodowanie obrazu w usłudze (Pillow) czy w aplikacji (nowy pakiet npm).

## Kryteria akceptacji

1. Właściciel może dodać, wymienić i usunąć okładkę folderu.
2. Zapisywany jest tylko obrazek po przeskalowaniu, a plik o złym typie lub zbyt duży daje komunikat.
3. Wymiana i usunięcie okładki usuwają stary obrazek z kolekcji.
4. Okładkę zapisuje i usuwa tylko właściciel; cudzy folder daje `NOT_FOUND`.
5. Błąd uploadu daje komunikat i zostawia poprzednią okładkę.
6. Zmiana okładki nie zmienia `updatedAt` folderu ani jego rozdziałów (jak D11).
7. Okładka nie jest serwowana, dopóki serwer jej nie oceni; przy niedostępnym klasyfikatorze nowa okładka nie jest widoczna (fail-closed), a poprzednia zostaje.
8. Okładka oceniona jako 18+ oznacza folder jako 18+ (task 65), właściciel nie może zdjąć tego oznaczenia, a po usunięciu lub wymianie okładki na zwykłą blokada znika. W wynikach wyszukiwania pokazuje się znaczek 18+ zamiast okładki.
9. Właściciel może ręcznie oznaczyć okładkę jako 18+; to nie blokuje oznaczenia folderu.
10. Po osiągnięciu limitu na konto lub globalnego nowa okładka daje komunikat i nie zostaje zapisana, a wymiana istniejącej działa.
11. Bez `TOOLS_API_URL` upload okładek jest niedostępny.
12. Eksport `.zip` zawiera `cover.webp`, import go wczytuje, a `.epub`, `.docx` i `.pdf` mają okładkę jako stronę tytułową.
13. Kopia przed migracją pomija kolekcję okładek i zostaje tylko jedna kopia; migracja startuje dopiero po udanym backupie.

## Testy

Unit: walidacja typu i rozmiaru, skalowanie, werdykt z wyniku klasyfikatora (próg 18+, brak odpowiedzi), limity. Integracyjne: akcje okładek, własność, usuwanie starego obrazka, werdykt i brak werdyktu (fail-closed), automatyczne 18+ i blokada, limit, Route Handler (cudza i `pending` okładka niedostępne, nagłówki cache), kopie migracji bez `covers` i tylko jedna, okładka w eksporcie i imporcie, brak `TOOLS_API_URL` (klasyfikator zastąpiony atrapą, bez wywołań sieciowych). E2E: dodanie, wymiana i usunięcie okładki, znaczek 18+ w wyszukiwarce, zablokowany przełącznik 18+ folderu, ręczne oznaczenie. `manual`: prawdziwy upload na stagingu, klasyfikacja na próbce okładek.

## Przepływ i usługa klasyfikatora

Propozycja Claude zgodna z decyzjami z 2026-11-09, nie zatwierdzona przez użytkownika. Punkty oznaczone **do decyzji użytkownika** wymagają pytania przed implementacją; reszta to domyślne rozwiązanie, które też warto pokazać użytkownikowi na starcie.

### Przepływ uploadu

1. Przeglądarka: kadrowanie 2:3, skalowanie do 600×900 i kodowanie do WebP (canvas usuwa też EXIF/GPS).
2. Server Action `setFolderCover(folderId, FormData)`: sesja, własność folderu, limity (10 na konto, globalny), typ i rozmiar bajtów (nagłówek pliku, nie deklarowany typ). Bajty z klienta są niezaufane.
3. Ta sama akcja wysyła bajty do klasyfikatora (`POST {TOOLS_API_URL}/classify`, timeout kilka sekund) i dostaje wyniki oraz obraz ponownie zakodowany po stronie serwera (patrz niżej).
4. Jest werdykt: zapis w `covers` (obraz od klasyfikatora, wyniki, wersja modelu, `adult`, `userId`, data), podmiana odniesienia w folderze, usunięcie starej okładki; przy `adult` automatyczne 18+ folderu z blokadą (task 65). Wszystko po udanym zapisie nowej okładki, więc błąd zostawia poprzednią.
5. Brak werdyktu (klasyfikator niedostępny, timeout, błąd): okładka nie jest serwowana (fail-closed). **Do decyzji użytkownika:** zapis ze stanem `pending` i ponowienie (np. przy następnym wejściu właściciela na stronę folderu albo przyciskiem), czy brak zapisu i komunikat „spróbuj później”. Prostsza jest druga opcja, bo nie ma kolejki ani stanu do sprzątania.
6. Route Handler `GET /covers/<id>` (poza `[locale]`): tylko okładki z werdyktem; adres z nowym `id` przy każdej wymianie, `Cache-Control: public, max-age=31536000, immutable`. Okładka 18+ jest serwowana tylko tam, gdzie task 65 i 40 na to pozwalają.

### Usługa `classifier` w `docker/tools/compose.yml`

- Nowa usługa obok `languagetool` i `dictionary`, za bramką: `handle_path /classify* { reverse_proxy classifier:8000 }` w Caddyfile z `compose.yml`, więc obowiązuje `X-Tools-Secret` jak dla reszty. Kod inline w `compose.yml` (jak `dictionary`), bo Coolify wdraża jeden plik.
- Python + `onnxruntime` (CPU) + Pillow, bez PyTorcha. Model [OwenElliott/image-safety-classifier-s](https://huggingface.co/OwenElliott/image-safety-classifier-s) (ONNX 23,7 MB, MIT) pobierany przy pierwszym starcie do wolumenu i sprawdzany sumą SHA-256 (jak źródła słowników), albo wgrywany jak bazy słownikowe – **do decyzji użytkownika**.
- Kontrakt: `POST /classify`, treść to surowe bajty obrazka (`Content-Type: image/webp`, limit np. 1 MB). Usługa dekoduje obraz Pillow (odrzuca nie-obrazy i bomby dekompresyjne przez limit pikseli), koduje go ponownie do WebP 600×900 bez metadanych, liczy wyniki na wejściu 224×224 i zwraca JSON, np. `{ "model": "owenelliott-s@<sha>", "scores": { "sfw": 0.97, "nsfw": 0.02, "nsfl": 0.01 }, "image": "<base64 WebP>" }`. Próg 18+ (`nsfw` lub `nsfl` powyżej wartości z próbki) liczy aplikacja, nie usługa, żeby zmiana progu nie wymagała wdrożenia.
- Ponowne kodowanie w usłudze, bo tak nie trzeba nowego pakietu npm (np. `sharp`) w aplikacji. **Do decyzji użytkownika** (alternatywa: `sharp` w aplikacji, wymaga zgody na pakiet), razem z wyborem Marqo jako drugiej opinii.
- `mem_limit` po pomiarze (szac. 150–400 MB). Testy aplikacji używają atrapy klasyfikatora, bez sieci.
- Lokalnie działa w stosie z `npm run up` (task 66), na Mikrusie trafia z taskiem 28 bez zmian.

## Dane z researchu

Research 2026-11-08, skrócony 2026-11-09 do części, które zostają po decyzjach (kolekcja MongoDB zamiast R2, tylko własny model ONNX bez zewnętrznych API, dwa progi). Odrzucone: R2 i podpisane adresy, OpenAI moderation, Azure, Sightengine, Workers AI, Google Vision i AWS (koszt lub dane poza serwerem), linki do obrazków z zewnątrz (SSRF, podmiana po moderacji). Liczby „szac.” to szacunki, nic nie mierzone na Mikrusie.

### Modele

| Model | RAM / czas (szac.) | Kategorie | Jakość | Licencja | Uwagi |
| --- | --- | --- | --- | --- | --- |
| **OwenElliott xs/s** (ONNX) | 100–300 MB, dziesiątki ms; 13,1 / 23,7 MB | NSFW, NSFL (gore), SFW | 97,8–98% na danych autora; gore „bardzo niedoreprezentowane”; trening z rysunkami i AI | MIT | wybrany; brak niezależnej ewaluacji, normalizacja w grafie, wejście 224×224 |
| Marqo 384 (ViT-tiny) | 150–300 MB po eksporcie do ONNX | nagość/seks | 98,56% na własnym zbiorze; rysunki, AI | Apache-2.0 | opcjonalnie druga opinia; ręczny eksport ONNX |
| NudeNet 320n (YOLOv8n) | 12,2 MB, 100–300 ms | części ciała | wykrywa anatomię, nie intencję | AGPL (wagi Ultralytics) | odpada: licencja, bez opiekuna od 2024 |
| Falconsai / AdamCodd (ViT-base) | 250–400 MB int8 | nagość/seks | Falconsai wykrywa 31% „low” NSFW; AdamCodd: dekolt = NSFW | Apache-2.0 | odpada: pominięcia albo dużo fałszywych alarmów |
| CLIP zero-shot (LAION, Q16) | 350–900 MB | dowolne przez prompty | brak benchmarków dla narkotyków, symboli | MIT / brak | ewentualny eksperyment po zebraniu próbki |
| Małe VLM, LlavaGuard, ShieldGemma 2, Llama Guard | 0,4–7+ GB | szerokie | brak wyników moderacji albo licencja (Llama: UE) | różne | odpada: RAM, licencja, prompt injection tekstem z okładki |
| nsfwjs w przeglądarce | 2,6–3,5 MB + tfjs | Drawing, Hentai, Neutral, Porn, Sexy; brak gore | ~90–93% wg README | MIT | tylko podpowiedź w UX („rozważ oznaczenie 18+”), do obejścia |

- **Luka:** narkotyków, symboli nienawiści i samookaleczeń nie wykrywa żaden wybrany model. Pokrywa je ręczne oznaczanie i (później) zgłoszenia z taska 53.
- **Fałszywe alarmy:** werdykt tylko ukrywa i oznacza, więc próg może być czulszy. Restrykcyjne modele oznaczą typowe okładki romansów, sygnał gore może oznaczać stylizowany horror. Próg ustawić na własnej próbce 50–100 okładek, nie na liczbach z kart modeli.

### CSAM

- Darmowy [CSAM Scanning Tool Cloudflare](https://developers.cloudflare.com/cache/reference/csam-scanning/) (od 2025 bez poświadczeń NCMEC) działa dla strefy (domeny) i skanuje cache; bez własnej domeny jest niedostępny. Skanuje po fakcie, nie przy uploadzie.
- [PhotoDNA Cloud Service](https://www.microsoft.com/en-us/photodna/cloudservice): darmowy dla „qualified organizations” po weryfikacji, kryteria niepublikowane. Thorn Safer ~50 000 USD/rok. Listy hashy (NCMEC, Lantern, ThreatExchange) tylko dla zakwalifikowanych. Otwarty PDQ bez listy przyda się tylko do blokady obrazów już raz usuniętych.
- Prawo: art. 18 DSA (zgłaszanie organom podejrzeń przestępstw zagrażających życiu lub bezpieczeństwu) obowiązuje od 2024-02-17 niezależnie od wielkości dostawcy. Polski punkt zgłoszeń: Dyżurnet.pl (NASK). Czy art. 240 k.k. obejmuje art. 202, źródła nie rozstrzygają. Rozporządzenie 2021/1232 (przedłużone do 2028-04-03) dotyczy komunikacji interpersonalnej, najpewniej nie tej aplikacji (wniosek, nie porada prawna).
- Minimum z researchu: próg odrzucenia wyraźnych treści seksualnych (odrzucony 2026-11-09, dwa progi), zabezpieczanie dowodów zamiast ślepego usuwania, logowanie `userId` uploadującego, procedura zgłoszeń. Bez progu odrzucenia zostaje do rozwiązania z moderacją (task 53); w tym tasku co najmniej `userId` i data uploadu przy okładce.

### Do zmierzenia i sprawdzenia przed implementacją

1. RSS i czas OwenElliott xs/s (i Marqo po eksporcie) w kontenerze; na Mikrusie liczba vCPU i AVX2 (task 28).
2. Fałszywe alarmy na próbce 50–100 okładek (romans, horror, anime, rysunki anatomiczne, dużo tekstu) i ustawienie progu.
3. Czy biblioteki eksportu (`.epub`, `.docx`, `.pdf`) przyjmują WebP.
4. Rozmiar danych w Atlasie (produkcja i staging) do limitu globalnego.
5. DSA: art. 6, 8, 16 i wyłączenia dla mikroprzedsiębiorstw, polska ustawa wdrażająca (treść regulaminu i procedury zgłoszeń).
6. Kryteria PhotoDNA dla osoby fizycznej lub JDG spoza USA.

### Źródła (dostęp 2026-11-08)

- Modele: [OwenElliott](https://huggingface.co/OwenElliott/image-safety-classifier-s) (2026-03), [Marqo](https://huggingface.co/Marqo/nsfw-image-detection-384) (2024-11), [NudeNet](https://github.com/notAI-tech/NudeNet) (2024-07), [Falconsai](https://huggingface.co/Falconsai/nsfw_image_detection) (2026-09), [AdamCodd](https://huggingface.co/AdamCodd/vit-base-nsfw-detector) (2024-12), [Freepik benchmark](https://huggingface.co/Freepik/nsfw_image_detector) (2025-05), [LAION CLIP](https://github.com/LAION-AI/CLIP-based-NSFW-Detector) (2023), [nsfwjs](https://github.com/infinitered/nsfwjs) (4.4.0, 2026-08), [ShieldGemma 2](https://huggingface.co/google/shieldgemma-2-4b-it) (2025-04), [Llama Guard 3 Vision](https://huggingface.co/meta-llama/Llama-Guard-3-11B-Vision), [Meta Llama FAQ](https://www.llama.com/faq/), [LlavaGuard 0.5B](https://huggingface.co/AIML-TUDA/LlavaGuard-v1.2-0.5B-OV-hf), [typographic injection](https://arxiv.org/html/2604.12371v2) (2026-04).
- Infrastruktura: [Vercel limits](https://vercel.com/docs/functions/limitations) (2026-08).
- CSAM i prawo: [Cloudflare CSAM tool](https://blog.cloudflare.com/a-simpler-path-to-a-safer-internet-an-update-to-our-csam-scanning-tool/) (2025-09), [PhotoDNA](https://www.microsoft.com/en-us/photodna/cloudservice), [Vendr: Thorn](https://vendr.com/marketplace/thorn), [Lantern](https://technologycoalition.org/wp-content/uploads/2025/06/Lantern-Transparency-Report-2024.pdf), [ThreatExchange](https://developers.facebook.com/docs/threat-exchange/getting-started), [BKA DSA FAQ](https://bka.de/EN/OurTasks/Remit/CentralAgency/DigitalServicesAct/FAQS/FAQS_node.html), [Dyżurnet.pl](https://inhope.org/EN/articles/news-from-dyzurnet-pl), [RPO art. 240 k.k.](https://sprawy-generalne.brpo.gov.pl/pdf//2018/3/II.501.1.2018/1289418.pdf), [2021/1232 do 2028](https://cadeproject.org/updates/eu-extends-interim-rules-for-voluntary-detection-of-online-child-sexual-abuse-material-until-2028/) (2026-07).
