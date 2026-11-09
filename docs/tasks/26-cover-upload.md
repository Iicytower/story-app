# 26 – Upload okładek

Zgłoszenie użytkownika (2026-10-30), wydzielone z dawnego taska „Okładki”. Upload okładki do rozdziału lub folderu, pliki w Cloudflare R2. Wyświetlanie: task 40. Obrazki w tekście są poza zakresem (backlog).

## Zakres

- Dodanie, wymiana i usunięcie okładki rozdziału oraz folderu.
- Skalowanie i kompresja obrazka w przeglądarce przed wysłaniem.
- Upload bezpośrednio z przeglądarki do R2 przez krótko ważny podpisany adres wydawany przez Server Action.
- Automatyczny filtr 18+ okładek (zgłoszenie użytkownika 2026-11-08, research w sekcji „Dane z researchu”): okładka trafia najpierw do prywatnego bucketu `pending`, publiczna staje się dopiero po ocenie serwera.
- Okładka oceniona jako 18+ automatycznie oznacza rozdział (lub folder) jako 18+ przez wspólny system oznaczeń z taska [65](65-adult-rating.md): właściciel nie może zdjąć tego oznaczenia, dopóki nie usunie albo nie wymieni okładki. W wynikach wyszukiwania okładka 18+ jest ukryta za znaczkiem 18+. Właściciel może też sam oznaczyć okładkę jako 18+ (bez blokady rozdziału).

## Ustalenia

- Storage: Cloudflare R2, bo Vercel jest na planie free (decyzja użytkownika).
- W bazie tylko ścieżka pliku (np. `covers/<id>.webp`), adres to `IMAGES_BASE_URL` + ścieżka. Zmiana serwera to skopiowanie plików z tymi samymi ścieżkami i zmiana tej wartości, bez migracji danych.
- Nazwę pliku generuje aplikacja. Nowa okładka to nowy plik, a stary jest usuwany.
- Klucze R2 tylko na serwerze. Osobne buckety dla produkcji i stagingu, jak osobne bazy (D13).
- Użytkownik nie ma własnej domeny.

Do decyzji przy starcie taska (wynik jako nowa decyzja w `decisions.md`):

- Adres publiczny bez własnej domeny: `r2.dev` (sprawdzić aktualne limity i przeznaczenie), proxy przez aplikację albo zakup domeny.
- Klient S3 (nowy pakiet, wymaga zgody) czy własne podpisywanie.
- Docelowy format, rozmiar, proporcje, kadrowanie oraz maksymalny rozmiar pliku wejściowego.
- Zachowanie plików przy soft delete: usuwać od razu czy dopiero przy trwałym usunięciu.
- Czy okładka jest częścią eksportu (`.epub`, `.docx`, `.pdf`), importu i wersji folderów (D25).
- Backup plików z R2, bo `scripts/backup.sh` obejmuje tylko bazę (D26).
- Ochrona przed podmianą cudzego pliku i przed wskazaniem ścieżki spoza `covers/`.
- Filtr 18+ (szczegóły w „Dane z researchu”):
  - Klasyfikator: rekomendacja to ONNX na Mikrusie + OpenAI moderation; wariant bez Mikrusa: OpenAI + Azure F0. Task 28 (Mikrus) jest w kolejce za taskiem 26, więc do ustalenia, czy 26 czeka na Mikrusa, czy klasyfikator na start działa lokalnie w Dockerze (jak serwer narzędzi z taska 54).
  - Przepływ: presigned PUT do bucketu `pending` + `finalizeCover` albo plik przez Server Action (limit 4,5 MB na Vercel Hobby).
  - Trzy progi: zwykła / 18+ / odrzucenie bardzo wyraźnych treści seksualnych (ograniczenie ryzyka CSAM). Dla avatarów odrzucenie wszystkiego, co nie jest SFW.
  - Ścieżka odwołania od fałszywego alarmu (właściciel nie może zdjąć automatycznego 18+ bez usunięcia okładki, task 65).
  - Własna domena: rozwiązuje limity `r2.dev` i daje darmowy skaner CSAM Cloudflare, ale łamie zasadę zerowego kosztu.

## Kryteria akceptacji

1. Właściciel może dodać, wymienić i usunąć okładkę rozdziału i folderu.
2. Do R2 trafia tylko obrazek po przeskalowaniu, a plik o złym typie lub zbyt duży daje komunikat.
3. Wymiana i usunięcie okładki usuwają stary plik z R2.
4. Baza trzyma tylko ścieżkę, a zmiana `IMAGES_BASE_URL` zmienia adresy wszystkich okładek.
5. Podpisany adres wydaje tylko właściciel; cudzy rozdział lub folder daje `NOT_FOUND`, a klucze R2 nie trafiają do klienta.
6. Błąd uploadu daje komunikat i zostawia poprzednią okładkę.
7. Zmiana okładki nie zmienia `updatedAt` rozdziału (jak D11), więc otwarty edytor nie dostaje `CONFLICT`.
8. Okładka nie jest publicznie dostępna, dopóki serwer jej nie oceni; przy niedostępnym klasyfikatorze zostaje `pending` i niewidoczna (fail-closed), a poprzednia okładka zostaje.
9. Okładka oceniona jako 18+ oznacza rozdział (lub folder) jako 18+ (task 65), właściciel nie może zdjąć tego oznaczenia, a po usunięciu lub wymianie okładki na zwykłą blokada znika. W wynikach wyszukiwania pokazuje się znaczek 18+ zamiast okładki.
10. Właściciel może ręcznie oznaczyć okładkę jako 18+; to nie blokuje oznaczenia rozdziału.
11. Okładka powyżej progu odrzucenia daje komunikat i nie zostaje zapisana (jeśli decyzja przy starcie wprowadzi ten próg).

## Testy

Unit: składanie adresu, walidacja typu i rozmiaru, skalowanie, werdykt z wyników klasyfikatorów (progi, brak jednego źródła, brak obu). Integracyjne: akcje okładek, własność, usuwanie starego pliku, `pending` → `approved`, automatyczne 18+ i blokada, migracja (R2 i klasyfikatory zastąpione atrapą, bez wywołań sieciowych). E2E: dodanie, wymiana i usunięcie okładki, znaczek 18+ w wyszukiwarce, zablokowany przełącznik 18+ rozdziału, ręczne oznaczenie. `manual`: prawdziwy upload na stagingu, klasyfikacja na próbce okładek.

## Dane z researchu

Research 2026-11-08 (wynik: rekomendacja poniżej; nic nie mierzone na Mikrusie, liczby oznaczone „szac.” to szacunki). Twarde ograniczenie użytkownika: zero dodatkowych kosztów, darmowe limity tylko bez ryzyka rachunku.

### Rekomendacja

- **Główna opcja:** kontener na Mikrusie (Coolify, obok serwera narzędzi) z `onnxruntime` bez PyTorcha i modelem [OwenElliott/image-safety-classifier-s](https://huggingface.co/OwenElliott/image-safety-classifier-s) (MIT, 2026-03, klasy NSFW / NSFL (gore) / SFW, ONNX 23,7 MB z normalizacją w grafie, wejście 224×224). Endpoint `/classify` za bramką z `X-Tools-Secret`, pobiera obrazek z podpisanego GET. Szac. 150–400 MB RAM, dziesiątki ms na obrazek. Opcjonalnie w tym samym kontenerze [Marqo/nsfw-image-detection-384](https://huggingface.co/Marqo/nsfw-image-detection-384) (Apache-2.0, 22,4 MB, trzeba samemu wyeksportować do ONNX) jako druga opinia o nagości.
- **Równolegle** darmowe [OpenAI omni-moderation](https://developers.openai.com/api/docs/guides/moderation): dla obrazków tylko `sexual`, `violence`, `violence/graphic` i `self-harm` (3 warianty); jedyny darmowy sygnał samookaleczeń. Klucz z osobnego projektu OpenAI bez kredytów na inne endpointy. Obrazki trafiają do USA (polityka prywatności).
- Okładka dostaje 18+, jeśli którekolwiek źródło przekroczy próg.
- **Fallback:** brak Mikrusa → sam werdykt OpenAI z obniżonymi progami; brak OpenAI → sam ONNX; brak obu → `pending`, ponowienie, po N porażkach ręczny przegląd. **Bez Mikrusa:** OpenAI + [Azure Content Safety F0](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/content-safety/) (5000 obrazków/mies., twarda blokada po limicie, ~1 TPS) albo ONNX w funkcji Vercela (Hobby: 2 GB pamięci, 250 MB paczki; rozmiar `onnxruntime-node` niezmierzony).
- **Luka:** narkotyków i symboli nienawiści nie wykrywa żadna darmowa, wiarygodna opcja (OpenAI ocenia je tylko w tekście, CLIP zero-shot i małe VLM bez benchmarków). Pokrywa je ręczne oznaczanie i (później) zgłoszenia z taska 53. Eksperyment z CLIP zero-shot dopiero po zebraniu próbki testowej.
- **Fałszywe alarmy:** werdykt tylko ukrywa i oznacza, więc progi mogą być czulsze niż przy odrzucaniu. Restrykcyjne modele oznaczą typowe okładki romansów, sygnał gore może oznaczać stylizowany horror. Progi ustawiać na własnej próbce 50–100 okładek, nie na liczbach z kart modeli.

### Porównanie opcji

| Opcja | Koszt | RAM / czas (Mikrus) | Kategorie | Jakość | Licencja | Ryzyka |
| --- | --- | --- | --- | --- | --- | --- |
| **OwenElliott xs/s** (ONNX) | 0 | szac. 100–300 MB, dziesiątki ms; 13,1 / 23,7 MB | nagość/seks, gore | 97,8–98% na danych autora; gore „bardzo niedoreprezentowane”; trening z rysunkami i AI | MIT | brak niezależnej ewaluacji, mało pobrań |
| Marqo 384 (ViT-tiny) | 0 | szac. 150–300 MB po eksporcie do ONNX | nagość/seks | 98,56% na własnym zbiorze; rysunki, AI | Apache-2.0 | ręczny eksport ONNX, 2 klasy |
| NudeNet 320n (YOLOv8n) | 0 | 12,2 MB ONNX, 100–300 ms | części ciała (18 etykiet) | wykrywa anatomię, nie intencję (posągi) | **AGPL w repo, MIT w PyPI, wagi Ultralytics (AGPL)** | konflikt licencji, bez opiekuna od 2024 → odpada |
| Falconsai / AdamCodd (ViT-base) | 0 | szac. 250–400 MB int8; ~2 GB z PyTorchem | nagość/seks | Falconsai wykrywa 31% „low” NSFW; AdamCodd: dekolt = NSFW, 67% poprawnych „neutral” | Apache-2.0 | pominięcia albo dużo fałszywych alarmów |
| CLIP zero-shot (LAION, Q16) | 0 | szac. 350–900 MB | dowolne przez prompty | brak benchmarków dla narkotyków, symboli | MIT (LAION), Q16 bez licencji | słaby recall, progi do strojenia |
| Małe VLM (SmolVLM2 256M/500M, LFM2-VL-450M, InternVL3-1B) | 0 | szac. 0,4–1,5 GB, 2–15 s | dowolne przez prompt | **brak wyników moderacji** | Apache-2.0 (do potwierdzenia per checkpoint), LFM własna | prompt injection tekstem w obrazku (okładki zawsze mają tekst), niedeterministyczne → odpada |
| LlavaGuard 0.5B | 0 | szac. 2–4 GB FP32, brak GGUF | O1–O9 (w tym substancje, samookaleczenia) | brak liczb; 7B słabe w benchmarku Google | **brak licencji** | odpada |
| ShieldGemma 2 (4B) | 0 | szac. 3,3–4 GB → nie mieści się | seks, niebezpieczne, przemoc | F1 88,6 / 93,7 / 85,0 | Gemma ToU | RAM → odpada |
| Llama Guard 3 Vision / 4 | 0 | 7+ GB | S1–S13 | F1 0,733 (prompty) | **licencja wyklucza UE** | odpada |
| **OpenAI omni-moderation** | 0 (darmowy endpoint) | wywołanie z Vercela | sexual, violence, violence/graphic, self-harm | brak danych o ilustracjach | ToS OpenAI | dane w USA; działanie przy zerowym saldzie niepotwierdzone |
| Azure Content Safety F0 | 0, 5000/mies., twarda blokada | — | prawdopodobnie Hate, Sexual, Violence, SelfHarm | brak danych | ToS Azure | ~1 TPS, nie wiadomo, czy wymaga karty |
| Sightengine Free | 0, 2000/mies. (max 500/dzień) | — | do potwierdzenia | brak danych | ToS planu Free nieznane | limit za mały przy górnym wolumenie |
| Cloudflare Workers AI Free | 0, 10 000 neuronów/dzień, twarda blokada | — | VLM z promptem, brak modelu NSFW | brak danych | Llama 3.2 Vision: restrykcja UE | niedeterministyczne, injection |
| Google Vision / AWS Rekognition | 1000/mies., potem płatne | — | szerokie | dobra | ToS chmury | **konto rozliczeniowe = ryzyko rachunku** (budżety tylko alarmują); AWS: nowe konta od 2025-07 plan Free zamykany po 6 mies. → odpada |
| Hugging Face Inference Providers | darmowy kredyt usunięty 2026-10-15 (raporty) | — | — | — | — | odpada |
| Linki do obrazków z zewnątrz | 0 | jak wyżej po pobraniu | hosty nie dają wiarygodnej flagi NSFW (Flickr: ustawia użytkownik) | — | — | podmiana po moderacji, SSRF przy pobieraniu, linki Discorda wygasają po ~24 h, Imgur blokuje UK od 2025-09-30, IP czytelników u obcego hosta (RODO); z kopiowaniem to tylko drugie wejście uploadu → odpada |
| nsfwjs w przeglądarce | 0 | model 2,6–3,5 MB + tfjs | Drawing, Hentai, Neutral, Porn, Sexy; **brak gore** | ~90–93% wg README | MIT, 4.4.0 (2026-08) | do obejścia; tylko podpowiedź w UX, model hostowany samemu |

### Przepływ uploadu

Publiczny dostęp przez `r2.dev` włącza się dla całego bucketu, więc `pending` to **osobny prywatny bucket**, nie prefiks. Presigned PUT działa tylko na endpoincie S3, wymusza `Content-Type`, wymaga CORS; wymuszenie `Content-Length` nieudokumentowane, więc rozmiar sprawdza HEAD.

1. Przeglądarka: skalowanie i kompresja; opcjonalnie nsfwjs jako podpowiedź („rozważ oznaczenie 18+”).
2. `requestCoverUpload`: sesja, własność, presigned PUT na klucz z aplikacji w buckecie `pending`. Stan `pending`, stara okładka bez zmian.
3. Przeglądarka: PUT do `pending`.
4. `finalizeCover`: HEAD (rozmiar, typ), krótko ważny presigned GET, równolegle Mikrus `/classify` i OpenAI (timeout kilka sekund).
5. Ponowne zakodowanie obrazu i usunięcie EXIF/GPS (do ustalenia: sharp na Vercelu czy Pillow na Mikrusie).
6. Jest werdykt: CopyObject do bucketu publicznego, usunięcie z `pending` i starej okładki, zapis wyników, wersji modelu i flagi `adult`; rozdział automatycznie 18+, jeśli `adult`. Brak werdyktu: nic nie jest publikowane, komunikat „okładka w weryfikacji”.
7. Ponowienia: Mikrus jako konsument Cloudflare Queues (powiadomienia R2, HTTP pull spoza Cloudflare; Queues na planie Free od 2026-02-04: 10 000 operacji/dzień, retencja 24 h) albo przy kolejnym wejściu; po N porażkach `review`. Reguła lifecycle usuwa porzucone pliki z `pending` po 1 dniu. `finalizeCover` musi być idempotentne.

Alternatywa: okładka po skalowaniu mieści się w limicie 4,5 MB żądania na Vercel Hobby, więc Server Action może przyjąć plik, sprawdzić bajty, zapisać w `pending` i od razu klasyfikować. Znika CORS i problem `Content-Length`, kosztem transferu przez Vercel.

Niezależnie od filtra: `r2.dev` według Cloudflare jest „rate-limited and should only be used for development purposes”, limity niepublikowane.

### CSAM

- Darmowy [CSAM Scanning Tool Cloudflare](https://developers.cloudflare.com/cache/reference/csam-scanning/) (od 2025 bez poświadczeń NCMEC) działa dla strefy (domeny) i skanuje cache; `r2.dev` nie ma cache, więc bez własnej domeny jest niedostępny. Skanuje po fakcie, nie przy uploadzie.
- [PhotoDNA Cloud Service](https://www.microsoft.com/en-us/photodna/cloudservice): darmowy dla „qualified organizations” po weryfikacji, kryteria niepublikowane. Thorn Safer ~50 000 USD/rok. Listy hashy (NCMEC, Lantern, ThreatExchange) tylko dla zakwalifikowanych. Otwarty PDQ bez listy przyda się tylko do blokady obrazów już raz usuniętych.
- Prawo: art. 18 DSA (zgłaszanie organom podejrzeń przestępstw zagrażających życiu lub bezpieczeństwu) obowiązuje od 2024-02-17 niezależnie od wielkości dostawcy. Polski punkt zgłoszeń: Dyżurnet.pl (NASK). Czy art. 240 k.k. obejmuje art. 202, źródła nie rozstrzygają. Rozporządzenie 2021/1232 (przedłużone do 2028-04-03) dotyczy komunikacji interpersonalnej, najpewniej nie tej aplikacji (wniosek, nie porada prawna).
- Minimum: próg odrzucenia wyraźnych treści seksualnych, zabezpieczanie dowodów zamiast ślepego usuwania, logowanie `userId` uploadującego, procedura zgłoszeń.

### Do zmierzenia i sprawdzenia przed implementacją

1. RSS i czas OwenElliott xs/s (i Marqo po eksporcie) na Mikrusie; liczba vCPU i AVX2/AVX-512.
2. Fałszywe alarmy na próbce 50–100 okładek (romans, horror, anime, rysunki anatomiczne, dużo tekstu); porównanie ONNX z OpenAI; ustawienie progów.
3. OpenAI moderation na koncie z zerowym saldem, retencja danych, jakość na ilustracjach.
4. Azure F0: kategorie obrazków, TPS, czy wymaga karty (tylko wariant bez Mikrusa).
5. Rozmiar `onnxruntime-node` w paczce funkcji Vercela i zimny start (wariant bez Mikrusa).
6. CopyObject między bucketami R2 i koszt operacji klasy A (darmowe: 1 mln A, 10 mln B miesięcznie, 10 GB).
7. Wymuszanie maksymalnego rozmiaru (POST policy `content-length-range`) w R2.
8. Semantyka dostarczania Queues (at-least-once, kolejność) i HTTP pull z Mikrusa.
9. Faktyczne limity `r2.dev`.
10. DSA: art. 6, 8, 16 i wyłączenia dla mikroprzedsiębiorstw, polska ustawa wdrażająca (treść regulaminu i procedury zgłoszeń).
11. Kryteria PhotoDNA dla osoby fizycznej lub JDG spoza USA.

### Źródła (dostęp 2026-11-08)

- Modele: [OwenElliott](https://huggingface.co/OwenElliott/image-safety-classifier-s) (2026-03), [Marqo](https://huggingface.co/Marqo/nsfw-image-detection-384) (2024-11), [NudeNet](https://github.com/notAI-tech/NudeNet) (2024-07), [Falconsai](https://huggingface.co/Falconsai/nsfw_image_detection) (2026-09), [AdamCodd](https://huggingface.co/AdamCodd/vit-base-nsfw-detector) (2024-12), [Freepik benchmark](https://huggingface.co/Freepik/nsfw_image_detector) (2025-05), [LAION CLIP](https://github.com/LAION-AI/CLIP-based-NSFW-Detector) (2023), [nsfwjs](https://github.com/infinitered/nsfwjs) (4.4.0, 2026-08), [ShieldGemma 2](https://huggingface.co/google/shieldgemma-2-4b-it) (2025-04), [Llama Guard 3 Vision](https://huggingface.co/meta-llama/Llama-Guard-3-11B-Vision), [Meta Llama FAQ](https://www.llama.com/faq/), [LlavaGuard 0.5B](https://huggingface.co/AIML-TUDA/LlavaGuard-v1.2-0.5B-OV-hf), [SmolVLM](https://arxiv.org/pdf/2504.05299) (2025-04), [llama.cpp multimodal](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md), [typographic injection](https://arxiv.org/html/2604.12371v2) (2026-04).
- API: [OpenAI moderation](https://developers.openai.com/api/docs/guides/moderation), [Azure](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/content-safety/), [Sightengine](https://sightengine.com/pricing), [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Google Vision](https://cloud.google.com/vision/pricing), [AWS Rekognition](https://aws.amazon.com/rekognition/pricing/), [AWS Free Tier 2025-07](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/), [HF free credits removed](https://www.usagepricing.com/blueprint/activity/hugging-face-2026-10-15-free-inference-credits-removed) (2026-10).
- Infrastruktura: [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [event notifications](https://developers.cloudflare.com/r2/buckets/event-notifications/), [Queues Free](https://developers.cloudflare.com/changelog/2026-02-04-queues-free-plan/) (2026-02), [Vercel limits](https://vercel.com/docs/functions/limitations) (2026-08).
- Linki zewnętrzne: [OWASP SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Imgur blokuje UK](https://www.ispreview.co.uk/index.php/2025/09/popular-image-sharing-site-imgur-com-blocks-access-to-uk-visitors.html) (2025-09), [linki Discorda](https://www.bleepingcomputer.com/news/security/discord-will-switch-to-temporary-file-links-to-block-malware-delivery/), [Flickr content filters](https://www.flickrhelp.com/hc/en-us/articles/4404064206996-Content-filters).
- CSAM i prawo: [Cloudflare CSAM tool](https://blog.cloudflare.com/a-simpler-path-to-a-safer-internet-an-update-to-our-csam-scanning-tool/) (2025-09), [PhotoDNA](https://www.microsoft.com/en-us/photodna/cloudservice), [Vendr: Thorn](https://vendr.com/marketplace/thorn), [Lantern](https://technologycoalition.org/wp-content/uploads/2025/06/Lantern-Transparency-Report-2024.pdf), [ThreatExchange](https://developers.facebook.com/docs/threat-exchange/getting-started), [BKA DSA FAQ](https://bka.de/EN/OurTasks/Remit/CentralAgency/DigitalServicesAct/FAQS/FAQS_node.html), [Dyżurnet.pl](https://inhope.org/EN/articles/news-from-dyzurnet-pl), [RPO art. 240 k.k.](https://sprawy-generalne.brpo.gov.pl/pdf//2018/3/II.501.1.2018/1289418.pdf), [2021/1232 do 2028](https://cadeproject.org/updates/eu-extends-interim-rules-for-voluntary-detection-of-online-child-sexual-abuse-material-until-2028/) (2026-07).
