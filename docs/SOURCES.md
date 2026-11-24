# Sources

Literature and documentation used for the Roomwise report (chapter IX). Every link below was
opened or found through a web search on 2026-11-24.

## Scientific papers

1. Merrell, P., Schkufza, E., Li, Z., Agrawala, M., Koltun, V. (2011). _Interactive Furniture
   Layout Using Interior Design Guidelines._ ACM Transactions on Graphics (Proc. SIGGRAPH 2011).
   Project page: https://graphics.stanford.edu/projects/furniture/
   Used for: encoding design guidelines (clearance, alignment, conversation areas) as scored
   rules, the same idea as our rules engine in `src/domain/rules`.
2. Yu, L.-F., Yeung, S.-K., Tang, C.-K., Terzopoulos, D., Chan, T. F., Osher, S. J. (2011).
   _Make it home: automatic optimization of furniture arrangement._ ACM Transactions on
   Graphics 30(4) (SIGGRAPH 2011). Listed at: https://www.scilit.net/publications/8a10658446ebfed2bfe26849b6ad54f6
   Used for: optimising an arrangement by minimising a cost built from ergonomic and
   functional constraints, comparable to our solver's score and move cost.
3. Liu, F. T., Ting, K. M., Zhou, Z.-H. (2008). _Isolation Forest._ Proceedings of the 8th IEEE
   International Conference on Data Mining (ICDM 2008), pp. 413-422.
   DOI: 10.1109/ICDM.2008.17
   Used for: the anomaly-detection demo on exported rooms (IsolationForest).

## Documentation

4. Supabase. _Row Level Security._ https://supabase.com/docs/guides/database/row-level-security
   Used for: per-user data isolation (`supabase/migrations`, `supabase/tests/rls_check.sql`).
5. Anthropic. _Vision._ https://platform.claude.com/docs/en/build-with-claude/vision
   Used for: sending room photos to the model in the `analyze-room` Edge Function.
6. scikit-learn. _IsolationForest._
   https://scikit-learn.org/stable/modules/generated/sklearn.ensemble.IsolationForest.html
   Used for: the anomaly finder notebook.
7. Expo. _Introduction to Expo Router._ https://docs.expo.dev/router/introduction/
   Used for: file-based navigation in `app/`.

## Not yet covered

No ergonomics standard or building-code document is cited. The numbers in `docs/RULES.md`
(90 cm door clearance, 60 cm beside the bed, TV distance 1.8-3.5 m) are our own project
assumptions, not taken from a standard. If a standard is added later, cite it here.
