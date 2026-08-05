# Evaluation case collection schema

**Status:** Process only — does not block Phase 1–2 manual MVP  
**Owner labels:** Daniel  
**Storage later:** `eval_cases` / `eval_runs` tables (Phase 1+ schema); fixtures under `src/test/fixtures/evals/` (fabricated only)

## Case fields

| Field | Type | Notes |
| --- | --- | --- |
| eval_case_id | string | Stable slug, e.g. `pos-extract-001` |
| use_case | enum | `position_extract`, `jd_standardize`, `sourcing_query`, `candidate_grade`, `email_actionable`, `email_reply`, `handbook_diff`, `nl_search_plan`, other |
| classification | enum | `internal`, `confidential`, `highly_restricted` |
| input_fixture_ref | string | Path to fabricated/anonymized fixture |
| expected_output_json | object | Gold structured output |
| must_cite_evidence | boolean | If true, unsupported claims fail the case |
| pass_threshold_notes | string | Human-readable pass criteria |
| daniel_label_status | enum | `needed`, `labeled`, `retired` |
| enabled_for_offline_eval | boolean | Default false until labeled |
| notes | string | |

## Promotion rule

A use-case feature flag may move from staging suggestion-mode to Daniel-only production only after:

1. Agreed metric thresholds are written here or in the Phase completion package.
2. Labeled cases exist for that use_case (count agreed with Daniel).
3. Offline eval run is recorded with prompt/schema/model versions.

## Immediate Phase 0/1 action

Create empty fixture folders and this schema documentation. Do not invent gold labels.
