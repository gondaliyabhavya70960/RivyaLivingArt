-- ============================================================================================
-- 0180 — `is_demo`: the one column that makes placeholder content removable
--
-- WHY THIS EXISTS. The owner has authorised placeholder content so the site can be seen working
-- before launch, on one condition: that all of it is marked, listed, and replaced when the real
-- data arrives. A convention would not have been enough. "Rows whose slug starts with demo-" is a
-- rule that lives in whoever remembers it, survives exactly until an editor renames one, and
-- cannot be relied on by the command that has to delete every last one of them on launch day.
--
-- SO IT IS A COLUMN, NOT A NAMING SCHEME OR A SEED-KEY PREFIX. `delete from products where
-- is_demo` is the whole purge, it cannot match a real row, and it keeps working after an editor has
-- renamed, re-slugged, re-photographed and republished the row — which is precisely what an editor
-- evaluating a demo catalogue does.
--
-- IT IS NOT A VISIBILITY RULE, and deliberately so. No policy here tests `is_demo`: a demo product
-- is published, readable and rendered exactly like a real one, because a placeholder catalogue that
-- behaves differently from a real one tells the owner nothing about the site they are evaluating.
-- What the column carries is IDENTITY — "this row is placeholder" — and the two consequences of
-- that are a badge in Studio and a purge that cannot miss.
--
-- WHAT IS NOT MARKED, AND WHY THAT IS RIGHT. The 250 Higgsfield assets are not demo: they are real
-- assets, migrated, catalogued in `data/higgsfield/asset-manifest.json`, and the demo rows BORROW
-- them rather than inventing media. Purging demo content must not delete a single one, which is why
-- `media_assets` has no `is_demo` column to set by accident. The seeded SEED-specification copy is
-- not demo either — it is the specification's own words, authored for this business.
--
-- CHILD ROWS ARE MARKED BY PARENTAGE, NOT BY A COLUMN. `product_media`, `product_specs`,
-- `product_materials`, `product_relations`, `product_collections`, `portfolio_project_media` and
-- `journal_article_categories` all carry `on delete cascade` from the row this column sits on, so
-- deleting the parent takes them with it. A second copy of the flag on each child would be a second
-- thing to get wrong and would answer no question the join does not already answer.
-- ============================================================================================

set search_path = public, extensions;

alter table products            add column is_demo boolean not null default false;
alter table pages               add column is_demo boolean not null default false;
alter table page_sections       add column is_demo boolean not null default false;
alter table journal_articles    add column is_demo boolean not null default false;
alter table portfolio_projects  add column is_demo boolean not null default false;
alter table testimonials        add column is_demo boolean not null default false;

comment on column products.is_demo is
  'Owner-authorised placeholder inventory, to be replaced before launch. Never a visibility rule: a demo product renders exactly like a real one. `npm run demo:purge` removes every row carrying it.';
comment on column pages.is_demo is
  'A page created to give a demo article or project a body. Purged with its owner; a real page never carries this.';
comment on column page_sections.is_demo is
  'A section of a demo page. Marked as well as cascaded, so a demo band added to a REAL page is still findable and removable.';
comment on column journal_articles.is_demo is
  'A placeholder article. The ten SEED §20 drafts are not demo — they are the specification''s own titles and angles; a body written to fill them is.';
comment on column portfolio_projects.is_demo is
  'A placeholder project. Cannot be published while it carries OWNER_VERIFICATION_REQUIRED, which is the point: the site must not claim delivered work that was not delivered.';
comment on column testimonials.is_demo is
  'A placeholder testimonial. Cannot be published without consent GRANTED, which no demo row has and none may claim.';

-- Partial indexes: the purge and the register both ask "which rows are demo", and that question is
-- asked of a table where the answer is a small minority. A full index would be mostly false values.
create index products_demo_idx           on products (id)           where is_demo;
create index pages_demo_idx              on pages (id)              where is_demo;
create index page_sections_demo_idx      on page_sections (id)      where is_demo;
create index journal_articles_demo_idx   on journal_articles (id)   where is_demo;
create index portfolio_projects_demo_idx on portfolio_projects (id) where is_demo;
create index testimonials_demo_idx       on testimonials (id)       where is_demo;
