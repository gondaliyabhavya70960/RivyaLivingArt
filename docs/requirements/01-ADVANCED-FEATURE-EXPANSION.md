# RIVYA LIVING ART — ADVANCED FEATURE EXPANSION
## Mandatory merge into the master implementation prompt

> Source of truth. This document expands the Rivya Living Art master implementation
> prompt. All requirements here are mandatory unless they conflict with a
> higher-priority business rule already defined.

---

## 1. CONFLICT RESOLUTION RULE

When older/reference requirements conflict with the approved Rivya V3 architecture,
the V3 decisions win.

### Approved V3 stack

```
Next.js · React · TypeScript · Tailwind CSS
Supabase PostgreSQL · Supabase Auth
Cloudinary · Vercel · Higgsfield AI · GitHub
```

### Explicitly NOT to be used

```
Neon · Sanity · Vercel Blob
customer-account infrastructure
online-payment infrastructure
```

All useful CMS functionality from reference requirements must instead be implemented via
**Supabase + custom Rivya Studio + controlled page-block CMS**.
All useful media functionality must use **Cloudinary + Rivya Media Manager**.

---

## 2. COMPLETE DIGITAL ECOSYSTEM

Rivya is not only a website. The final system is a complete digital ecosystem:

```
01 Luxury public website          14 Media Library
02 Luxury resin furniture catalog 15 Higgsfield AI asset workflow
03 Large-format resin-art catalog 16 Content CMS
04 Collectible-design catalog     17 Unified Studio
05 3D + Resin experience          18 Product merchandising
06 3D product viewer              19 Google Sheets integration
07 Bespoke/custom commission      20 Inquiry/WhatsApp order management
08 Product customization system   21 Analytics
09 Editorial Journal              22 SEO management
10 Portfolio/project platform     23 Environment/health monitoring
11 Product Scraper                24 Documentation browser
12 Competitor/comparator mgmt     25 System logs
13 Product opportunity intel      26 Audit history
                                  27 Session-recovery documentation
```

Goal: **luxury digital flagship showroom + internal content, product, research and
commerce operating system.**

---

## 3. EXPANDED PROFESSIONAL ROLE

The implementation agent acts simultaneously as: Product Architect · Creative Director ·
Luxury UX/UI Designer · Design Systems Architect · Next.js Architect · React Engineer ·
TypeScript Engineer · Supabase Architect · Database Architect · CMS Architect ·
Studio/Admin Engineer · Product Scraper Engineer · Competitive Intelligence Architect ·
3D/WebGL Engineer · Three.js Engineer · Animation Engineer · Cloudinary Media Architect ·
Higgsfield AI Art Director · SEO Engineer · Performance Engineer · Accessibility Engineer ·
Security Engineer · QA Engineer · Technical Writer.

Do not optimize one discipline while ignoring the rest.

---

## 4. MASTER CREATIVE CONCEPT — THE MATERIAL EXPERIENCE

```
WOOD → RESIN → LIGHT → FORM → SPACE → ART
```

Rivya should feel as though the visitor is physically approaching, observing and
understanding an object. Use where appropriate: macro resin photography, extreme detail
views, wood-grain closeups, resin transparency, reflection, shadow, slow cinematic video,
material transitions, subtle parallax, scroll storytelling, 3D inspection, dimensional
typography, spatial composition, architectural negative space.

---

## 5. EXPERIENCE PRINCIPLE

The primary question is **not** "how many components can we add?" but
**"how extraordinary can we make the experience of discovering and understanding a Rivya object?"**

Every design feature must support at least one of: product understanding, material
understanding, brand perception, storytelling, navigation, conversion, usability.
Remove visual novelty that serves none of these.

---

## 6. CENTRAL DESIGN SYSTEM

Build a centralized design system **before** building final pages. Define: typography
(display/body/technical); colour, surface, border, radius, shadow; spacing, grid, container
widths, breakpoints; buttons, links, inputs, selects, text areas, checkboxes, radios,
switches; navigation, dropdowns, mega menu, breadcrumbs; cards (product, collection,
portfolio, journal); gallery, lightbox, slider, carousel; modal, drawer, tabs, accordion,
tooltip; filters, search, command palette; tables, data grids, charts, KPI cards; motion,
transitions, reveal, scroll effects; 3D viewer UI; Studio primitives.

**Do not style every route independently.**

---

## 7. APPROVED COMPONENT RESEARCH

Continue to research:

```
https://threeui.com/browse      https://smoothui.dev/
https://magicui.design/         https://ui.unlumen.com/
https://21st.dev/               https://reactbits.dev/
https://animmasterlib.dev/      https://skiper-ui.com/
https://www.vengenceui.com/     https://daisyui.com/?lang=en
https://www.originkit.dev/
```

Every chosen external component must appear in `docs/design/COMPONENT_REGISTRY.md` with:
source, link, license, dependencies, page, purpose, adaptation, mobile behaviour,
performance, accessibility.

---

## 8. COLLECTIONS SHOULD FEEL LIKE EXHIBITIONS

A collection is not a filtered product grid. Collection pages support: hero, collection
statement, signature media, products, material story, video, portfolio/project reference,
3D element, editorial copy, related Journal stories, commission CTA.

Closer to an exhibition than a marketplace category.

---

## 9. COLLECTION CONCEPT SYSTEM

Studio allows named design stories/collections. Do **not** fabricate them as real published
collections. Possible editable starting concepts:

```
Ocean · Earth · Aurora · Midnight · Monsoon · Geode · Forest · Clear · Botanical · Bespoke
```

Seed only as `DRAFT_COLLECTION_CONCEPT` unless the owner confirms them.

---

## 10. ADVANCED PRODUCT RELATIONSHIPS

Products support relationships with: Categories, Collections, Materials, Portfolio Projects,
Journal Articles, Related Products, Design Families, Resin Styles, Wood Species, Media,
Customization Forms.

```
Product
├── Category
├── Collection
├── Materials
├── Related Products
├── Portfolio Projects
└── Journal Articles
```

Used for discovery, recommendations, contextual storytelling, internal research, SEO,
Studio workflows.

---

## 11. RELATED CONTENT ENGINE

- **Product pages** may show: Related Products, Related Collection, Related Project,
  Related Journal, Related Material Story, Related Design Direction.
- **Portfolio pages**: Used/Related Products, Related Materials, Related Articles,
  Related Collections.
- **Journal articles**: Referenced Products, Related Projects, Related Articles.

Do not invent relations automatically unless there is a reliable rule.
Studio editors can always override.

---

## 12. FULL 3D EXPERIENCE

Support `GLB` and `GLTF` (and future-compatible types when justified). Viewer supports where
applicable: rotation, zoom, orbit controls, reset camera, full screen, material inspection,
variant switching, dimension indicators, lighting presets, environment presets, mobile touch
controls.

---

## 13. 3D MEDIA MANAGEMENT

Studio Media Manager sections: Images · Videos · 3D Models · Documents · AI Assets ·
Brand Assets.

3D model metadata: `id, title, asset_url, format, file_size, poly_count, texture_count,
thumbnail, poster, associated_product, associated_project, status, uploaded_by, created_at`.

Use the media-provider abstraction.

---

## 14. 3D PERFORMANCE REQUIREMENTS

Never block initial page rendering with a 3D scene. Use lazy loading, dynamic imports,
compressed assets, optimized textures, reduced polygon count, loading progress, static poster
fallback, mobile fallback where necessary, reduced-motion fallback.

A heavy 3D viewer must not destroy Core Web Vitals.

---

## 15. BESPOKE CONFIGURATOR

More than a generic contact form:

```
Product/Project Type → Approximate Dimensions → Wood Preference → Resin Direction →
Colour → Finish → Base/Structure → Reference Upload → Location → Notes →
Contact Details → Save Inquiry → WhatsApp
```

Every step configurable from Studio. Do **not** calculate fake bespoke pricing — use
`Request Quote`, `Starting From`, `Price on Request`.

---

## 16. STUDIO IS THE CENTRAL CONTROL SYSTEM

```
RIVYA STUDIO

OVERVIEW           CATALOG                  MERCHANDISING
├── Dashboard      ├── Products             ├── Homepage
├── Analytics      ├── Categories           ├── Store
└── Activity       ├── Collections          ├── Featured Collections
                   ├── Materials            └── Scheduling
                   ├── Product Relationships
                   ├── Customization Forms
                   └── Bulk Management

CONTENT            MEDIA                    INQUIRIES
├── Pages          ├── All Assets           ├── All
├── Homepage       ├── Images               ├── Product Enquiries
├── Portfolio      ├── Videos               ├── Custom Commissions
├── Journal        ├── 3D Models            ├── Consultation
├── Testimonials   ├── Documents            └── Quote Requests
├── FAQs           ├── Higgsfield Assets
├── Navigation     └── Brand Assets
├── Footer
└── SEO

RESEARCH                         OPERATIONS          SYSTEM
├── Dashboard                    ├── Workflow Runs   ├── Users
├── Competitor Sources           ├── Data Quality    ├── Site Settings
├── New Scrape                   ├── Imports         ├── Integrations
├── Running Jobs                 ├── Exports         ├── Environment
├── Completed Runs               ├── Audit Logs      ├── Documentation
├── Changes                      └── System Logs     └── Feature Flags
├── Product Explorer
├── Large Format
├── Compare
├── Similarity
├── Opportunities
├── Shortlist
├── Confirmed Products
└── Google Sheets
```

Role-aware navigation is required.

---

## 17. STUDIO DASHBOARD

Cards may include: Products · Published Products · Draft Products · Large-Format Products ·
Collections · Portfolio Projects · Journal Articles · Open Enquiries · Custom Commission
Enquiries · Scraper Runs · New Competitor Products · Changed Competitor Products · Products
Awaiting Review · Shortlisted Products · Confirmed Products · Media Assets · Missing Media ·
Higgsfield Assets Pending · Data Quality Errors · System Health.

Do not overload every role with irrelevant metrics.

---

## 18. STUDIO GLOBAL SEARCH

Studio search covers: Products, SKUs, Categories, Collections, Materials, Portfolio, Journal,
Media, Inquiries, Scraped Products, Competitor Sources, Workflow Runs.

Public search covers: Products, Categories, Collections, Portfolio, Journal.

---

## 19. SEARCH EXPERIENCE

Public search supports instant suggestions, grouped result types, keyboard navigation, typo
tolerance where practical, empty states, filters.
**Do not expose internal scraper data publicly.**

---

## 20. BULK MANAGEMENT

- **Products**: bulk import, edit, publish, unpublish, archive, category assignment,
  collection assignment, status change, tag assignment, material assignment, media assignment.
- **Scraper**: bulk shortlist, reject, mark duplicate, assign research tags, confirm.
- **Media**: bulk tag, move/folder, archive.

Destructive actions require explicit confirmation.

---

## 21. PRODUCT DATA QUALITY

Validate at minimum: SKU, slug, title, price state, currency, dimensions, materials, category,
media references, URLs, publication state.

Prevent: duplicate SKU, duplicate slug, impossible dimensions, malformed URLs, broken media
references, invalid price state, quote-only represented as zero, missing required publication
data.

---

## 22. PUBLICATION READINESS SCORE

A transparent checklist (Title, Description, Category, Price state, Dimensions, Materials,
Hero image, Gallery, SEO, Customization). **Not** an opaque AI score.

---

## 23. SCRAPER DATA QUALITY PIPELINE

```
RAW → NORMALIZED → VALIDATED → MATCHED → REVIEW → SHORTLISTED → CONFIRMED
```

Do **not** treat `scraped` as equivalent to a trusted first-party product.

---

## 24. SCRAPER CHANGE DETECTION

Show material changes for previously discovered competitor products (price, title, stock,
dimensions, variants, materials, images, lead time, description, availability, customization).
Record timestamps and source snapshot.

---

## 25. SCRAPER CHANGE ACTIONS

Merchandiser may: Review · Ignore · Shortlist · Reject · Mark Duplicate · Confirm · Add Note ·
Add Tag · Compare.

**Never automatically import changes into Rivya products.**

---

## 26. MODULAR COMPARATOR MANAGEMENT

`/studio/research/sources` — each competitor source supports: Name, Website, Region, Currency,
Source Type, Analytics League, Enabled, Collection Mode, Category Mapping, URL Patterns,
Extraction Adapter, Image Extraction, Price Extraction, SKU Extraction, Attribute Extraction,
Rate Limit, Request Delay, Concurrency, Scheduling, Last Run, Health, Policy Review, Notes.

New normal sources must be addable without rewriting the scraper engine.

---

## 27. SOURCE ADAPTER ARCHITECTURE

```
scraper/
├── core/
├── adapters/
│   ├── source-a/
│   ├── source-b/
│   └── generic/
├── normalization/
├── validation/
├── workflows/
└── analytics/
```

A broken source adapter must not break other sources.

---

## 28. ANALYTICS CENTER

First-party: Catalog, Product Categories, Product Scale, Large Format Share, Collection Mix,
Inquiry Trends, Content Performance, Media Coverage.
Competitive: Assortment, Price Architecture, Dimensions, Materials, Resin Styles, Colours,
Customization, Production Model, Opportunity Scores, Source Freshness.

Do not manufacture unavailable analytics data. Clearly state coverage.

---

## 29. ENVIRONMENT STATUS PAGE

`Studio → System → Environment` — read-only operational health: Supabase, Cloudinary, Google
Sheets, Vercel, Higgsfield, database migration state, build version/commit SHA, deployment
environment.

**NEVER display** secret values, private keys, passwords, service-role token, Cloudinary
secret, Google service-account secret. Safe health information only.

---

## 30. DOCUMENTATION VIEWER

`Studio → System → Documentation` — authorized staff browse sanitized repository Markdown:
Architecture, Studio Guide, Media Guide, Scraper Guide, Deployment, Environment, Business
Rules, Content Guide, Component Registry, Higgsfield Guide. Never expose secret files.

---

## 31. SYSTEM LOGS

`Studio → Operations → System Logs` — filter by time, level, module, user, workflow, source,
entity. Types: INFO, WARNING, ERROR, SECURITY, WORKFLOW, SCRAPER, MEDIA, CONTENT.
Never log sensitive secret values.

---

## 32. FEATURE FLAGS

Lightweight flag system. Possible flags: 3D Viewer, Experimental WebGL Hero, Advanced
Similarity, Higgsfield Tracker, Google Sheets, Advanced Analytics.
Not a substitute for proper configuration.

---

## 33. AI / HIGGSFIELD ASSET PRIORITY

```
1. Verified real Rivya product media
2. Existing approved user-provided asset
3. Existing approved Higgsfield asset
4. Existing suitable Rivya project/render
5. Generate new Higgsfield asset
6. Temporary technical fallback only if unavoidable
```

**Do not regenerate an asset unnecessarily.**

---

## 34. HIGGSFIELD ASSET AUDIT

Before creating new media, inspect available project media. Create/update
`docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md` and `docs/media/HIGGSFIELD_ASSET_STATUS.md`.

Inventory columns: Asset ID, Type, Product, Collection, Page, Purpose, Source, Higgsfield?,
Prompt, Status, Used?, Cloudinary location, CMS placement.

---

## 35. HIGGSFIELD NAMING STANDARD

```
home-hero-main-video.mp4        product-<slug>-hero.webp
home-hero-main-poster.webp      product-<slug>-detail-01.webp
furniture-signature-hero.webp   product-<slug>-lifestyle-01.webp
collection-ocean-hero.webp      product-<slug>-video-01.mp4
                                product-<slug>-model.glb
portfolio-<slug>-hero.webp      journal-<slug>-cover.webp
```

Asset IDs remain more important than filenames.

---

## 36. INITIAL CONTENT + ASSET PAIRING

Every initial CMS section must have: Content ID, Page, Section, Initial Copy, Studio Location,
Media Requirement, Higgsfield Asset ID, Desktop Ratio, Mobile Ratio, Cloudinary Folder,
Alt Text, Publication Status, Owner Verification Status.

**Never design content and media as separate afterthoughts.**

---

## 37. INITIAL CONTENT GENERATION

Generate all first-pass content for: Homepage, About, Large Format, Collection, all primary
categories, Custom Commissions, Process, Portfolio landing, Journal landing, Contact, FAQ,
Navigation, Footer, SEO, global CTAs, empty states, error states, WhatsApp templates, Studio
helper text.

Seed into Supabase. All normal content editable from Studio. **No lorem ipsum.**

---

## 38. CONTENT SAFETY

Never fabricate real product specifications, dimensions, pricing, delivered projects, named
customers, testimonials, sales claims, awards, manufacturing certifications, or durability
claims. Use `OWNER_VERIFICATION_REQUIRED` where necessary.

---

## 39. FUTURE-READY WITHOUT PREMATURE IMPLEMENTATION

Architect cleanly enough that future work could add conventional ecommerce, payment provider,
shipping, customer account, wishlist, reviews, AR, room visualization, advanced configurator,
CRM, quotation automation.

**DO NOT IMPLEMENT THESE NOW.** Current business rules require:

```
NO online checkout · NO payment gateway · NO customer accounts
```

Do not create unused production tables for these systems merely for theoretical future
readiness. Extensibility comes from clean architecture, not dead features.

---

## 40. SESSION RECOVERY SYSTEM (MANDATORY)

Create `docs/SESSION-STATE.md`. At the end of EVERY phase update:

```
Current Phase / Status (COMPLETE | PARTIAL | BLOCKED) / Completed / Files Changed /
Files Created / Database Changes / Components Added / External References /
Media Assets Added / Higgsfield Assets / Tests Run / Test Results / Known Issues /
Remaining Work / Next Exact Action / Relevant Documentation /
Environment Requirements / Migration Requirements
```

---

## 41. NEW SESSION START RULE

At the beginning of each new session, FIRST READ:

```
CLAUDE.md · PROJECT_STATE.md · CONTEXT.md · docs/SESSION-STATE.md · docs/project/ROADMAP.md
```

Then inspect repository state. **Never assume a previous phase completed merely because
documentation says it was planned. Verify.**

---

## 42. PHASE COMPLETION CONTRACT

A phase is COMPLETE only when:

1. Scope implemented
2. Relevant tests run
3. No known scope-breaking error
4. Documentation updated
5. CHANGELOG updated
6. PROJECT_STATE updated
7. SESSION-STATE updated
8. Remaining issues documented
9. Next phase identified
10. Repository remains recoverable

---

## 43. DOCUMENTATION UPDATE CONTRACT

```
Database change      → DATA_MODEL / SUPABASE docs
Studio change        → STUDIO_GUIDE
Scraper change       → SCRAPER docs
Media change         → MEDIA/CLOUDINARY docs
Higgsfield change    → HIGGSFIELD docs
Design component     → COMPONENT_REGISTRY
Environment change   → ENVIRONMENT docs
```

Then update CHANGELOG, PROJECT_STATE, SESSION-STATE where appropriate.

---

## 44. EXPANDED PHASE MAP

```
PHASE 00 — Repository Audit & Baseline        PHASE 24 — Bulk Management
PHASE 01 — PRD, Architecture & Documentation  PHASE 25 — Product Scraper Foundation
PHASE 02 — Reference UI Audit + Design System PHASE 26 — Comparator Source Management
PHASE 03 — Supabase Database + Data Layer     PHASE 27 — Scraper Extraction
PHASE 04 — Supabase Auth + RBAC + RLS         PHASE 28 — Normalization + Validation
PHASE 05 — Studio Foundation                  PHASE 29 — Change Detection + Review
PHASE 06 — Cloudinary Media Architecture      PHASE 30 — Large-Format Research Workspace
PHASE 07 — Higgsfield Asset Audit + Plan      PHASE 31 — Analytics + Comparison
PHASE 08 — CMS / Editable Content System      PHASE 32 — Opportunity Engine
PHASE 09 — Initial Website Content Seed       PHASE 33 — Visual Similarity
PHASE 10 — Public Website Foundation          PHASE 34 — Product Direction Tool
PHASE 11 — Homepage + Material Experience     PHASE 35 — Shortlist + Confirmation
PHASE 12 — About + Process                    PHASE 36 — Google Sheets
PHASE 13 — Large Format Experience            PHASE 37 — Studio Analytics
PHASE 14 — Product Catalog                    PHASE 38 — Environment + Docs + Logs
PHASE 15 — Product Detail Experience          PHASE 39 — SEO
PHASE 16 — Collections / Exhibitions          PHASE 40 — Performance
PHASE 17 — Portfolio / Projects               PHASE 41 — Accessibility + Security
PHASE 18 — Journal                            PHASE 42 — Comprehensive Testing
PHASE 19 — Bespoke / Custom Configurator      PHASE 43 — Media Coverage + Higgsfield Final
PHASE 20 — Inquiry + WhatsApp Flow            PHASE 44 — Vercel Deployment
PHASE 21 — 3D Product Experience              PHASE 45 — Final Creative Polish
PHASE 22 — Homepage / Store Merchandising     PHASE 46 — Documentation + Handoff
PHASE 23 — Global Search + Product Relations
```

Do not skip major phases. If a phase is already demonstrably complete: audit it, verify it,
document it, then continue.

---

## 45. VISUAL QA MATRIX

```
Desktop  1920 · 1440 · 1280
Tablet   1024 · 768
Mobile   430 · 390 · 360
```

Check: navigation, hero, typography, media crop, product cards, product galleries, 3D, motion,
forms, filters, search, CMS-driven content, Studio, scraper, charts, tables, responsive
behaviour, touch interactions.

---

## 46. PERFORMANCE QA

Measure and optimize LCP, CLS, INP, TTFB, JavaScript, images, video, 3D, network payload,
caching.

Rules: Server Components by default; Client Components only where needed; responsive Cloudinary
transformations; AVIF/WebP where appropriate; optimized video; posters; dynamic imports;
lazy 3D; caching; CDN delivery.

---

## 47. SECURITY QA

Protect `/studio`, server mutations, media deletion, product publishing, scraper actions,
Sheet sync, role management.

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CLOUDINARY_API_SECRET`,
`GOOGLE_SERVICE_ACCOUNT_JSON`, private integration keys.

Use server-side permission checks, RLS, schema validation, audit logs, rate limiting where
appropriate, safe upload validation.

---

## 48. ACCESSIBILITY QA

Semantic HTML, heading hierarchy, keyboard navigation, focus visibility, form labels,
screen-reader labels, alt text, contrast, reduced motion, accessible dialogs, accessible tabs,
accessible navigation, touch target sizes.

---

## 49. FINAL CREATIVE AUDIT

- **Brand** — does it feel like a collectible-design studio?
- **Scale** — does large furniture visually dominate?
- **Material** — can the visitor feel resin, wood, light and surface?
- **3D** — does 3D improve product understanding rather than exist as a gimmick?
- **UX** — can users discover and understand products easily?
- **Conversion** — can users Enquire · Customize · Request Quote · Request Consultation ·
  Commission a Piece · Continue to WhatsApp?
- **Mobile** — does mobile feel intentionally designed?
- **Studio** — can the owner manage everything without code changes?

---

## 50. FINAL QUALITY BAR

The final experience should create the reaction:
**"I have never seen resin furniture presented like this."**

It should feel premium, artistic, architectural, cinematic, tactile, modern, memorable, calm,
technically refined, trustworthy. **Technology must disappear behind the experience.**

---

## 51. FINAL SUCCESS CRITERIA

**Public website** — world-class luxury design, large-format furniture focus, large resin-art
focus, cinematic storytelling, premium catalog, high-end PDPs, collection exhibitions,
custom/bespoke flow, Portfolio, Journal, 3D, search, responsive design, excellent SEO, strong
performance, accessibility.

**Studio** — dashboard, products, categories, collections, materials, relationships, bulk
management, CMS, Homepage editor, Store merchandising, Portfolio, Journal, media, images,
videos, 3D, Higgsfield assets, scraper, competitor sources, change review, comparison,
opportunity intelligence, shortlist, confirmed products, Google Sheets, inquiries, SEO,
analytics, environment, documentation, logs, users, audit history.

**Infrastructure** — Next.js, Supabase PostgreSQL, Supabase Auth, Cloudinary, Vercel, GitHub.

**Creative pipeline** — real-media-first workflow, existing Higgsfield reuse, missing asset
detection, complete Higgsfield prompts, image/video asset organization, AI metadata, Cloudinary
mapping, Studio management, CMS mapping.

**Engineering** — TypeScript, modular architecture, migrations, RLS, RBAC, tests, QA, session
recovery, documentation, performance optimization, accessibility, maintainability.

---

## FINAL IMPLEMENTATION RULE

Use all useful features defined in the project requirements and reference specifications.
Do not discard a useful feature merely because it was described in an older architecture:

```
Identify feature → Check current Rivya business rules → Check current approved architecture →
Adapt feature → Implement via Supabase / Cloudinary / Next.js / Studio → Test → Document
```

**However: do NOT reintroduce obsolete or conflicting technology merely because it appears in a
reference specification.** The current architecture and business rules always take priority.
