-- ============================================================================================
-- 0292 — Phase 31: the indexes the analytics reads take
--
-- Separate from 0290 for one reason: the phase document names them as a deliverable of their own,
-- and a file that holds only indexes is one an operator can read in ten seconds when a query is
-- slow. Every index below serves a query that exists; none is speculative.
-- ============================================================================================

set search_path = public, extensions;

-- "The newest snapshot for this scope and family" — the dashboard's and the workbench's read.
create index research_analytics_snapshots_latest_idx
  on research_analytics_snapshots (scope_type, scope_id, metric_family, computed_at desc);

-- The members of a set, in the order the builder arranged them.
create index research_comparison_members_set_position_idx
  on research_comparison_members (set_id, position);

-- The two foreign keys the cascades run over. Without these a source deletion scans every member.
create index research_comparison_members_source_idx
  on research_comparison_members (source_id) where source_id is not null;
create index research_comparison_members_product_idx
  on research_comparison_members (research_product_id) where research_product_id is not null;

-- Coverage rows are read by snapshot, always.
create index research_metric_coverage_snapshot_idx
  on research_metric_coverage (snapshot_id);
