# RIVYA LIVING ART
# INITIAL WEBSITE CONTENT SEED SYSTEM

## MANDATORY REQUIREMENT

Do NOT build Rivya Living Art with empty CMS fields, lorem ipsum, generic placeholder paragraphs, or unfinished public pages.

During the initial build, generate and seed the complete first usable content set required by the website.

The first deployment should already contain professional draft content for:

- global site content
- navigation
- homepage
- About
- Large Format
- Collection / Store
- category landing pages
- Custom Commissions
- Process
- Portfolio landing page
- Journal landing page
- Contact
- FAQ
- footer
- SEO defaults
- CTA system
- empty states
- inquiry messages
- WhatsApp message templates
- Studio helper copy
- media alt-text drafts
- category descriptions

Every seeded content item must be editable from:

`/studio`

There must be no requirement to edit source code to change normal website copy.

---

# 1. CONTENT SOURCE-OF-TRUTH RULE

Public components must NOT contain primary marketing copy directly inside JSX/TSX.

Bad:

```tsx
<h1>Objects shaped by flow.</h1>
```

Preferred:

```tsx
<h1>{section.heading}</h1>
```

where `section.heading` comes from the CMS/database.

Seed content into Supabase.

Studio edits Supabase content.

Public website reads published Supabase content.

---

# 2. CONTENT STATUS SYSTEM

Every content record should support:

```text
DRAFT
REVIEW
APPROVED
PUBLISHED
ARCHIVED
```

Content that includes assumptions about real business capability should additionally support:

```text
OWNER_VERIFICATION_REQUIRED
```

---

# 3. CONTENT FACT CLASSIFICATION

Each content field should be classified where useful as:

```text
BRAND_COPY
EDITORIAL_COPY
VERIFIED_BUSINESS_FACT
PRODUCT_FACT
SEO_COPY
LEGAL_COPY
```

Do not treat creative marketing language as a verified product specification.

---

# 4. CONTENT SEED VERSION

Create:

```text
content_seed_version = "rivya-v1"
```

Do not re-seed over owner changes automatically after production.

Seed operation must be idempotent.

Example:

```text
npm run seed:content
```

Once owner-edited content exists, content seeding must not silently overwrite it.

---

# 5. STUDIO CONTENT ARCHITECTURE

Studio should expose:

```text
WEBSITE
├── Homepage
├── About
├── Large Format
├── Collections
├── Custom Commissions
├── Process
├── Portfolio Landing
├── Journal Landing
├── Contact
├── FAQ
├── Navigation
├── Footer
├── Global Content
└── SEO
```

Every section should support:

- eyebrow
- heading
- highlighted text if applicable
- body copy
- supporting copy
- CTA label
- CTA URL
- image/video
- image alt text
- visibility
- order
- theme
- layout variant
- desktop media
- mobile media
- scheduled publish where appropriate

---

# 6. GLOBAL BRAND CONTENT

Seed:

## Brand Name

**Rivya Living Art**

## Primary Brand Descriptor

**Collectible Furniture · Resin Art · Digital Fabrication**

Editable:

`Studio → Website → Global Content → Brand`

---

## Primary Brand Statement

**Functional art shaped through resin, natural materials and digital fabrication.**

Alternative short descriptor:

**Objects shaped by material, movement and craft.**

Studio must allow choosing/changing this.

---

## Longer Brand Introduction

> Rivya Living Art explores the meeting point of art, material and function. We create statement furniture, sculptural objects and bespoke resin pieces shaped through a combination of resin work, natural materials, digital design, 3D fabrication and hand-finishing.

Mark as:

`DRAFT_MARKETING_COPY`

because exact fabrication capabilities should be owner-reviewed before publication.

---

# 7. PRIMARY CTA SYSTEM

Seed reusable CTA labels.

```text
Explore Large Format
View the Collection
Commission a Piece
Start a Custom Project
Explore Selected Works
Discover the Process
View Product
View Project
Explore Materials
Read the Journal
Discuss Your Idea
Enquire on WhatsApp
Send an Enquiry
```

Studio location:

`Studio → Website → Global Content → CTA Library`

---

# 8. MAIN NAVIGATION

Initial desktop navigation:

```text
Home
Collection
Large Format
Custom Commissions
Portfolio
Process
About
Journal
Contact
```

Suggested mobile navigation identical unless owner changes it.

Under:

**Collection**

seed:

```text
Furniture
Collectible Design
3D + Resin
Wall & Statement Art
Preservation
Décor
Gifts
```

All labels, order, links and visibility editable.

---

# 9. ANNOUNCEMENT BAR

Default:

**Bespoke resin furniture, statement art and custom commissions.**

CTA:

**Discuss a Project**

Destination:

WhatsApp or `/custom-commissions`

Studio:

`Website → Global Content → Announcement Bar`

Allow disable.

---

# 10. HOMEPAGE CONTENT

# HOME — SECTION 01
## HERO

Eyebrow:

**RIVYA LIVING ART**

Primary headline:

**Objects shaped by flow.  
Built to live with.**

Supporting copy:

> Collectible furniture, sculptural resin objects and large-format commissions created at the intersection of material craft and digital form.

Primary CTA:

**Explore Large Format**

URL:

`/large-format`

Secondary CTA:

**Commission a Piece**

URL:

`/custom-commissions`

Media:

Higgsfield asset or approved real Rivya flagship large-format media.

Studio:

`Website → Homepage → Hero`

All text/media editable.

---

# HOME — SECTION 02
## MANIFESTO

Eyebrow:

**LIVING ART**

Heading:

**Furniture can hold more than function.**

Body:

> A table can become a landscape. A surface can capture movement. A functional object can carry the presence of sculpture.
>
> Rivya Living Art approaches resin as a material for form, depth and expression—combining it with wood, digitally developed structures and careful finishing to create objects intended to become part of the spaces around them.

CTA:

**About Rivya**

URL:

`/about`

Classification:

`DRAFT_MARKETING_COPY`

---

# HOME — SECTION 03
## SIGNATURE COLLECTIONS

Eyebrow:

**THE COLLECTION**

Heading:

**Made for spaces that deserve a point of view.**

Intro:

> Explore furniture, collectible objects and statement art across Rivya's evolving material language.

Seed cards:

### Tables

Title:

**Tables**

Description:

> Dining, coffee, console and statement tables where resin, form and material become one composition.

CTA:

**Explore Tables**

---

### Sculptural Furniture

Title:

**Sculptural Furniture**

Description:

> Functional pieces developed with an art-object mindset—from seating to experimental forms.

CTA:

**Explore Furniture**

---

### 3D + Resin

Title:

**3D + Resin**

Description:

> A developing intersection of digitally fabricated form, additive processes and resin craft.

Mark:

`OWNER_VERIFICATION_REQUIRED`

until exact production capability is verified.

---

### Statement Art

Description:

> Large-format resin compositions, sculptural wall pieces and visually immersive surfaces.

---

### Architectural Pieces

Description:

> Bespoke objects and material-led interventions conceived for distinctive interior environments.

Mark:

`OWNER_VERIFICATION_REQUIRED`

---

# HOME — SECTION 04
## SELECTED WORKS

Eyebrow:

**SELECTED WORKS**

Heading:

**Objects with presence.**

Body:

> A curated selection of large-format furniture, art pieces and material experiments from the Rivya collection.

Product selection controlled through:

`Studio → Commerce → Homepage Merchandising → Selected Works`

Do NOT hardcode products.

If no published products exist:

display editorial fallback rather than fake product cards.

---

# HOME — SECTION 05
## MATERIAL STORY

Eyebrow:

**FROM LIQUID TO OBJECT**

Headline sequence:

```text
LIQUID.
FORM.
CRAFT.
OBJECT.
```

Body:

> Resin begins without a fixed shape. Through colour, transparency, casting, structure and finishing, that fluid material can become something lasting.
>
> Rivya's work explores this transformation—bringing together material character, controlled making and contemporary form.

CTA:

**Discover Our Process**

---

# HOME — SECTION 06
## MATERIAL PALETTE

Heading:

**Material defines the character of every piece.**

Seed cards:

### Resin

> Depth, transparency, colour and movement become part of the composition.

### Wood

> Grain, edge and natural variation introduce warmth and individuality.

### Fabricated Form

> Digitally developed geometry can introduce structures and silhouettes that traditional construction alone may not easily achieve.

Mark third statement:

`OWNER_VERIFICATION_REQUIRED`

### Finish

> Surface finishing brings every material into a deliberate relationship with touch, light and space.

---

# HOME — SECTION 07
## CUSTOM COMMISSION

Eyebrow:

**MADE FOR YOUR SPACE**

Heading:

**Begin with an idea, not a catalogue limitation.**

Body:

> A Rivya commission starts with your space, dimensions, visual direction and intended use. Together, these become the foundation for a piece developed specifically around your requirement.

Supporting items:

```text
Custom dimensions
Material direction
Colour direction
Form exploration
Finish selection
Reference-based consultation
```

Only publish capabilities confirmed by owner.

CTA:

**Start a Custom Project**

URL:

`/custom-commissions`

---

# HOME — SECTION 08
## 3D + RESIN

Eyebrow:

**DIGITAL FORM × MATERIAL CRAFT**

Heading:

**New forms emerge when digital fabrication meets resin.**

Body:

> Rivya explores how digitally developed and 3D-fabricated structures can interact with cast resin, colour, translucency and hand-finishing to create new types of functional and sculptural objects.

Status:

`OWNER_VERIFICATION_REQUIRED`

Do not publish as a current capability until owner confirms actual fabrication capability.

CTA:

**Explore 3D + Resin**

---

# HOME — SECTION 09
## PORTFOLIO

Eyebrow:

**PROJECTS & STUDIES**

Heading:

**From material experiment to finished environment.**

Body:

> Explore selected commissions, prototypes, studies and finished works through their materials, details and design process.

CTA:

**View Portfolio**

Do not seed fictional client projects.

---

# HOME — SECTION 10
## PROCESS

Eyebrow:

**HOW A PIECE TAKES FORM**

Heading:

**A process built around the object.**

Steps:

### 01 — Understand

> Define the purpose, dimensions, context and visual direction.

### 02 — Develop

> Explore proportion, material relationships, colour and structural direction.

### 03 — Make

> Translate the approved direction through the appropriate fabrication and resin processes.

### 04 — Finish

> Refine surfaces, details and material transitions.

### 05 — Deliver

> Prepare the completed work for its final setting.

These are draft process statements and require owner verification.

CTA:

**Explore the Process**

---

# HOME — SECTION 11
## SECONDARY OBJECTS

Eyebrow:

**SMALLER IN SCALE. STILL PERSONAL.**

Heading:

**Objects for gifting, memory and everyday spaces.**

Body:

> Alongside large-format work, Rivya creates smaller resin objects, personalized pieces and preservation-led designs.

Cards:

```text
Preservation
Décor
Personalised Pieces
Gifts
```

This section must appear after the primary large-format story.

---

# HOME — SECTION 12
## JOURNAL

Eyebrow:

**JOURNAL**

Heading:

**Material, process and the ideas behind the work.**

Body:

> Notes from the studio on resin, furniture, digital fabrication, interiors, preservation and contemporary craft.

CTA:

**Read the Journal**

---

# HOME — SECTION 13
## FINAL CTA

Headline:

**Have a piece in mind?**

Body:

> Tell us about the space, size, material direction or idea you would like to explore.

Primary CTA:

**Discuss Your Project**

Secondary CTA:

**WhatsApp Rivya**

---

# 11. ABOUT PAGE

Slug:

`/about`

SEO seed:

Title:

**About Rivya Living Art | Resin Furniture & Functional Art**

Description:

**Discover Rivya Living Art, a contemporary studio exploring resin furniture, sculptural objects, material craft and digital fabrication.**

Editable.

---

## ABOUT HERO

Eyebrow:

**ABOUT RIVYA**

Heading:

**We work where material becomes expression.**

Body:

> Rivya Living Art is a contemporary material-led studio focused on furniture, sculptural objects and resin art.
>
> Our approach begins with a simple idea: functional objects do not have to disappear into a room. They can contribute character, movement, memory and presence.

---

## ABOUT — PHILOSOPHY

Eyebrow:

**OUR APPROACH**

Heading:

**Not decoration added to an object.  
The material is the object.**

Body:

> Resin offers colour, transparency, depth and movement. Wood introduces grain, warmth and natural variation. Digital fabrication opens another way to think about geometry and structure.
>
> Rivya explores how these qualities can be brought together in a considered, contemporary way.

---

## ABOUT — SCALE

Heading:

**From intimate objects to room-defining pieces.**

Body:

> Our primary direction is large-format functional art—tables, furniture, statement surfaces and custom pieces designed to carry visual presence within a space.
>
> Smaller décor, preservation and personalized pieces extend the same material thinking into more intimate formats.

---

## ABOUT — BESPOKE

Heading:

**Designed around context.**

Body:

> Bespoke work allows proportion, materials, colour and detail to respond to a particular interior, requirement or idea instead of forcing every project into a fixed standard.

---

## ABOUT — CLOSING

Heading:

**Living art is art that becomes part of living.**

Body:

> It is touched, used, seen from different angles and experienced over time. That relationship between object and everyday life is central to Rivya.

CTA:

**Start a Commission**

---

# 12. LARGE FORMAT PAGE

Slug:

`/large-format`

SEO title:

**Large Resin Furniture & Custom Statement Pieces | Rivya Living Art**

SEO description:

**Explore large-format resin tables, sculptural furniture, statement art and bespoke functional pieces by Rivya Living Art.**

---

## HERO

Eyebrow:

**LARGE FORMAT**

Heading:

**Designed to shape the room around them.**

Body:

> Rivya's large-format collection focuses on furniture and statement objects where scale becomes part of the design.

CTA:

**Discuss a Large-Format Project**

---

## CATEGORY INTRO

Heading:

**Furniture as a focal point.**

Body:

> Dining tables, conference tables, coffee tables, consoles and sculptural furniture offer space for the material itself to become a defining visual element.

---

## LARGE FORMAT CATEGORIES

### Dining & Statement Tables

> Large surfaces create space for resin flow, natural edge, colour and material contrast to unfold at architectural scale.

### Coffee & Centre Tables

> Lower proportions allow sculptural form, base geometry and surface detail to become especially visible.

### Consoles & Side Pieces

> Narrower pieces can act as visual interventions in entrances, living spaces and transitional areas.

### Conference & Commercial Tables

> Larger communal surfaces create opportunities for custom dimensions, material direction and strong visual identity.

Mark:

`OWNER_VERIFICATION_REQUIRED`

### Sculptural Seating

> Seating conceived with greater emphasis on silhouette and object character.

Mark if not yet produced.

### Architectural & Statement Pieces

> Large wall compositions, feature surfaces and custom objects intended for spatial integration.

Mark:

`OWNER_VERIFICATION_REQUIRED`

---

## CUSTOMIZATION

Heading:

**Scale changes the conversation.**

Body:

> For a large-format commission, dimensions, access, weight, structural considerations, material selection, base design and the final environment all become part of the design brief.

This statement should be owner-reviewed before publication.

---

## CTA

Heading:

**Planning a custom table, statement piece or spatial installation?**

Body:

> Share your dimensions, space photographs, references and intended use with Rivya.

CTA:

**Start the Conversation**

---

# 13. COLLECTION / STORE LANDING PAGE

Slug:

`/collection`

SEO title:

**Collection | Resin Furniture, Art & Custom Objects | Rivya Living Art**

Description:

**Explore Rivya Living Art's collection of resin furniture, collectible objects, 3D + resin designs, statement art, preservation pieces and décor.**

---

## HERO

Eyebrow:

**COLLECTION**

Heading:

**Functional objects. Material stories.**

Body:

> Explore Rivya across furniture, collectible design, statement art and smaller resin objects.

---

## COLLECTION ORDER

Seed:

```text
01 Furniture
02 Collectible Design
03 3D + Resin
04 Wall & Statement Art
05 Preservation
06 Décor
07 Gifts
```

Fully editable from Store Merchandising.

---

# 14. CATEGORY CONTENT

## FURNITURE

Slug:

`/collection/furniture`

Heading:

**Furniture with material at its centre.**

Description:

> Tables, seating and functional objects where resin, natural material and form become part of one composition.

---

## COLLECTIBLE DESIGN

Heading:

**Functional pieces conceived as objects of design.**

Description:

> Limited, experimental and sculptural pieces that explore stronger silhouettes, unusual material relationships and expressive form.

Do not imply limited edition unless actual product supports it.

---

## 3D + RESIN

Heading:

**Digital form meets fluid material.**

Description:

> An experimental category exploring how 3D-fabricated geometry and resin can interact in furniture, sculpture and functional objects.

Mark:

`OWNER_VERIFICATION_REQUIRED`

---

## WALL & STATEMENT ART

Heading:

**Art with depth, light and material presence.**

Description:

> Resin panels, sculptural wall pieces and large-format compositions developed to create visual focus within an interior.

---

## PRESERVATION

Heading:

**Objects designed to hold what matters.**

Description:

> Preservation pieces transform meaningful flowers, keepsakes and memories into lasting resin objects.

Do not make preservation-longevity claims beyond what is supportable.

---

## DÉCOR

Heading:

**Material details for everyday spaces.**

Description:

> Smaller functional and decorative pieces carrying Rivya's resin-led visual language into the home.

---

## GIFTS

Heading:

**Personal, made with intention.**

Description:

> Customizable resin objects for meaningful gifting, celebrations and personal occasions.

---

# 15. CUSTOM COMMISSIONS PAGE

Slug:

`/custom-commissions`

SEO title:

**Custom Resin Furniture & Art Commissions | Rivya Living Art**

Description:

**Start a bespoke resin furniture, statement art or custom object project with Rivya Living Art.**

---

## HERO

Eyebrow:

**CUSTOM COMMISSIONS**

Heading:

**Your space. Your idea. A piece developed around both.**

Body:

> A custom commission allows size, material direction, colour, form and detail to respond to the project rather than a fixed catalogue.

CTA:

**Start Your Project**

---

## WHO IT IS FOR

Heading:

**For homes, workspaces and distinctive interiors.**

Body:

> Commission enquiries may begin with a room, an existing material palette, a functional need, an inspiration image or simply an idea that needs development.

Do not claim commercial capabilities not verified.

---

## COMMISSION STARTING POINTS

```text
Dining / Statement Table
Coffee / Centre Table
Console
Desk
Custom Furniture
Wall / Statement Art
Preservation Piece
3D + Resin Concept
Other
```

All options editable in Studio.

---

## WHAT TO SHARE

Heading:

**A useful brief can be simple.**

Fields:

```text
What would you like to create?
Approximate dimensions
Location / city
Reference images
Preferred colours
Material preferences
Intended use
Timeline
Additional notes
```

---

## HOW IT WORKS

### 01 — Enquiry

> Share the basic idea, dimensions and references.

### 02 — Discussion

> Rivya reviews the requirement and continues the conversation through WhatsApp.

### 03 — Direction

> Materials, design direction, feasibility and commercial details are discussed.

### 04 — Confirmation

> Price, production details, payment and delivery are confirmed manually.

Exact workflow editable and owner-verifiable.

---

## CTA

Heading:

**Start with the idea. We can discuss the rest.**

CTA:

**Enquire on WhatsApp**

---

# 16. PROCESS PAGE

Slug:

`/process`

SEO title:

**Our Process | Rivya Living Art**

SEO description:

**Explore the design, material and making process behind Rivya Living Art's resin furniture and custom objects.**

---

## HERO

Eyebrow:

**PROCESS**

Heading:

**From an idea to a material object.**

Body:

> Every project has different requirements, but the process is guided by the same principle: understand the object before deciding how it should be made.

---

## STEP 01 — BRIEF

Heading:

**Understand the purpose.**

Body:

> Dimensions, use, environment, reference imagery and visual direction establish the starting point.

---

## STEP 02 — MATERIAL DIRECTION

Heading:

**Choose what the piece needs to express.**

Body:

> Resin colour, transparency, wood character, structural material and finish influence both appearance and function.

---

## STEP 03 — FORM DEVELOPMENT

Heading:

**Shape the relationship between materials.**

Body:

> Proportion, edge, thickness, silhouette and structural direction are developed around the piece.

---

## STEP 04 — FABRICATION

Heading:

**Translate the direction into physical form.**

Body:

> The appropriate fabrication method is selected according to the design and material requirements.

Avoid specific production claims until verified.

---

## STEP 05 — RESIN WORK

Heading:

**Control movement without removing character.**

Body:

> Colour, layering, transparency and composition are developed according to the intended visual result.

---

## STEP 06 — FINISHING

Heading:

**Refine what the eye and hand experience.**

Body:

> Surfaces, edges and transitions are finished to support the final visual and tactile quality.

---

## STEP 07 — FINAL REVIEW

Heading:

**Consider the piece as a whole.**

Body:

> The completed object is reviewed against its intended form, finish and project requirements before handover.

---

# 17. PORTFOLIO LANDING PAGE

Slug:

`/portfolio`

SEO title:

**Selected Works & Projects | Rivya Living Art**

Description:

**Explore furniture, resin art, material studies and custom projects from Rivya Living Art.**

---

## HERO

Eyebrow:

**SELECTED WORKS**

Heading:

**Ideas made material.**

Body:

> A growing archive of finished pieces, prototypes, commissions and material studies.

Important:

DO NOT create fictional customer projects to fill Portfolio.

If no verified projects exist:

show:

```text
Portfolio archive is being prepared.
Explore the collection or discuss a custom project with us.
```

Studio can publish verified projects when ready.

---

# 18. JOURNAL LANDING PAGE

Slug:

`/journal`

SEO title:

**Journal | Resin, Furniture & Material Stories | Rivya Living Art**

Description:

**Explore ideas, guides and studio notes about resin furniture, materials, 3D fabrication, preservation and contemporary craft.**

---

## HERO

Eyebrow:

**RIVYA JOURNAL**

Heading:

**Material. Process. Perspective.**

Body:

> Stories and guides exploring the materials, ideas and processes surrounding Rivya's work.

---

# 19. INITIAL JOURNAL CATEGORIES

Seed:

```text
Resin Furniture
Collectible Design
Materials
3D Printing
Studio Process
Custom Projects
Interior Art
Preservation
Care & Education
```

Editable.

---

# 20. INITIAL BLOG ARTICLE DRAFTS

Do NOT publish automatically.

Seed as:

`DRAFT`

Initial article ideas:

### 01

**What Makes a Resin Table More Than a Surface?**

Angle:

material depth, composition, scale and role in interiors.

---

### 02

**Choosing the Right Size for a Statement Dining Table**

Angle:

room proportion, circulation, seating and visual scale.

Avoid claiming exact standards unless sourced.

---

### 03

**Resin and Wood: Designing Around Contrast**

Angle:

visual relationship between transparency/colour and natural grain.

---

### 04

**From Digital Form to Physical Object**

Angle:

general introduction to digital design, 3D fabrication and resin experimentation.

Mark any Rivya-specific capability claims for owner review.

---

### 05

**What to Prepare Before Requesting a Custom Furniture Commission**

Angle:

dimensions, reference imagery, use, material preferences and space images.

---

### 06

**A Guide to Resin Colour, Transparency and Visual Depth**

---

### 07

**Large Wall Art: Thinking Beyond Decoration**

---

### 08

**Preserving Flowers in Resin: What a Custom Brief Should Include**

Do not make technical preservation-performance promises.

---

### 09

**How Material Choice Changes the Character of a Space**

---

### 10

**Why Bespoke Furniture Starts With Context**

Studio:

`Editorial → Journal`

All drafts editable.

---

# 21. CONTACT PAGE

Slug:

`/contact`

SEO title:

**Contact Rivya Living Art**

Description:

**Contact Rivya Living Art for custom resin furniture, art, preservation and bespoke project enquiries.**

---

## HERO

Eyebrow:

**CONTACT**

Heading:

**Tell us what you would like to create.**

Body:

> For product questions, custom commissions, large-format furniture or project enquiries, send us the details below or continue directly on WhatsApp.

---

## CONTACT DETAILS

Seed from supplied business information:

Phone:

`+91 7096036250`

WhatsApp:

`+91 7096036250`

Email:

`gondaliyabhavya70960@gmail.com`

Location link:

existing supplied Google Maps destination.

All must be editable:

`Studio → System → Site Settings → Contact`

Do not hardcode these values in multiple components.

---

# 22. CONTACT FORM

Fields:

```text
Name
Phone
Email (optional)
City
Enquiry Type
Message
Reference Upload (optional)
```

Enquiry types:

```text
Large-Format Furniture
Custom Furniture
3D + Resin
Wall / Statement Art
Preservation
Product Question
General Enquiry
Other
```

---

# 23. FAQ PAGE — INITIAL CONTENT

Seed as editable entries.

## FAQ 01

Question:

**Do you make custom-size furniture?**

Draft answer:

> Custom sizing can be discussed for eligible projects. Share your approximate dimensions, space details and intended use through the commission form or WhatsApp.

Status:

`OWNER_VERIFICATION_REQUIRED`

---

## FAQ 02

**Can I choose the resin colour?**

> Colour customization may be available depending on the product or commission. Available options are shown on product pages where applicable, or can be discussed for a custom project.

---

## FAQ 03

**Can I send reference images?**

> Yes. Reference images can be uploaded with an enquiry to help communicate your preferred form, colour, material direction or space.

---

## FAQ 04

**How do I place an order?**

> Select a product or start a custom enquiry, enter your requirements and choose Place Order. Your enquiry is recorded and you are then redirected to WhatsApp to continue the conversation with Rivya.

---

## FAQ 05

**Can I pay directly on the website?**

> No. Rivya does not process online payments through the website. Pricing, payment arrangements and delivery details are finalized directly through WhatsApp.

---

## FAQ 06

**Do I need an account to place an enquiry?**

> No. There are no customer accounts. You can browse, customize and submit an enquiry without creating an account.

---

## FAQ 07

**Do you create one-of-one pieces?**

Draft answer:

> One-of-one and bespoke directions may be available depending on the project. Contact Rivya with your idea to discuss possibilities.

Status:

`OWNER_VERIFICATION_REQUIRED`

---

## FAQ 08

**Can you work from my room or interior references?**

> Yes. Space photographs, measurements and reference imagery can help establish the visual and dimensional direction for a custom enquiry.

---

## FAQ 09

**Where is pricing shown?**

> Products may display a fixed price, a starting price or a request-for-quote state depending on the nature of the piece. Bespoke projects are discussed individually.

---

## FAQ 10

**How do custom commissions begin?**

> Start by sharing the type of object, approximate dimensions, intended use, location and any visual references you already have. Rivya will continue the discussion through WhatsApp.

---

# 24. FOOTER CONTENT

Brand statement:

**Collectible furniture, resin art and bespoke objects shaped through material, craft and contemporary form.**

Footer columns:

### Explore

```text
Collection
Large Format
Portfolio
Journal
```

### Studio

```text
About
Process
Custom Commissions
Contact
```

### Information

```text
FAQ
Privacy
Terms
```

### Contact

Phone / WhatsApp / Email / Location.

Social links editable.

---

# 25. NEWSLETTER CONTENT

Only implement if newsletter is included.

Heading:

**Notes from the studio.**

Body:

> New work, material stories and selected journal updates from Rivya Living Art.

CTA:

**Subscribe**

Do not force newsletter functionality if not part of implementation scope.

---

# 26. SEARCH CONTENT

Search placeholder:

**Search furniture, art, materials and stories**

No-results title:

**Nothing matched that search.**

Body:

> Try another material, product type or collection.

CTA:

**Explore the Collection**

---

# 27. COLLECTION EMPTY STATE

Heading:

**New work is taking shape.**

Body:

> This collection is being prepared. Explore another category or contact Rivya about a custom piece.

CTA:

**Start a Commission**

---

# 28. PORTFOLIO EMPTY STATE

Heading:

**The project archive is being prepared.**

Body:

> Verified Rivya projects will appear here as the portfolio develops.

CTA:

**Explore the Collection**

This is better than generating fake client projects.

---

# 29. BLOG EMPTY STATE

Heading:

**More from the studio soon.**

Body:

> New material stories, project notes and guides are being prepared.

---

# 30. PRODUCT PRICE LABELS

Seed global labels:

```text
Price
From
Starting from
Request a Quote
Price on Request
Made to Order
One of One
Limited Edition
Ready Stock
Customizable
```

All editable from:

`Global Content → Commerce Labels`

---

# 31. PRODUCT ACTION LABELS

```text
Customize This Piece
Place Order
Discuss on WhatsApp
Request a Quote
Ask About This Piece
View Details
Explore Similar Work
```

---

# 32. PRODUCT VERIFICATION RULE

Do NOT seed fake real products with invented:

- names presented as actual inventory
- prices
- dimensions
- materials
- manufacturing methods
- lead times
- availability
- product photography

The initial content system may seed:

- taxonomy
- categories
- UI labels
- example form schemas

but live products must come through:

- owner manual entry
- approved import
- explicitly confirmed product workflow

---

# 33. DEFAULT CUSTOMIZATION FORM — FURNITURE

Seed template:

```text
Desired Size
Length
Width
Height
Resin Colour Direction
Transparency Preference
Wood Preference
Base / Leg Preference
Finish Preference
Reference Images
Delivery City
Project Notes
```

Every field can be:

- enabled
- disabled
- required
- optional
- reordered
- renamed

---

# 34. DEFAULT CUSTOMIZATION FORM — PRESERVATION

```text
Preservation Type
Occasion
Item / Flower Type
Preferred Shape
Preferred Size
Personalization
Reference Image
Notes
```

Do not promise preservation compatibility before review.

---

# 35. DEFAULT CUSTOMIZATION FORM — 3D + RESIN

```text
Object Type
Approximate Dimensions
Intended Use
Preferred Form Direction
Resin Colour
3D Structure Direction
Reference Images
Notes
```

Mark template:

`OWNER_VERIFICATION_REQUIRED`

until exact manufacturing options are defined.

---

# 36. WHATSAPP INITIAL MESSAGE TEMPLATE

Editable in:

`Studio → System → Site Settings → WhatsApp`

Seed:

```text
Hello Rivya Living Art,

I would like to enquire about:

Product / Project: {{product_or_project}}
Name: {{customer_name}}
Phone: {{phone}}
City: {{city}}

Requirements:
{{customization_summary}}

Notes:
{{notes}}

Reference:
{{reference_urls}}

Inquiry ID:
{{inquiry_id}}
```

System should shorten gracefully if message becomes too long.

Do not expose internal/private fields.

---

# 37. CUSTOM COMMISSION WHATSAPP TEMPLATE

```text
Hello Rivya Living Art,

I would like to discuss a custom project.

Project Type:
{{project_type}}

Approximate Size:
{{dimensions}}

City:
{{city}}

Material / Colour Direction:
{{material_direction}}

Notes:
{{notes}}

Reference Images:
{{reference_urls}}

Inquiry ID:
{{inquiry_id}}
```

Editable.

---

# 38. STUDIO LOGIN CONTENT

Heading:

**Rivya Studio**

Body:

**Manage the collection, website, media, enquiries and research workspace.**

Button:

**Sign In**

Do not include public signup CTA.

---

# 39. STUDIO DASHBOARD WELCOME

Heading:

**Studio Overview**

Intro:

> Manage Rivya's website, products, media, enquiries, merchandising and competitive research from one workspace.

Dashboard quick actions:

```text
Add Product
Edit Homepage
Upload Media
Add Portfolio Project
Create Journal Post
View Enquiries
Run Product Research
Review Scraped Products
```

Role permissions control visibility.

---

# 40. STUDIO CONTENT EDITOR HELPER COPY

Seed helper messages.

For example:

Homepage Hero:

> Keep the primary story focused on large-format furniture, collectible design or 3D + resin work.

Homepage Selected Works:

> Choose only the pieces you want to feature publicly. Drag to reorder.

About:

> Keep factual manufacturing claims accurate and owner-verified.

Higgsfield asset:

> AI-generated concept media must not be presented as completed real Rivya work.

Scraped competitor product:

> Research reference only. Never publish competitor imagery or text as Rivya content.

---

# 41. DEFAULT SEO SYSTEM

Create editable global fallback:

Site Name:

**Rivya Living Art**

Default title template:

`%s | Rivya Living Art`

Default description:

> Rivya Living Art creates resin furniture, collectible objects, statement art and bespoke pieces shaped through material craft and contemporary form.

Default social title:

**Rivya Living Art — Functional Art & Collectible Furniture**

Default social description:

> Explore resin furniture, sculptural objects, large-format art and bespoke commissions.

Studio editable.

---

# 42. SEO KEYWORD DIRECTION

Do not keyword-stuff.

Initial strategic themes:

```text
resin furniture
resin dining table
river table
epoxy resin furniture
custom resin table
bespoke resin furniture
resin coffee table
resin console table
sculptural furniture
collectible furniture
3D printed furniture
resin wall art
large resin art
custom furniture India
resin furniture India
custom resin art
resin preservation
```

Actual SEO strategy must be refined through research before claiming ranking opportunity.

---

# 43. IMAGE ALT-TEXT SYSTEM

Every media asset must have editable alt text.

Do not seed meaningless:

```text
image 1
hero
photo
```

Example draft:

> Sculptural resin dining table presented in a minimal architectural interior.

For concept media:

internal metadata:

```text
is_ai_generated = true
is_concept = true
```

Alt text describes the visible image; it does not need to announce AI generation unless product policy requires that publicly.

---

# 44. SOCIAL SHARING COPY

Default OpenGraph headline:

**Rivya Living Art**

Default supporting copy:

**Collectible furniture, resin art and bespoke material objects.**

Editable in Studio.

---

# 45. 404 PAGE

Eyebrow:

**404**

Heading:

**This object isn't here.**

Body:

> The page may have moved, but there is more to explore.

CTAs:

**View the Collection**

**Return Home**

---

# 46. 500 / ERROR PAGE

Heading:

**Something interrupted the flow.**

Body:

> The page could not be loaded correctly. Try again or return to the collection.

CTA:

**Try Again**

Secondary:

**Return Home**

---

# 47. OFFLINE / TEMPORARY MEDIA FAILURE

Heading:

**Image temporarily unavailable**

Do not collapse product layout.

Provide neutral material-toned fallback.

---

# 48. INQUIRY SUCCESS STATE

Heading:

**Your enquiry has been saved.**

Body:

> Continue on WhatsApp to discuss the project with Rivya.

CTA:

**Continue to WhatsApp**

---

# 49. FORM ERROR COPY

Generic:

**Please check the highlighted fields and try again.**

Upload error:

**This file could not be uploaded. Try another file or continue without it.**

Inquiry save error:

**Your enquiry could not be saved. Please try again before continuing to WhatsApp.**

Important:

Never redirect if persistence failed.

---

# 50. MEDIA PRODUCTION CONTENT

For each section above requiring media:

create associated:

- Higgsfield Asset ID
- Higgsfield prompt
- negative prompt
- desktop ratio
- mobile ratio
- Cloudinary folder
- CMS slot
- alt text
- status

Example:

```text
HOME-HERO-VIDEO-001
HOME-HERO-POSTER-001
HOME-CATEGORY-TABLES-001
HOME-CATEGORY-SCULPTURE-001
HOME-CATEGORY-3D-RESIN-001
HOME-MATERIAL-RESIN-001
HOME-MATERIAL-WOOD-001
HOME-COMMISSION-001
HOME-PROCESS-001
ABOUT-HERO-001
ABOUT-MATERIAL-001
LARGE-HERO-VIDEO-001
LARGE-DINING-001
LARGE-COFFEE-001
LARGE-CONSOLE-001
LARGE-SCULPTURE-001
COMMISSION-HERO-001
PROCESS-HERO-001
```

All tracked through Studio Higgsfield Assets.

---

# 51. INITIAL CONTENT DATABASE SEED

Create content seeds such as:

```text
database/seeds/content/
```

or architecture-appropriate equivalent.

Suggested structure:

```text
global.ts
navigation.ts
homepage.ts
about.ts
large-format.ts
collections.ts
commissions.ts
process.ts
portfolio.ts
journal.ts
contact.ts
faq.ts
seo.ts
commerce-labels.ts
studio-help.ts
```

Do not leave initial copy scattered across components.

---

# 52. STUDIO PAGE EDITOR REQUIREMENT

For EVERY seeded page, Studio must allow:

```text
Edit
Preview
Save Draft
Publish
Unpublish
Reorder Sections
Hide Section
Change Media
Change Mobile Media
Change CTA
Change SEO
```

Where scheduling exists:

```text
Publish At
Unpublish At
```

---

# 53. REVISION HISTORY

For high-value website content, support:

- updated_at
- updated_by
- published_at
- published_by

Prefer revision/version history for page content if architecture allows it cleanly.

---

# 54. INITIAL CONTENT AUDIT

Create:

`docs/content/INITIAL_CONTENT_INVENTORY.md`

Columns:

```text
Page
Section
Field
Seeded?
Editable?
Studio location
Fact verification needed?
Media asset ID
SEO status
Publication status
```

Target:

**100% of intended launch copy mapped to Studio editing controls.**

---

# 55. HARD CONTENT QUALITY RULE

Do not ship:

- lorem ipsum
- "Coming Soon" on primary pages
- generic AI buzzwords
- unverified superlatives
- fake awards
- fake clients
- fake testimonials
- fake projects
- fake sales numbers
- fake years of experience
- fake production capabilities
- fake material certifications

Use elegant draft marketing content, but preserve factual integrity.

---

# 56. CONTENT PRIORITY

The initial content hierarchy must remain:

```text
1. Large-format furniture
2. Collectible / sculptural furniture
3. 3D + resin
4. Statement art / architectural work
5. Preservation
6. Décor
7. Gifts
```

Home, About and other primary pages must NOT drift back into small gift-store positioning.

---

# 57. INITIAL DATA SEED DEFINITION OF DONE

Initial website content is COMPLETE only when:

- Homepage has finished first-pass copy
- About has finished first-pass copy
- Large Format has finished first-pass copy
- Collection landing has copy
- every category has copy
- Custom Commission page has copy
- Process page has copy
- Portfolio landing has safe copy
- Journal landing has copy
- Contact has copy
- FAQ has initial entries
- Navigation is seeded
- Footer is seeded
- CTAs are seeded
- Store UI labels are seeded
- Inquiry messages are seeded
- WhatsApp templates are seeded
- SEO defaults are seeded
- empty states are seeded
- Studio helper copy is seeded
- all content is stored in CMS/database
- all content is editable in Studio
- all media requirements have asset IDs
- all Higgsfield requirements have briefs
- no fictional product/project data is presented publicly
- owner-verification flags exist where needed

---

# FINAL CONTENT EXECUTION RULE

DO NOT finish the website architecture and leave content creation for later.

Content creation is part of implementation.

For every public page:

```text
Design page
↓
Define CMS schema
↓
Write initial content
↓
Seed content into Supabase
↓
Expose every field in Studio
↓
Define required media
↓
Create Higgsfield briefs
↓
Preview
↓
Review factual claims
↓
Publish approved content
```

The initial deployment must look and read like a coherent Rivya Living Art website, not an empty CMS demonstration.

At the same time:

**DO NOT fabricate products, client projects, prices, dimensions, material specifications, testimonials or manufacturing claims simply to make the website appear populated.**

Use strong initial brand/editorial content.

Keep factual product information owner-controlled.

Make every normal content field editable from Studio.

No code change should be required to update normal public website content.