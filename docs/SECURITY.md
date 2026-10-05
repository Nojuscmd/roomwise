# Security

How Roomwise keeps one user's data away from another, what was tested, and what is still open.

## Threat model

Roomwise stores private photos of people's homes, so the main risk is one user reading or changing
another user's rooms, photos or saved layouts. The second risk is cost: the AI call costs money, so
the analysis endpoint must not be open to the whole internet.

## Protections

| Area          | Protection                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tables        | Row Level Security (RLS) is enabled on `rooms`, `arrangements` and `preferences`. Every policy checks `user_id = auth.uid()`.                                    |
| Arrangements  | Inserting an arrangement also requires that the room belongs to the caller (`exists (...)` in the policy).                                                       |
| Photos        | Private storage bucket `room-photos`. Policies allow read, insert and delete only inside the caller's own folder (`<user_id>/...`). Only JPEG and PNG, max 8 MB. |
| AI key        | The Anthropic key exists only as a Supabase secret. The app never sees it. The Edge Function calls the API.                                                      |
| Edge Function | Requires a valid user JWT. It reads the room and photos with a client bound to that JWT, so RLS applies there too.                                               |
| Rate limit    | Max 10 analyses per user per hour (`MAX_ANALYSES_PER_HOUR`).                                                                                                     |
| AI output     | Treated as untrusted. It is validated and clamped (`src/domain/validate.ts`) before anything uses it.                                                            |
| Client key    | The app only contains the Supabase publishable (anon) key, which is designed to be public. Access is controlled by RLS.                                          |
| Repository    | `.env` is git-ignored. The two public Supabase values used by the web build are stored as GitHub Actions secrets.                                                |

## Test: RLS with two accounts

Script: [`supabase/tests/rls_check.sql`](../supabase/tests/rls_check.sql). It runs in the Supabase SQL
Editor, acts as user A and then as user B (by setting the JWT claims and the `authenticated` role),
and cleans up after itself.

**Run on 5 October 2026, result:**

```
PASS - A can read own room
PASS - B cannot read A's room
PASS - B cannot update A's room
PASS - B cannot delete A's room
PASS - B cannot insert a room as A
PASS - B cannot attach an arrangement to A's room
PASS - B sees no rooms of others
PASS - B sees no arrangements of others
PASS - B sees no preferences of others
PASS - B sees no photos of others
```

Re-run this script after every change to a policy or migration.

## Known limitations

- **Open sign-up.** Anyone with the web link can create an account (email confirmation is off while
  testing). The per-user rate limit does not stop someone creating many accounts. Before a wider
  release: turn email confirmation back on, and set a spending limit on the Anthropic account.
- **Photos leave the project.** To analyse a room, its photos are sent to the Anthropic API. This
  should be stated to users before wider use.
- **CORS is open** (`Access-Control-Allow-Origin: *`) on the Edge Function. This is acceptable
  because every call still needs a valid user token, but it could be restricted to the site's
  address.
- **No account deletion screen yet.** Deleting a room removes its photos and arrangements;
  deleting a whole account has to be done in the Supabase dashboard.
- **The test covers the database and storage rules, not the Edge Function.** The function uses the
  caller's token, so it inherits the same rules, but this has not been tested separately.
