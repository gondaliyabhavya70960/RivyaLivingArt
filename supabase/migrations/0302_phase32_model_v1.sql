-- ============================================================================================
-- 0302 — Phase 32: the first scoring model, v1, seeded as a DRAFT
--
-- CONFIGURATION, NOT CONTENT. The seven signals and their weights are the phase document's table,
-- transcribed. It ships DRAFT because activation is a human act: it requires `research.score.manage`,
-- shows the rank-movement diff first, and is audited. A model nobody activated ranks nothing.
--
-- THE WEIGHTS ARE A JUDGEMENT AND ARE WRITTEN DOWN AS ONE. In particular the `large_format_fit`
-- signal's false-column ladder (furniture that is NOT large-format scores 50) is the phase
-- document's own reading of SEED §56, recorded in `lib/scraper/analytics/opportunity/signals/
-- large-format-fit.ts` beside the number. Changing any of it means publishing v2.
--
-- The normalisation rules themselves live in code, one module per signal; this document carries
-- the key, the weight and a description of the rule so a reader of the row knows what it does.
-- `lib/scraper/analytics/opportunity/model.ts` asserts on read that every key names a signal
-- module and that the weights sum to 100.
-- ============================================================================================

set search_path = public, extensions;

-- check-migrations: allow-insert (the first scoring model, seeded DRAFT as configuration — a model nobody activated ranks nothing, and activation is a human, audited act)
insert into research_scoring_models (version, name, description, signals, weights_total, min_confidence, lifecycle)
values (
  'v1',
  'Seven declared signals',
  'The phase document''s table, transcribed. Weighted mean of the included signals, confidence = share of weight included, completeness multiplier 0.6 + 0.4 × completeness.',
  '[
    {"key": "category_gap",         "weight": 20, "direction": "HIGHER_IS_BETTER", "normalisation": "published Rivya products in the mapped category: 0 → 100, ≥ 12 → 0, linear between", "minimumCoverage": "none — a first-party count is always knowable"},
    {"key": "large_format_fit",     "weight": 20, "direction": "HIGHER_IS_BETTER", "normalisation": "SEED §56 ladder over (category, is_large_format); large → 100; the false column per category; unknown → excluded", "minimumCoverage": "is_large_format is not null and matched_category_id is not null"},
    {"key": "price_band_gap",       "weight": 15, "direction": "HIGHER_IS_BETTER", "normalisation": "the row''s Phase 31 band vs bands occupied by published Rivya products in the same currency: unoccupied → 100, adjacent → 50, occupied → 0", "minimumCoverage": "price_state in (FIXED, STARTING_FROM) and ≥ 5 published Rivya products priced in that currency"},
    {"key": "assortment_density",   "weight": 15, "direction": "HIGHER_IS_BETTER", "normalisation": "distinct sources listing something in the same category and band: 1 → 30, 2 → 60, ≥ 3 → 100", "minimumCoverage": "≥ 3 enabled sources"},
    {"key": "change_velocity",      "weight": 10, "direction": "HIGHER_IS_BETTER", "normalisation": "MATERIAL changes in the category in the last 90 days: 0 → 0, ≥ 10 → 100, linear between", "minimumCoverage": "≥ 30 days of run history for the source"},
    {"key": "customisation_signal", "weight": 10, "direction": "HIGHER_IS_BETTER", "normalisation": "the customization key in the current version''s normalised payload: true → 100, false → 0", "minimumCoverage": "the source''s attribute_extraction declares a customization key and the version carries it"},
    {"key": "material_adjacency",   "weight": 10, "direction": "HIGHER_IS_BETTER", "normalisation": "share of the row''s material tokens found in the materials vocabulary × 100, compared in application code", "minimumCoverage": "material_tokens is non-empty"}
  ]'::jsonb,
  100,
  0.50,
  'DRAFT'
);
