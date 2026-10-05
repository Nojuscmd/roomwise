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

## Summary (fill in at the end)

- Rooms tested: _
- Usable detections: _ of _ (_ %)
- Suggestions rated good or acceptable: _ of _
- Most common detection mistakes: _
- Most common suggestion problems: _
- What would improve results next: _
