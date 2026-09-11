-- ============================================================================================
-- 0342 — Phase 36: the seven default export definitions
--
-- STRUCTURE, NOT CONTENT. Each row names an entity, its default columns and a destination tab —
-- the shape of an export, the same way 0302 seeded a scoring model nobody had activated. All seven
-- are MANUAL (nothing runs until a person presses Run now or sets a schedule), all seven carry
-- includes_pii = false, and every one of them is inert while the google_sheets flag is off.
-- COMPARISON_SET ships without a scope: a set is chosen by an admin, and the run reports NO_SCOPE
-- until one is.
-- ============================================================================================

set search_path = public, extensions;

-- check-migrations: allow-insert (the seven default export definitions — the shape of an export, MANUAL, no PII, inert while google_sheets is off; nothing runs until a person asks)
insert into sheets_export_definitions (slug, name, entity, columns, tab_name)
values
  ('research-products', 'Research products', 'RESEARCH_PRODUCTS',
   array['source', 'title_normalized', 'category', 'price_state', 'price_min_minor', 'price_max_minor',
         'currency', 'dimensions_mm', 'dimension_parse_state', 'stage', 'disposition', 'first_seen_at',
         'last_seen_at', 'source_url'],
   'Research products'),
  ('comparison-set', 'Comparison set', 'COMPARISON_SET',
   array['member_type', 'member', 'source', 'category', 'price_state', 'price_min_minor', 'currency',
         'longest_axis_mm', 'scale_band', 'snapshot_computed_at', 'coverage_pct'],
   'Comparison set'),
  ('opportunity-scores', 'Opportunity scores', 'OPPORTUNITY_SCORES',
   array['research_product', 'source', 'score', 'confidence', 'state', 'model_version',
         'signal:category_gap', 'signal:large_format_fit', 'signal:price_band_gap',
         'signal:assortment_density', 'signal:change_velocity', 'signal:customisation_signal',
         'signal:material_adjacency'],
   'Opportunity scores'),
  ('shortlist', 'Shortlist', 'SHORTLIST',
   array['research_product', 'source', 'reason', 'tags', 'score_at_entry', 'confidence_at_entry',
         'opened_at', 'opened_by'],
   'Shortlist'),
  ('confirmed', 'Confirmed references', 'CONFIRMED',
   array['research_product', 'source', 'decision_note', 'confirmed_by', 'confirmed_at',
         'product_started', 'archived_at'],
   'Confirmed'),
  ('direction-briefs', 'Direction briefs', 'DIRECTION_BRIEFS',
   array['title', 'status', 'target_category_slug', 'evidence_count', 'approved_by', 'updated_at'],
   'Direction briefs'),
  ('inquiries', 'Enquiries', 'INQUIRIES',
   array['reference_code', 'kind', 'pipeline_status', 'created_at', 'city', 'enquiry_type',
         'whatsapp_state'],
   'Enquiries')
on conflict (slug) do nothing;
