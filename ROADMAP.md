# Roadmap: Oct 5 to Dec 19

This is your path from this scaffold to a finished, demo-ready app. Work top to bottom. Each week
ends with a "Done when" check, so you always know whether you are on track.

## Where things stand (Oct 5)

Ahead of schedule: the app runs end to end on a real phone.

| Piece                                     | State                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Rules engine, solver, AI-output validator | **Working.** 79 unit tests. Rules include glare, TV glare, side tables, wall anchoring.               |
| Database, Row Level Security, storage     | **Running** on Supabase (migrations 0001 and 0002: several photos per room).                          |
| `analyze-room` Edge Function              | **Deployed.** Analyses one to four photos of a room together.                                         |
| App: capture, analysis, plan, suggestions | **Working** on iPhone. Photo gallery, saved arrangements, correction screen (Week 4 is already done). |
| Correction screen                         | Move, turn, resize, add and delete items; door and window editing; furniture cannot be stacked.       |
| CI (GitHub Actions)                       | **Green** on every push.                                                                              |

Still open: RLS check with a second account, `docs/` write-ups (architecture, results, security),
units preference, empty and error states, furniture icons and L-shaped sofa, a test set of rooms with
scores, a demo video, a friends-testing link (EAS Update), and the `v1.0.0` tag.

What only you can do: photograph real rooms, test on your phone, ask friends to test, and talk to
your professor about the AI-assistance note in the README.

---

## Week 1 (Oct 5): Get it running

1. Unzip the project. In a terminal inside it:
   ```bash
   git init -b main
   npm install
   npx expo install --fix
   ```
2. On GitHub, create an empty repo named `roomwise` (no README), then:
   ```bash
   git add . && git commit -m "chore: initial scaffold"
   git remote add origin https://github.com/<you>/roomwise.git
   git push -u origin main
   ```
   Then in repo Settings, add a branch protection rule on `main` requiring the CI check to pass.
3. Create a free project at supabase.com. Copy the Project URL and anon key into `.env`
   (see `.env.example`). Run the backend setup commands from the README.
4. Turn off "Confirm email" in Supabase (Authentication, Providers, Email) while developing.
5. Run `npx expo start`, scan the QR code with Expo Go, create an account, add a room.

**From now on, work in branches** (`feat/capture-flow`, `fix/door-zone`), open a pull request
into `main` and merge when CI is green, even though you are solo. Use short imperative commit
messages ("Add door clearance rule").

**Done when:** you can sign up on your phone, the CI badge is green, and `npm test` passes locally.

## Week 2 (Oct 12): Prove the AI part works

This is the biggest risk in the whole project, so test it before polishing anything.

1. Photograph 10 to 15 different rooms (bedrooms, living rooms, a messy one, a dark one). Stand in a
   corner and capture as much of the room as possible. Put them in `./test-photos/`.
2. Run: `ANTHROPIC_API_KEY=sk-ant-... npm run analysis:test -- ./test-photos`
3. Open `analysis-output/*.json` next to each photo. Check: are furniture types right? Are the
   room size and positions roughly sane? Are doors and windows on the right walls?
4. Edit the prompt in `supabase/functions/analyze-room/prompt.ts`, re-run, compare. Typical fixes:
   add an example, tighten the wall-orientation instructions, tell it to ignore small objects.
5. Note your success rate (for example "11/14 usable"). It goes in your final report.

**Done when:** at least 70% of photos give a plausible layout. If not, the answer is the manual
room-size input plus the edit screen from Week 4, not a different architecture.

## Week 3 (Oct 19): Capture to storage, end to end

- Deploy the Edge Function (`supabase functions deploy analyze-room`), then take a photo in the app
  and watch it analyse. Fix whatever breaks (this is the first real test of `src/lib/api.ts`).
- Check Row Level Security by hand: create a second account and confirm it cannot see the first
  account's rooms or photos. Write what you did in `docs/SECURITY.md`.
- Handle failure cases you actually hit: no network, a non-room photo, permission denied.

**Done when:** photo, upload, analysis and saved result work from your phone with two accounts.

## Week 4 (Oct 26): Fix wrong detections

The AI will sometimes be wrong. A good app lets the user correct it.

- Build `app/room/[id]/edit.tsx`: list the detected items, with buttons to nudge position by
  10 cm, rotate (change `facing`), delete, and add an item from a type picker. Save the edited
  layout into `analysis_json`. (Ask me and I will write this with you.)
- Add a warning banner when confidence is low (already in the room screen).

**Done when:** you can fix a wrong detection in under 30 seconds and the suggestions update.

## Week 5 (Nov 2): Harden the rules

- Take your Week 2 photos' analysis JSON and run them through the solver (the test script prints
  the before/after score). Look at the suggested layouts: do they make sense to a human?
- Fix the cases that look silly by adjusting rules or weights in `src/domain/rules/`. Add a unit
  test for each fix. This is where the project stops being a toy.
- Add 2 or 3 rules you care about (for example, nightstand beside the bed, desk not facing a wall
  closer than 60 cm). See "Adding a rule" in `docs/RULES.md`.

**Done when:** 80% of your test rooms get a layout you would genuinely accept.

## Week 6 (Nov 9): Floor plan polish

- Run it on your phone and look hard at the floor plan. Adjust labels, colours, door arcs,
  arrow styling in `src/components/FloorPlan.tsx`.
- Add a tap on an item to highlight its reason card. Add a before/after toggle if the two
  stacked plans feel long.

**Done when:** the floor plan looks like something you would put in a portfolio.

## Week 7 (Nov 16): Settings, history, units

- Wire the units preference (metric/imperial) into labels and the input fields.
- Make saved arrangements tappable so they reopen as a floor plan (the data is already saved in
  `arrangements.layout_json`).

**Done when:** every table in the database is used by a real feature.

## Week 8 (Nov 23): Quality pass

- Empty, loading and error states on every screen. Accessibility labels (most are in).
- Test on a real Android and iOS device if you can borrow one. Check small screens.
- Raise test coverage on `src/lib/api.ts` by mocking Supabase (optional but impressive).

**Done when:** you can use the app for 10 minutes without hitting an unexplained state.

## Week 9 (Nov 30): Feature freeze on Dec 1

After Dec 1 only fix bugs. Anything unfinished is cut, in this order:

1. Feng shui `balance` rule and units preference
2. Saved-arrangements reopening
3. The edit screen's "add item" button

Never cut: tests, CI, README, the security notes, polish.

## Week 10 (Dec 7): Documentation and demo prep

- README: add screenshots and an architecture diagram (I can draw this for you).
- Write `docs/ARCHITECTURE.md`: the two-layer design, why the AI is not trusted, data model.
- Write `docs/RESULTS.md`: your Week 2 success rate and Week 5 acceptance rate, with 3 example
  before/after floor plans. Honest numbers beat inflated ones.
- Record a 60 to 90 second screen recording of the full flow on your phone.

## Week 11 (Dec 14): Buffer

Do nothing new. Re-run the app from a fresh clone (`git clone`, `npm install`, `.env`, `expo start`)
to prove the README works. Tag the release: `git tag v1.0.0 && git push --tags`.
If you are behind, this is your catch-up week.

---

## Rules of thumb

- **Stuck for more than 45 minutes? Ask me**, pasting the exact error text. Do not stay stuck.
- **Commit at least every working session.** A green `main` is always demo-ready.
- **Do not spend time on 3D, AR or custom ML.** They are the usual way this kind of project fails.
- Never commit `.env` or an API key. If you do by accident, rotate the key immediately.
- Keep a short `docs/DEVLOG.md`, one line per session. It is great material for your report.

## Pre-submission checklist

- [ ] `main` builds green in CI (format, lint, typecheck, tests)
- [ ] Fresh clone follows README to a running app
- [ ] No secrets in git history (`git log -p | grep -i "sk-ant"` returns nothing)
- [ ] RLS verified with two accounts
- [ ] Screenshots + demo video in `docs/`
- [ ] Known limitations written down honestly
