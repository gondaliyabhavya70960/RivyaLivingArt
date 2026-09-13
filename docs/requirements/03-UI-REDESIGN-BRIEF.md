# RIVYA LIVING ART — Website + Studio Redesign

## Implementation-ready CRAFT prompt

Use this entire document as the implementation brief in Claude Code or Codex with access to the repository and the connected GitHub, Supabase, Vercel, Cloudinary and Higgsfield services where available. The inspection notes are a dated starting point; verify the current checkout and deployment before editing.

## C — CONTEXT

### Project and objective

Redesign the existing **Rivya Living Art public website and custom Rivya Studio** into a polished luxury design experience, using the supplied reference website as the primary visual direction.

| Resource | URL |
|---|---|
| Target repository | https://github.com/gondaliyabhavya70960/RivyaLivingArt.git |
| Target public website | https://rivyalivingart.com/ |
| Target private Studio | https://rivyalivingart.com/studio |
| Primary visual reference | https://rivya-living-art.vercel.app/ |

Work inside this existing project. Deliver implemented components, connected CMS content and media, responsive pages, verified workflows and a reviewable preview. An analysis report alone does not complete the implementation task.

The brand focuses on collectible furniture, large resin and 3D art, statement pieces, preservation work, decorative objects and bespoke commissions. Give dining tables, coffee tables, consoles, side tables, seating, large wall art and sculptural objects strong visual priority. Smaller objects remain part of the collection.

### Verified starting point — inspected 12 September 2026

These findings distinguish this repository from older Rivya projects. Revalidate them; do not replace them with assumptions from previous repositories.

| Evidence | Finding | Consequence for this redesign |
|---|---|---|
| GitHub repository metadata and tree | Default branch `main`; inspected tree SHA `1d691e32b57f00b8b83cc6c71bcae9ca341f7c6c` | Check the current branch, HEAD and pending work before making changes |
| `package.json` | Next.js declared as `^16.3.4`, React `19.2.8`, Tailwind `^4.3.3`, TypeScript, Supabase, Cloudinary and an existing Three.js stack | Resolve exact installed versions from the lockfile; preserve the App Router and current architecture |
| `CLAUDE.md` and canonical decisions | CMS is Supabase tables plus the custom Rivya Studio and typed page blocks | Extend this CMS; do not introduce Sanity or a second content system |
| Public homepage, visually inspected | Large dark hero and several category/media areas display “Image unavailable” | Trace missing media connections and delivery before treating every blank area as a styling problem |
| Reference homepage, visually inspected | Blue/black resin imagery, gold details, oversized serif headings, ivory and stone sections, rounded CTAs, asymmetric image compositions and a numbered section rail | Translate these visual relationships into the target components |
| Reference rendered styles | Instrument Serif headings and Inter body text; reference body background `#F4F1E9`, featured-pieces surface `#E7E0D5`, dark hero ground `#080A0E` | These are measured reference values, not yet target-project tokens |
| `app/layout.tsx` | Target currently loads Newsreader and Inter through `next/font` | A move to Instrument Serif is a deliberate typography change, not a claim that it already exists |
| Studio browser visit | `/studio` redirects to `/studio/login?next=%2Fstudio` | Authenticated Studio screens were assessed through repository structure and representative code, not visually verified in this inspection |
| Supabase read-only aggregate query | 250 `media_assets`, 0 `media_usages`, 0 `product_media`, 35 `products`, 83 `page_sections` | Confirm bindings, visibility, actual product states and content readiness; the catalogue is not simply “empty” because the README says so |
| Separate media aggregate query | All 250 media rows were `PUBLISHED`, `VERIFIED`, and `is_concept = true` | Existing assets are available as concept media; they must not become evidence of actual products or delivered projects |
| Asset manifest | 224 images and 26 videos across 24 families | Inspect and reuse existing assets before generating missing ones |
| Vercel connection | Project `rivya-living-art` is linked to `gondaliyabhavya70960/RivyaLivingArt`; its domain list includes `rivyalivingart.com` | Reuse the connected target project; do not assume the separate reference hostname is its production alias |
| Canonical amendment A42 and deployment docs | Preview and production use the same hosted Supabase project | Use the documented local fixture environment for mutation tests; a preview is not a database sandbox |
| Component registry | All eleven requested sources were previously reviewed without adopting external UI components | Perform a fresh component-specific review for this request; record actual adoption and any remaining exclusions accurately |

The zero usage counts are evidence of an integration gap to investigate, not proof of a single root cause. Check direct section fields, reference slots, Cloudinary delivery, query filters and cache state before concluding why an image is missing. Database status flags are recorded values, not an independent verification of the imagery’s factual claims.

### Business and architecture constraints

Preserve the current navigation destinations, route structure, server actions, permissions and business workflows. Improve their presentation and usability without substituting the reference website’s application logic.

- No online checkout, payment gateway or customer accounts.
- A product, commission, consultation or quote inquiry must persist successfully before its WhatsApp handoff. A failed save must retain the form and offer recovery.
- Preserve any existing, explicitly defined general-contact exception in the canonical rules. Do not expand it into a shortcut around inquiry persistence.
- Preserve customization choices, validation, uploads, inquiry references, WhatsApp templates and field mappings.
- Supabase remains the database, staff authentication provider and CMS backend.
- Cloudinary remains the delivery provider behind the existing `MediaProvider` abstraction.
- Higgsfield supplies new AI imagery only for documented gaps after reuse has been considered.
- Public marketing copy and normal editable website content remain in the CMS, not embedded in JSX.
- Preserve publication and owner-verification workflows, staff permissions, RLS and research isolation.
- Google Sheets remains the existing one-way export destination. This redesign does not add spreadsheet-to-catalogue ingestion.
- Existing scraped competitor records remain research-only. Confirming a research item does not publish it as a Rivya product.
- Preserve existing content IDs, media IDs, slugs, relationships, revision history and SEO routing.

## R — ROLE

Act as a senior luxury furniture and art UI designer, product designer for complex administration systems, Next.js engineer, Supabase integration engineer and accessibility reviewer.

Use one coherent design direction across the website and Studio. The public experience should feel like a carefully art-directed gallery. Studio should express the same brand through clear typography, surfaces and details while making daily work fast and readable.

Make practical design decisions independently within this scope. Keep a phase-by-phase record. Explain material deviations and unresolved access or content requirements precisely. Never claim an asset was generated, a page was reviewed or a test passed without evidence.

## A — ACTION

### A1. Establish the current implementation baseline

Read `CLAUDE.md`, `PROJECT_STATE.md`, `CONTEXT.md`, `docs/SESSION-STATE.md`, the roadmap and applicable `AGENTS.md` files if any exist. Then read the relevant sections of:

- `docs/architecture/CANONICAL-DECISIONS.md`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/COMPONENT_REGISTRY.md`
- `docs/studio/STUDIO_GUIDE.md`
- `docs/media/MEDIA_GUIDE.md`
- `docs/media/CLOUDINARY.md`
- `docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md`
- `docs/media/HIGGSFIELD_ASSET_STATUS.md`
- `docs/content/CONTENT_GUIDE.md`
- `docs/ops/DEPLOYMENT.md`
- `docs/ops/ENVIRONMENT.md`
- `docs/ops/TESTING.md`
- `docs/ops/PERFORMANCE.md`
- `docs/ops/ACCESSIBILITY.md`

Verify document claims against code and live configuration. Some documents contain historical statements that differ from the current database or deployment. Record that difference instead of copying it forward.

Inspect the lockfile, build scripts, route groups, component registry, block schemas, server/client boundaries, media provider, inquiry flow, Studio navigation, RLS policy helpers and relevant tests. Read the installed Next.js documentation for APIs you change.

Use the existing checkout if it matches the requested repository. Preserve unrelated work. Use an isolated feature branch or worktree when appropriate. Record baseline commit and environment without displaying secrets.

Create a route and section inventory from actual route files. Include public pages, dynamic routes, Studio list/detail/create/tab routes, loading states, empty states, errors, permissions and mobile behavior. Mark each item as visually inspected, code-inspected, implemented, verified or blocked.

Inspect the reference at desktop and mobile sizes. Capture its layout, typography, media treatment, section rhythm, header behavior, CTA placement, gallery treatment, footer and motion. Distinguish observed behavior from proposed improvements. Do not report mobile or hover behavior as inspected unless you actually test it.

### A2. Resolve media availability and placement

Trace the production media path in this order:

1. Correct Vercel project, deployment and environment configuration, including the presence of the Cloudinary cloud name. Report presence or reachability only.
2. Manifest identity and Cloudinary `public_id`, resource type and delivery transformation.
3. `media_assets` status, concept classification, verification and public read permissions.
4. Desktop/mobile section references, indexed payload references, extra slots, `media_usages` and entity-media joins.
5. `lib/cms/media.ts`, `MediaSlot`, `MediaImage`, `MediaVideo` and page-block resolution.
6. Focal points, source dimensions, responsive transforms and poster selection.
7. Publication, invalidation and deployed page output.

Relevant existing files include:

- `data/higgsfield/asset-manifest.json`
- `content/seed/media-bindings.ts`
- `scripts/seed/bind-media.ts`
- `lib/cms/media.ts`
- `lib/media/providers/cloudinary.ts`
- `lib/media/providers/cloudinary-admin.ts`
- `lib/media/crop.ts`
- `lib/media/transform.ts`
- `components/patterns/MediaSlot/index.tsx`
- `components/patterns/MediaImage/`
- `components/patterns/MediaVideo/`
- `components/patterns/HeroMotion/`

Inspect existing binding and import scripts before running them. Reuse their validation and identity rules; do not create a second binding system. Prepare a deterministic placement plan containing page, section, slot, asset ID, desktop/mobile variant, crop, alt text and concept labeling.

Use existing approved assets wherever suitable. A null binding should not trigger image generation. Do not replace an editor’s existing selection simply because a seed script contains another one. Make any intended binding changes reviewable and scoped to the affected slots.

Do not relabel concepts as product photography to fill `product_media`. The project’s concept restrictions must survive the redesign. Actual product and delivered-project galleries need eligible real media. Where such media is unavailable, keep an honest, purposeful empty state and a concrete content task for the owner.

### A3. Translate the reference into Rivya’s visual system

Use the reference as the leading visual direction, with these concrete characteristics:

- A viewport-filling, material-led opening image with blue resin depth, dark timber or obsidian ground and restrained gold details.
- Large, elegant serif headings with intentional line breaks, short text measures and balanced negative space.
- A refined header with the brand mark, clear navigation and discreet search. Retain target navigation destinations and search accessibility.
- A filled ivory primary CTA and restrained outline secondary CTA, with clear hierarchy and generous hit areas.
- Alternation between obsidian/ocean, warm ivory and light stone surfaces to give long pages a readable rhythm.
- Oversized product and material imagery, deliberate crops, occasional asymmetry and enough space to read the work.
- Thin rules, small section numbers, restrained uppercase labels and a compact page-section index where it helps navigation.
- Calm transitions, subtle image motion and meaningful material storytelling.

The reference’s headline used Instrument Serif at approximately 103px at a 1363px browser viewport, with tight line-height. Use that as a calibration example, not a fixed size for every screen. Set responsive type through the token system. The target currently uses Newsreader; change the display face deliberately if matching the reference, retaining Inter for body and Studio interface text.

Start with the existing obsidian, ocean, sapphire, champagne and bone token families. When adding the measured warm ivory or stone shades, define them centrally, document their roles and update contrast tests. Avoid importing an old forest-green brand palette from a different Rivya brief.

Keep the existing logo unless the owner has supplied a newer approved mark. This task does not silently redesign the brand identity.

A large-format headline should introduce large-format work. If the opening media is an abstract resin macro, give the next major image a clear furniture or room-scale subject. Do not use small keepsakes as the only visual evidence for furniture capabilities.

Translate reference destinations into the target routes:

| Reference destination or label | Target destination |
|---|---|
| `/shop` | `/collection` |
| `/custom-order` / Bespoke | `/custom-commissions` |
| `/large-resin-art` | `/large-format` |
| `/blog` | `/journal` |
| Reference “Studio” brand-story link | `/about` |
| Private content administration | `/studio` |

Preserve verified existing target links and any required redirects. Do not rename the target routes to imitate the reference. Do not copy its prices, lead-time claims, customer counts, workshop offerings, wishlist behavior or direct WhatsApp shortcuts without checking the target’s actual data and workflow.

### A4. Build on the existing design system and select external components

Use these sources as the requested component and interaction pool. Review all eleven; choose a small, coherent set that improves actual sections and Studio tasks.

| Source | URL | Intended evaluation |
|---|---|---|
| ThreeUI | https://threeui.com/browse | Optional material or 3D presentation; reuse the existing demand-loaded viewer and static poster |
| SmoothUI | https://smoothui.dev/ | Tab transitions, disclosure details and restrained interface feedback |
| Magic UI | https://magicui.design/ | Image reveals and selected media interactions |
| Unlumen UI | https://ui.unlumen.com/ | Navigation, controls and focused interface compositions |
| 21st.dev | https://21st.dev/ | Specific author-owned hero, gallery, navigation and application components |
| React Bits | https://reactbits.dev/ | Editorial motion and image treatments, subject to the actual source license |
| AnimMasterLib | https://animmasterlib.dev/ | Reference for material-story sequencing and page transitions; verify access and terms |
| Skiper UI | https://skiper-ui.com/ | Selected gallery, card and scroll interactions |
| Vengence UI | https://www.vengenceui.com/ | Selected navigation and transition treatments; verify the exact domain-to-source relationship |
| daisyUI | https://daisyui.com/?lang=en | Table, drawer, field and status treatments adapted to Rivya tokens |
| Originkit | https://www.originkit.dev/ | Selected gallery or hover treatments; distinguish component licensing from CLI licensing |

Specific candidate pages already opened during this brief’s preparation:

| Candidate | Direct page | Target area | Decision still needed |
|---|---|---|---|
| SmoothUI Animated Tabs | https://smoothui.dev/docs/components/animated-tabs | Existing Studio editor or media tabs | Source, dependencies, keyboard behavior and incremental bundle cost |
| Magic UI Blur Fade | https://magicui.design/docs/components/blur-fade | Selected editorial/gallery entrances | Whether the existing reveal system can produce the result without another runtime |
| daisyUI Table | https://daisyui.com/components/table/ | `components/studio/DataTable.tsx` | Adapt selected structure/styles without importing a competing global theme |
| daisyUI Drawer | https://daisyui.com/components/drawer/ | Existing Studio drawer/sidebar patterns | Preserve current focus, Escape, labeling and keyboard contracts |
| React Bits Scroll Reveal | https://reactbits.dev/text-animations/scroll-reveal | Material or manifesto storytelling | The URL opened, but its component source was not inspected; verify source and license before reuse |

These are candidates, not a claim that anything has been installed, licensed for this project or tested.

For each selection, record the exact source page, source file or revision, license evidence, dependencies, target file, adaptation, mobile behavior, accessibility, measured bundle impact and adoption status in the existing registry. Preserve required notices.

The latest request calls for an actual fresh evaluation of external components. Previous rejections are useful evidence, not proof that every new candidate from that source must fail. Reassess individual items and record why the outcome changed. Do not fabricate a human reviewer or approval.

Prefer compatible source that can be adapted to the existing primitives. Scope any necessary runtime to the feature using it and justify its measured cost. Do not install all eleven libraries, duplicate animation runtimes or import whole-site themes. Review generated installer diffs before accepting them.

Use eligible external source in real components where it passes review. If a desired component cannot be adopted, record whether the result is a visual reference implemented first-party or an actual licensed adaptation. A first-party approximation must not be reported as an imported library component.

Retain the current `--rv-*` token architecture and update:

- `app/styles/tokens.css`
- `app/styles/base.css`
- `app/styles/scheme.css`
- `app/styles/motion.css`
- `app/globals.css`
- `app/layout.tsx`
- `components/primitives/`
- `docs/design/DESIGN_SYSTEM.md`
- `docs/design/COMPONENT_REGISTRY.md`

Record the requested visual direction as a dated design amendment where the current design contract needs updating. Keep business rules, security, source-license requirements and valid test coverage intact. Do not disable checks to make an incompatible import pass.

### A5. Redesign every public route and its states

The following is the minimum route coverage, based on the repository’s canonical map. Add any current routes discovered in the checkout.

| Route or template | Redesign requirements |
|---|---|
| `/` | Cinematic opening; manifesto; large-format discovery; selected real works or honest collection state; material storytelling; category/collection discovery; process; bespoke invitation; eligible portfolio/journal content; closing CTA |
| `/large-format` | A dedicated furniture and large-art experience with room-scale imagery, object categories, material detail, customization and commission entry |
| `/collection` | Strong editorial introduction, prominent category exploration, readable filters and sort, large consistent product cards, result counts and useful empty states |
| `/collection/[category]` | Category-specific imagery and editorial hierarchy; retain query/filter behavior; clear path to individual objects or an inquiry |
| `/collections/[slug]` | Curated exhibition-style composition using the existing page-block/template model |
| `/product/[slug]` | Large gallery, thumbnails, optional real model, factual specifications/materials, existing customization and a clearly visible inquiry action |
| `/custom-commissions` | Refined existing configurator with understandable steps, input grouping, selected-state feedback, uploads, review, persistence and WhatsApp handoff |
| `/portfolio` and `/portfolio/[slug]` | Gallery index and detailed case-study layouts for verified delivered work; distinguish concepts and real projects |
| `/about` | Brand story, material philosophy and eligible maker/process media; no invented credentials or team |
| `/process` | Clear chapters with relevant photographs, detail imagery and optional short clips |
| `/journal`, `/journal/[slug]`, `/journal/category/[slug]` | Editorial cards, comfortable reading measure, clear metadata, category navigation and related reading |
| `/contact` | Clear existing contact channels and inquiry form, mobile usability and concise submission feedback |
| `/faq` | Readable grouped disclosures connected to the existing FAQ records |
| `/search` | Existing scope and query handling with readable grouped results, relevance information where available and useful no-result recovery |
| `/privacy` and `/terms` | Comfortable reading layout for approved text; preserve current publication gating when legal copy is not ready |
| Global states | Header, mega menu, mobile menu, search, footer, breadcrumbs, loading, image/video failures, 404, error and offline/network recovery where supported |

For each route and major section, document: current component; proposed treatment; source component or visual reference; exact target file; CMS/data dependency; media slot; mobile treatment; acceptance evidence.

#### Homepage composition

Use the reference’s rhythm while respecting the target’s existing content model and priorities. A starting composition is:

1. Optional approved announcement and transparent or visually integrated header.
2. Large cinematic hero with a short editable headline and at most two primary choices.
3. Warm ivory manifesto with generous space.
4. Large-format statement and a strong furniture/room-scale image.
5. Selected pieces or collections, with image-led cards.
6. Dark material-story band with resin, timber and finish details.
7. Collection/category exploration with deliberate image scale.
8. Process or maker story.
9. Verified portfolio content, when available.
10. Custom-commission invitation.
11. Eligible journal content and closing contact CTA.

Reuse and reorder eligible existing blocks through the CMS. Do not fill every slot with invented inventory or force every section onto a page. Empty optional content should collapse gracefully without leaving vacant bands.

#### Large-format and product presentation

Prioritize dining tables, coffee tables, side tables, consoles, seating, sculptural furniture and wall/statement art through the existing categories and material records. Do not invent taxonomy or product facts merely to complete a layout.

Use wide room context plus close details that explain thickness, edge quality, resin depth, timber, finish and scale. A concept room view must remain visibly identified as a concept when it could be mistaken for delivered work.

Preserve the existing sequence: discovery → product or commission details → existing customization → review and inquiry save → WhatsApp. Keep entered data on validation/network errors. Preserve idempotency and existing duplicate-submission protections.

Use the existing product gallery and inquiry rail. Do not introduce pricing calculators, fake availability, cart interactions, forced signup or a new multi-step journey as decoration.

### A6. Redesign the entire custom Studio

Studio is the application at `/studio`, not the Supabase dashboard. Preserve its role-aware navigation and every working action.

Use a restrained dark sidebar, warm neutral workspace, clear content titles, consistent toolbars, readable tables, compact status labels, real thumbnails and generous form grouping. Keep body/UI text in Inter. Reserve the display serif for limited brand moments rather than dense data entry.

Use a consistent list → detail → edit pattern. Separate page actions from record actions. Make pending changes, save results, publication readiness and permission limits understandable. Preserve existing breadcrumbs, search state, filters and return paths.

| Studio area | Required coverage |
|---|---|
| Authentication | Login, forgotten-password and reset-password screens; validation, errors, keyboard focus and responsive layout |
| Overview | Useful actual counts, publication/media tasks, recent activity and actionable next steps; no invented analytics |
| Catalogue | Products, product create/detail and media/material/specification/related tabs; categories, collections, materials, relationships, customization forms and bulk actions |
| Merchandising | Homepage, store, featured content and scheduling; improve ranking/selection clarity and preview where existing |
| Content | Pages and page editor, homepage, portfolio, journal, journal categories, testimonials, FAQs, navigation, footer and SEO |
| Media | All assets, images, videos, models, documents, Higgsfield and brand assets; uploads, selection, crop, preview, usage and metadata |
| Inquiries | All, product, commission, consultation and quote views; clear detail layouts, statuses, attachments and existing workflow actions |
| Research | Dashboard, sources, scrape, jobs, runs, changes, explorer, large-format, compare, similarity, opportunities/direction, shortlist, confirmed and Sheets |
| Operations | Workflows, data quality, imports, exports, audit and logs |
| System | Users, settings, integrations, environment, documentation and flags |

Enumerate all detail and nested tab routes from `app/(studio)/studio/(shell)/`; a redesign of the sidebar and dashboard alone is insufficient.

#### Tables and forms

- Reuse `DataTable`, `FilterBar`, `PageHeader`, `StudioPage`, `FormField`, `StatusPill`, `DrawerForm` and `ConfirmDialog`.
- Make product image/title, publication status, readiness issues and next action easy to scan.
- Preserve server-side sorting/filtering/pagination semantics where present. Do not apply client-only sorting to one page and present it as sorting the entire dataset.
- Use consistent label/help/error alignment, clear required fields, grouped specifications and a dependable action row.
- Keep long names and URLs readable, with intentional truncation and a way to inspect full values.
- For narrow screens, use appropriate stacked record layouts or table-local horizontal scrolling; avoid page-wide overflow.
- Preserve confirmation for existing consequential actions and clear per-record results for partial bulk failures.
- Never display a success toast before the underlying server mutation succeeds.

#### Page editor and media workspace

Improve the existing section board and forms so an editor can understand a page without reading raw implementation details. Show block type, title, state, thumbnail, variant and media readiness. Retain keyboard-accessible ordering when drag interaction is offered.

Expose desktop and mobile image selection, crop/focal point, alt text, poster and video controls through the existing schema. Keep draft preview and publishing states explicit.

Use an asset-detail panel with a large preview and the actual usage list. Make image/video/model types, AI origin, concept status, dimensions, readiness and Cloudinary identity understandable. Avoid exposing raw integration settings in normal editorial tasks.

#### Research and Sheets

Clarify source selection, scrape request, job progress, failures, comparison, shortlisting, confirmation and export. Preserve the current server workflows and eligibility rules. A visual redesign must not enable unapproved sources, start automatic scraping or convert research into catalogue inventory.

Use useful split views for comparison and clear feedback for pending, completed, partial and failed exports. Keep Sheets direction one-way unless a separate authorized feature changes the business contract.

### A7. Keep website content and media editable from Studio

Use the existing Supabase page-block and global-content system. Audit every redesigned public section against its editor.

Where relevant, editors need control of headings, supporting copy, CTA labels/destinations, desktop/mobile assets, alt text, focal crop, video/poster, content references, section order, visibility, layout variant, permitted color scheme, SEO and publishing.

Reuse existing fields and variants before adding new ones. If the visual design requires a new field or block variant, implement the complete path: schema and migration where needed → validation → repository types → server permissions → Studio control → renderer → preview/publish → meaningful verification.

Do not add unrestricted HTML, arbitrary JavaScript, raw CSS editors or meaningless design knobs. The current `rich-text` block uses plain paragraphs; replacing it with arbitrary markup is a separate architecture decision.

A new section is incomplete if its public markup exists but its editor, validation, media selection or publication behavior does not. Keep one renderer per registered block type and maintain the existing block-registry tests.

### A8. Reuse and create Cloudinary/Higgsfield media

Follow this priority: real Rivya media → approved user assets → suitable existing Higgsfield assets → suitable existing renders → new Higgsfield generation for confirmed gaps → temporary technical fallback.

Review the existing families, including `material-macro`, `process-pour`, `process-cure`, `process-finish`, `process-studio`, `largeformat-dining`, `largeformat-coffee`, `largeformat-console`, `largeformat-side`, `largeformat-seating`, `largeformat-monumental`, `interior-lifestyle`, `three-d-resin`, `wall-art`, `preservation-*`, `decor` and `gifts`.

| Need | Starting treatment | Asset plan |
|---|---|---|
| Homepage hero | Blue resin/timber macro or strong room-scale composition with text-safe negative space | Existing 21:9/16:9 desktop asset and independently chosen mobile crop/asset |
| Large-format introduction | Furniture in believable room context | Existing large-format/interior families; concept labeling where applicable |
| Material storytelling | Resin translucency, timber grain, edge and finish | Existing material macros, with optional short motion |
| Process | Pour, cure, finish and studio context | Existing process images/clips with honest editorial framing |
| Collection and journal | Purposeful material/object/editorial imagery | Match the actual topic and use an eligible existing asset |
| Real product/project gallery | Accurate photographs or owner-approved factual renders | Actual eligible media; never substitute AI concept inventory |
| Studio login | Optional restrained material image | Reuse an existing asset; avoid video in the working application |

For each genuine gap, create a generation brief containing: page and slot; purpose; subject; factual/concept classification; composition; camera angle; lighting; resin/wood palette; background; aspect ratio; output size; motion duration and movement if video; text-safe area; negative prompt; existing asset checked; planned asset ID; Cloudinary destination and CMS placement.

Example image brief, only if no existing asset fits:

> Create a photorealistic editorial concept of a sculptural walnut and translucent deep-sapphire resin coffee table in a calm contemporary interior. Emphasize believable resin depth, timber grain and precise edge detail. Soft directional daylight, warm stone background, restrained champagne reflections, generous negative space for a headline. No people, no letters, no logo, no watermark, no decorative clutter and no impossible geometry. Produce coordinated desktop and portrait compositions. Record and present this as a concept visualization, not a delivered Rivya product.

Example video brief, only if no existing clip fits:

> Create a short seamless editorial close-up moving slowly across dark timber meeting deep-blue resin. Preserve consistent geometry and material continuity throughout. Controlled reflected light and restrained champagne highlights. No object morphing, text, hands or rapid camera motion. Use a matching still poster and produce a delivery-ready version appropriate to the website’s video budget.

Use the available Higgsfield connection for actual generation. Use Cloudinary for upload and optimized delivery through the existing provider. Record generation provenance, classification, asset identity, alt text and placement in the existing manifest/workflow without breaking its allocator rules.

If generation or upload access is unavailable, finish all independent work and provide the exact outstanding briefs/slots. Do not substitute another generator while claiming it is Higgsfield, invent Cloudinary URLs or mark a requested asset as completed.

Load a real still image first in the hero. Preserve the existing gates for video playback, reduced motion, mobile/data conditions and offscreen pausing. Supply posters, dimensions, responsive delivery, `muted`/`playsInline` where appropriate and captions when audio carries information. Avoid downloading hidden desktop and mobile clips together.

### A9. Content quality and truthful presentation

Write missing brand/editorial copy where needed for the redesign and save it as editable content. Keep it concise, material-specific and useful.

Use verified data for prices, dimensions, material composition, available finishes, lead times, warranties, delivered work and maker claims. Put unverified business statements through the existing owner-verification process. Do not fabricate inventory, testimonials, customers, awards, sustainability evidence or workshop availability.

Inspect existing demo markers and publication gates before using the 35 product rows or other seeded content. A row’s existence is not proof it belongs in the public collection. Preserve demo/concept labeling and keep fixtures out of customer-facing output.

Design purposeful empty states for unpublished products, missing galleries, no inquiries, unavailable metrics and unverified stories. Let owners see what to complete in Studio. Public visitors should see a useful next step, not internal database terminology.

### A10. Technical implementation and integration

Use the current folder structure. Principal adaptation points include:

| Concern | Existing adaptation points |
|---|---|
| Public shell | `app/(site)/layout.tsx`, `components/patterns/SiteHeader/`, `SiteFooter/`, `MegaMenu/`, `MobileNav/`, `SearchCombobox/` |
| Homepage and CMS presentation | `app/(site)/page.tsx`, `components/sections/HeroSection.tsx`, `ManifestoSection.tsx`, `SelectedWorksSection.tsx`, `ScaleStatementSection.tsx`, `MaterialStorySection.tsx`, `SectionShell.tsx`, `registry.ts` |
| Catalogue/product | `app/(site)/collection/`, `app/(site)/product/[slug]/page.tsx`, `components/patterns/ProductCard/`, `ProductGallery/`, `ProductInquiryRail/`, `ProductSpecifications/` |
| Inquiry/configuration | `components/patterns/InquiryForm/`, `Configurator/`, `lib/whatsapp/` and existing server actions |
| Studio shell | `components/studio/StudioShell.tsx`, `StudioTopBar.tsx`, `StudioPage.tsx`, `PageHeader.tsx`, `app/(studio)/studio/(shell)/layout.tsx` |
| Studio lists/forms | `components/studio/DataTable.tsx`, `FilterBar.tsx`, `FormField.tsx`, `StatusPill.tsx`, `DrawerForm.tsx` |
| CMS editing | `components/studio/content/PageEditor.tsx`, `SectionBoard.tsx`, `SectionForm.tsx` |
| Media editing | `components/studio/MediaLibrary.tsx`, `MediaPicker.tsx`, `MediaUploader.tsx`, `HiggsfieldTracker.tsx`, `HiggsfieldAssetDrawer.tsx` |
| Data/auth | `lib/supabase/`, `lib/cms/`, `lib/auth/`, `supabase/migrations/` |

Check exact current paths before editing. These are verified adaptation points, not instructions to replace entire directories.

Keep Server Components as the default. Add Client Components only for necessary interaction. The current section registry imports many renderers, so one careless static client import can add JavaScript to every CMS route. Preserve demand loading for hero motion, material sequences and 3D viewing.

Preserve request-scoped Supabase clients, server-side `requirePermission` checks, RLS, Zod validation and safe cache boundaries. Never move service-role or Cloudinary secret credentials into client code. Public caching must not expose drafts or staff responses.

Do not add a schema migration for a purely visual change. When a schema change is necessary, follow the existing migration process, rehearse it locally, preserve existing rows and verify relevant policies. Do not run destructive reset, demo seed/purge or mutation-heavy tests against the shared hosted database.

Inspect the build lifecycle before running it: the current build includes `scripts/auth/sync-admin.ts`. Preserve its production-only behavior. A redesign preview must not rotate the production owner’s credentials.

Do not create new Vercel or Supabase projects merely to deliver this redesign. Use the existing project and local test harness. Prepare reviewable code and preview output before any production promotion. Follow the project’s actual release mechanism; do not assume merging, deploying and promoting are the same event.

### A11. Responsive behavior, motion and accessibility

Use the current QA matrix and include representative narrow mobile, large mobile, tablet, laptop and desktop widths. At minimum verify 360, 390, 430, 768, 1024, 1280, 1440 and 1920px when the existing matrix supports them.

Verify actual browser rendering for long titles, short content, missing images, many records, empty records, validation errors and denied permissions. Test 200% zoom, keyboard navigation and reduced motion on the critical journeys.

Keep the existing motion tokens as the starting point. Use opacity and transform for restrained reveals; leave content visible when enhancement is unavailable. Prevent motion from delaying the LCP headline or making navigation and forms wait for an animation.

Use pointer/parallax effects sparingly on eligible devices. Touch, keyboard and reduced-motion users need the complete experience. Avoid scroll hijacking, long pinned scenes, cursor-dependent actions, flashing effects and decorative motion in Studio data-entry areas.

Dialogs and drawers must preserve focus containment, Escape behavior, focus return and accessible naming. Filters and tabs must retain the correct semantic model. Do not use an ARIA tab widget for ordinary navigation links without implementing its required behavior.

Check text contrast, focus visibility, selected states, meaningful image descriptions, status communication beyond color and comfortable hit areas. Keep headings and reading order coherent when desktop grids reorder content.

Use the current performance budgets as gates. Aim for good field Core Web Vitals—LCP at most 2.5 seconds, INP at most 200ms and CLS at most 0.1—while reporting laboratory tests as laboratory tests. Do not claim field performance from a local Lighthouse score.

## F — FORMAT, PHASES AND DELIVERABLES

### Mandatory phase-wise execution

| Phase | Scope | Required evidence |
|---|---|---|
| 0 — Baseline | Repository state, route inventory, reference inspection, current UI/data/media/deployment findings | Current commit, coverage matrix, screenshots where accessible, baseline commands and limitations |
| 1 — Media and design foundation | Media diagnosis/placement plan, tokens, typography, core controls and component-source review | Working representative media path, documented tokens, candidate/adoption records |
| 2 — Public shell and key pages | Header/footer/mobile navigation, homepage and `/large-format` | Reference comparison at desktop/mobile sizes; connected editable sections |
| 3 — Remaining public website | Catalogue, product, commission, portfolio, journal, informational and system states | Route coverage, eligible content/media, preserved inquiry flow |
| 4 — Studio | Shell plus every catalogue/content/media/inquiry/research/operations/system route and state | List/detail/edit coverage, existing actions verified against local fixtures |
| 5 — Complete media/content control | Remaining approved placements, genuine media gaps, editor coverage and copy | Placement ledger, CMS edit-to-render proof, unresolved owner-content requirements |
| 6 — Verification and handoff | Required project gates, workflow regressions, responsive/a11y/performance review and preview | Command results, screenshots, preview URL where available, release/rollback instructions and remaining issues |

Work through the phases; do not ask for confirmation after every routine reversible change. If something is blocked, finish the independent authorized work and identify the precise remaining dependency. Preserve genuine publication, access and production-release requirements.

Continue the existing project documentation rather than starting competing systems of record. Update `PROJECT_STATE.md`, `docs/SESSION-STATE.md`, `CHANGELOG.md` and affected domain docs at phase boundaries. Use the canonical ten-condition completion contract; mark incomplete phases honestly.

Provide these outputs:

1. Implemented redesign in the existing repository with coherent, reviewable diffs.
2. A route-by-route website and Studio coverage table.
3. A component replacement/adaptation matrix with exact paths and source links.
4. Updated design-system and component-registry records.
5. A media placement plan/ledger showing reused assets, repaired connections, newly generated assets and remaining gaps.
6. Exact Higgsfield briefs for any still-unavailable requested media.
7. CMS field/editor coverage for every redesigned section.
8. Before/after browser evidence at representative desktop and mobile sizes.
9. Actual verification results with passed, failed and not-run states and reasons.
10. An authenticated or protected Vercel preview when available, plus deployment and rollback instructions consistent with the existing project.

For each component-matrix row, include:

`Route | Section/task | Existing file/component | Proposed treatment | Source name and direct URL | Reuse/adapt/replace | CMS fields | Media slots | Mobile behavior | Accessibility | Measured performance | Status`

For each media row, include:

`Page | Section | Slot | Existing asset ID | Real/concept/AI classification | Desktop/mobile | Crop | Alt text | Poster/video | Cloudinary identity | Approval/readiness | Bound/verified | Remaining action`

## T — TESTS, TONE AND ACCEPTANCE

### Verification

Run the repository’s relevant existing checks first. Use current script definitions, not a remembered count of gates. Commands available at inspection included:

```bash
npm run typecheck
npm run lint
npm run format:check
npm run check
npm run test:unit
npm run build
npm run test:e2e
npm run test:visual
```

Several commands depend on the documented local database, HTTP data layer and environment configuration. Establish that harness before claiming build or end-to-end success. Avoid redundant full runs; use focused verification during phases and the required complete gates before handoff.

Retain the design-token, component-registry, content-copy, media-ID, no-regeneration, image/video, island-budget, WhatsApp, research-isolation, Sheets-direction, authorization, license and accessibility checks. If the scope changes a legitimate design contract, update the contract and relevant assertion together with evidence. Do not lower expectations merely to pass.

Use meaningful local-fixture regressions for these journeys:

| Journey | Required result |
|---|---|
| Mobile discovery and filtering | Navigation, filters, query state, product entry and return path remain usable |
| Product inquiry | Existing details/customization are preserved; successful save precedes WhatsApp; repeated submission follows existing idempotency rules |
| Failed inquiry save | No WhatsApp handoff; entered data remains; errors and retry are clear |
| CMS edit and publish | Authorized edit previews correctly, persists, respects status/verification and appears after the correct invalidation |
| Media selection and crop | Desktop/mobile selections, poster, alt text and focal points render in the expected slots |
| Concept media eligibility | Concept imagery cannot become real product/project evidence through the redesigned picker |
| Studio roles | Allowed actions work; hidden controls are backed by server-side denial for unauthorized calls |
| Research and Sheets | Existing scrape/review/export behavior remains; no research record reaches public catalogue/search implicitly |
| Accessibility and layout | Keyboard, focus, reduced motion, contrast, zoom and narrow screens work across representative states |
| Failure recovery | Missing media, empty results, partial bulk failures and expired sessions have usable outcomes |

Run mutation tests against the documented local fixture environment, because the hosted preview shares production data. Reuse existing tests; add targeted regressions where behavior changes or a concrete defect needs protection. Avoid tests that merely restate class names or component internals.

Review visual snapshots intentionally. Do not bulk-accept changed screenshots without checking cropping, hierarchy, content, overflow and workflow controls. Do not use production inquiry details in shareable evidence.

### Tone and visual quality

Public copy should be quiet, precise and confident, with material-specific language. Studio copy should be short and instructional. Keep the existing spelling conventions. Avoid invented prestige claims and generic luxury slogans.

The result is accepted only when:

- The website clearly reflects the supplied reference’s typography, image scale, material palette, CTA hierarchy and section rhythm.
- The homepage and `/large-format` present large work convincingly using eligible media and truthful content.
- Missing-image causes are investigated and intended media placements are verified; unresolved real-media gaps are explicitly identified.
- All public routes and Studio areas are covered, with missing access distinguished from completed visual QA.
- Editors can update the redesigned website’s normal content and media without code changes.
- Inquiry persistence, WhatsApp behavior, permissions, publishing, research isolation and Sheets direction remain correct.
- External component use is traceable and truthful; the project retains one coherent design system.
- The required tests and checks have actual recorded outcomes, and no new scope-breaking defect remains unreported.
- Reviewable code, preview evidence, documentation and a precise remaining-work list are provided.

Start with the current-state inspection and the media/reference comparison. Then implement the phases in order, preserving working behavior while delivering the full visual redesign.

---

### Inspection sources

- Repository structure and declarations: [GitHub repository](https://github.com/gondaliyabhavya70960/RivyaLivingArt), [package.json](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/package.json), [working agreement](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/CLAUDE.md).
- Architecture, route maps and environment posture: [canonical decisions](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/docs/architecture/CANONICAL-DECISIONS.md), [deployment guide](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/docs/ops/DEPLOYMENT.md).
- Existing visual and source policies: [design system](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/docs/design/DESIGN_SYSTEM.md), [component registry](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/docs/design/COMPONENT_REGISTRY.md).
- Media inventory: [asset manifest](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/data/higgsfield/asset-manifest.json), [asset status document](https://github.com/gondaliyabhavya70960/RivyaLivingArt/blob/main/docs/media/HIGGSFIELD_ASSET_STATUS.md). Historical ledger claims were checked against read-only Supabase aggregates; the current database had published/verified concept assets despite older ledger text.
- Direct browser observations: [target homepage](https://rivyalivingart.com/), [reference homepage](https://rivya-living-art.vercel.app/), [Studio login](https://rivyalivingart.com/studio/login?next=%2Fstudio). Desktop visuals and reference rendered styles were inspected; no authenticated Studio visual audit or implementation tests were performed while preparing this prompt.
- Connected GitHub, Supabase and Vercel read-only inspection on 12 September 2026 supplied repository, aggregate database and project/domain findings. No project code, hosted data or deployment was changed to prepare this prompt.
- Technical reference points: [Supabase server-side authentication](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs), [Vercel documentation](https://vercel.com/docs). Verify the installed framework documentation and current provider APIs before implementation.
