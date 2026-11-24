# Results

How well the app does on real rooms. This page is filled in from testing; numbers are only added
when they have been counted.

## How rooms are scored

For each test room, record:

1. **Detection:** are the furniture types, the walls of doors and windows, and the room size roughly
   right? Mark **usable** (small fixes at most), **needs work** (several wrong items) or **unusable**.
2. **Suggestion:** after correcting the detection, does the suggested layout look sensible, and does
   every move have an understandable reason? Mark **good**, **acceptable** or **bad**.
3. **Notes:** what went wrong, if anything.

Success rate = rooms with a _usable_ detection divided by all rooms tested.

## Test set

| #   | Room                | Photos | Source | Detection     | Suggestion    | Notes                                                                                                                                                                         |
| --- | ------------------- | ------ | ------ | ------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mainroom (4 photos) | 4      | own    | usable        | _to be rated_ | Detection almost perfect with four photos. Earlier suggestions put the TV in front of a window and floated the sofa; fixed with TV-glare, wall-anchoring and side-table rules |
| 2   | Bedroom 2           | _?_    | own    | _to be rated_ | _to be rated_ | Used as a regression case for the solver                                                                                                                                      |
|     |                     |        |        |               |               |                                                                                                                                                                               |

Add one row per room. Photos from friends are welcome with their permission. Use only photos you
or your friends took, or images with a free licence.

## Findings so far

- **More photos help.** With a single photo the model often reported low confidence ("hard to read");
  with four photos of the same room the detection of Mainroom was almost perfect. The app accepts up
  to four photos per room for this reason.
- **Rules had to be tuned on real rooms.** The first versions produced messy layouts (floating sofa,
  TV in front of a window, side table far from the sofa). Each issue became a rule or a solver
  change, with a unit test.

## Furniture detection counts (hand-counted)

Counted by eye on 25 November 2026: real furniture in the room versus items the app detected from
the photos, with no manual corrections. Per-type counts are in `eval/perception_counts.csv`; run
`npm run perception` to reproduce the table below.

| Room     | Real items | Detected | Missed | Extra |
| -------- | ---------- | -------- | ------ | ----- |
| Test     | 8          | 6        | 2      | 0     |
| Toilet   | 6          | 5        | 1      | 0     |
| Kitchen  | 5          | 5        | 0      | 0     |
| Corridor | 2          | 2        | 0      | 0     |
| **All**  | **21**     | **18**   | **3**  | **0** |

| Metric    | Value |
| --------- | ----- |
| Precision | 1.00  |
| Recall    | 0.86  |
| F1        | 0.92  |

All three missed items are wall-mounted shelves or cabinets, or a floor cabinet, grouped as type
`shelf` (recall 0.40 for that type, 1.00 for every other type). Only four rooms and 21 items were
counted, so these numbers are indicative, not statistically reliable.

## Layout quality on synthetic rooms

1000 synthetic rooms (seed 42, random furniture placement) were scored before and after the
suggestion with the same rules. In ergonomic mode the mean rule score went from 0.68 to 0.99,
rooms with overlapping furniture from 80 % to 1 %, and rooms with a blocked door from 45 % to
1.6 %. The suggestion was never worse than the original layout. See `results/summary.md` for both
modes and `npm run evaluate` to reproduce.

## Summary

- Rooms tested for detection: 4 (21 real furniture items)
- Items detected: 18 of 21 (86 %), none invented
- Most common detection mistake: wall-mounted shelves and cabinets are missed
- Suggestion ratings (good, acceptable, bad) per real room: not yet rated
- What would improve results next: more test rooms, rating the suggestions on real rooms, and a
  prompt hint for wall-mounted storage
