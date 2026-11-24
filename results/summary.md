# Evaluation on synthetic rooms

1000 synthetic rooms, seed 42, both modes (2000 runs). Baseline = layout as generated; Proposed = Roomwise suggestion.
Synthetic data: random placement inside plausible room sizes, NOT real photographed rooms.

## Mode: ergonomic (1000 rooms)

| Metric | Baseline | Proposed |
| --- | --- | --- |
| Mean rule score (0-1) | 0.677 | 0.986 |
| Median rule score | 0.684 | 1.000 |
| Rooms with overlapping furniture | 80.0 % | 1.0 % |
| Rooms with furniture outside the walls | 0.0 % | 0.0 % |
| Rooms with blocked door | 44.9 % | 1.6 % |
| Mean rules scoring below 0.9 per room | 7.36 | 0.51 |

| Solver behaviour | Value |
| --- | --- |
| Rooms where score improved | 99.6 % |
| Rooms where score got worse (should be 0) | 0 |
| Rooms left unchanged | 0.5 % |
| Mean items moved per room | 3.08 |
| Mean total move distance (cm) | 368 |
| Mean solver time (ms) | 6.4 |
| Max solver time (ms) | 46.8 |

## Mode: feng_shui (1000 rooms)

| Metric | Baseline | Proposed |
| --- | --- | --- |
| Mean rule score (0-1) | 0.671 | 0.985 |
| Median rule score | 0.677 | 0.996 |
| Rooms with overlapping furniture | 80.0 % | 1.1 % |
| Rooms with furniture outside the walls | 0.0 % | 0.0 % |
| Rooms with blocked door | 44.9 % | 0.9 % |
| Mean rules scoring below 0.9 per room | 8.42 | 0.91 |

| Solver behaviour | Value |
| --- | --- |
| Rooms where score improved | 99.9 % |
| Rooms where score got worse (should be 0) | 0 |
| Rooms left unchanged | 0.1 % |
| Mean items moved per room | 3.31 |
| Mean total move distance (cm) | 409 |
| Mean solver time (ms) | 6.1 |
| Max solver time (ms) | 30.3 |
