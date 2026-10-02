# Roomwise

Photograph a room and get a calmer layout. Roomwise analyses a photo of your room, then suggests
a furniture arrangement based on **ergonomic** or **feng shui** principles, shown as a top-down
floor plan with a plain-language reason for every move.

> Status: in development (semester project). See [ROADMAP.md](ROADMAP.md) for the plan.

## How it works

```
 Photo ──► Supabase Storage ──► Edge Function ──► Vision model ──► room JSON
                                                                      │
                                    strict validation (src/domain/validate.ts)
                                                                      │
                          Rules engine + solver (src/domain, pure TypeScript, unit-tested)
                                                                      │
                                      Suggested layout + explanations ──► Floor plan (SVG)
```

Two deliberate layers:

1. **Perception (AI):** a vision model turns the photo into structured JSON (room size, doors,
   windows, furniture). Its output is treated as untrusted and validated before use.
2. **Rules engine (our code):** deterministic rules score a layout, and a solver searches for a
   better one. It is explainable, testable and works offline. See [docs/RULES.md](docs/RULES.md).

## Tech stack

| Layer   | Choice                                                        |
| ------- | ------------------------------------------------------------- |
| App     | React Native + Expo (TypeScript, strict), Expo Router         |
| Drawing | react-native-svg                                              |
| Backend | Supabase: Postgres, Auth, Storage, Edge Functions (Deno)      |
| AI      | Anthropic Messages API, called only from the Edge Function    |
| Quality | ESLint, Prettier, Jest, GitHub Actions CI, Row Level Security |

## Getting started

Prerequisites: Node 20+, a free [Supabase](https://supabase.com) project, an Anthropic API key,
and the Expo Go app on your phone.

```bash
npm install
npx expo install --fix        # aligns Expo package versions with your SDK
cp .env.example .env          # then fill in your Supabase URL and anon key
npx expo start                # scan the QR code with Expo Go
```

Backend setup (once):

```bash
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push                                   # applies supabase/migrations
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # server-side only
supabase functions deploy analyze-room
```

In the Supabase dashboard, under Authentication, turn off "Confirm email" while developing.

## Scripts

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm test`          | Unit tests for the domain layer |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | TypeScript strict check         |
| `npm run format`    | Prettier                        |

## Project structure

```
app/                  Screens (Expo Router): rooms list, capture, room detail, settings, sign-in
src/domain/           Pure logic: types, geometry, rules, solver, AI-output validation (+ tests)
src/components/       FloorPlan (SVG) and small UI primitives
src/lib/              Supabase client, API layer, auth
src/theme/            Colours, spacing, typography
supabase/migrations/  Database schema + Row Level Security
supabase/functions/   analyze-room Edge Function
```

## Security notes

- The AI API key exists only as a Supabase secret; the app never sees it.
- Every table has Row Level Security; storage is a private bucket scoped per user folder.
- The Edge Function runs queries as the calling user and rate-limits analyses per hour.
- Model output is validated and clamped before it reaches any logic or UI.

## Limitations

Geometry from a single photo is approximate. The app says so and lets users enter the real room
size. Suggestions are general guidelines, not professional design advice.
