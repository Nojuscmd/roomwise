# Rules reference

All thresholds are common interior-design rules of thumb, kept as named constants in code so they
are easy to tune. Each rule returns a score from 0 to 1; a layout's score is the weighted average.
Scores of 0.9 or more count as satisfied.

## Applied in both modes

| Rule                 | Weight | Checks                                                           |
| -------------------- | ------ | ---------------------------------------------------------------- |
| `no_overlap`         | 3      | Items stay inside the room and do not overlap each other         |
| `door_clearance`     | 3      | 90 cm in front of each door is free                              |
| `front_clearance`    | 2      | Free space in front of desk (90), wardrobe (80), sofa/shelf (60) |
| `bed_side_clearance` | 2      | At least 60 cm free beside one long side of the bed              |

## Ergonomic mode

| Rule             | Weight | Checks                                                               |
| ---------------- | ------ | -------------------------------------------------------------------- |
| `window_glare`   | 2      | Desk faces sideways to windows, not toward or away from them         |
| `window_blocked` | 1      | Tall furniture (wardrobe, shelf) does not stand in front of a window |
| `tv_viewing`     | 1      | Sofa faces the TV, 1.8 to 3.5 m away                                 |
| `tv_glare`       | 2      | TV not in front of a window and its screen not facing one            |

## Feng shui mode

| Rule               | Weight | Checks                                                                 |
| ------------------ | ------ | ---------------------------------------------------------------------- |
| `bed_headboard`    | 3      | Headboard against a wall, not under a window                           |
| `bed_door_line`    | 3      | Bed feet do not point straight at the door ("coffin position")         |
| `command_position` | 2      | Desk has a solid wall behind it, sees the door, is not in line with it |
| `balance`          | 1      | Furniture mass is distributed evenly around the room centre            |

## Adding a rule

1. Create a `Rule` in `src/domain/rules/` returning `makeResult(...)` objects.
2. Register it in `src/domain/rules/index.ts`.
3. Add tests in `src/domain/__tests__/rules.test.ts`.

The solver picks it up automatically.

## Solver

Items are placed in priority order (bed, wardrobe, desk, sofa, ...). For each item the solver tries
every facing and candidate position (flush against a wall, plus a grid for free-standing items),
discards invalid ones (outside room, overlapping, blocking a door) and keeps the highest-scoring
placement. Two refinement passes then re-optimise each item given the others. It is deterministic,
and takes about 10 ms for a typical bedroom.
