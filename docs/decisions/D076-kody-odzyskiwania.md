# D76 – Kody odzyskiwania konta (2026-11-10)

Status: aktualna.

- Task 63, decyzje użytkownika. 10 kodów w formacie `XXXX-XXXX-XXXX` z alfabetu base32 Crockforda (bez I, L, O, U; ok. 60 bitów na kod). W bazie (`User.recoveryCodes: { hash, usedAt }[]`) tylko HMAC-SHA-256 z kluczem wyprowadzonym z `AUTH_SECRET`; jawnych kodów nigdzie nie ma. Zmiana `AUTH_SECRET` unieważnia wszystkie kody. Przy wpisywaniu wielkość liter, spacje i myślniki nie mają znaczenia, a O, I i L czytane są jako 0 i 1.
- Kody dostaje się tylko przy rejestracji: okno pokazuje je raz i nie daje się zamknąć, dopóki użytkownik nie zaznaczy „Mam zapisane te kody”. Konta sprzed taska nie mają kodów i nie ma migracji (brak pola = brak kodów). W ustawieniach nie ma regeneracji.
- „Nie pamiętasz hasła?” w oknie logowania: nick, kod, nowe hasło (pełna walidacja `passwordError` z nickiem, D75). Udany reset ustawia hasło, unieważnia użyty kod i zastępuje cały zestaw 10 nowymi kodami, które pokazuje raz (tak jak po rejestracji). Kończy wszystkie sesje konta (D75) i loguje na tym urządzeniu. Kod jest jednorazowy także przy równoległych żądaniach (warunek w filtrze aktualizacji). Pole `usedAt` zostaje na przyszłe 2FA.
- Ochrona: stały czas odpowiedzi 1,5 s (jak logowanie). Błędny kod, użyty kod, nieistniejący nick i konto bez kodów dają ten sam komunikat. Limity: 5 błędnych prób na godzinę na nick (także nieistniejący) i 20 na 15 min z adresu (D74). Udany reset oddaje próby.
