/**
 * Demo portfolio projects and testimonials.
 *
 * NEITHER CAN BE PUBLISHED, AND THAT IS THE POINT RATHER THAN A LIMITATION. `portfolio_projects`
 * carries `enforce_project_evidence_gate()` and `testimonials` carries
 * `enforce_testimonial_evidence_gate()`; the first refuses PUBLISHED until the owner has verified
 * the project actually happened, the second until the person quoted has granted consent. D10 names
 * delivered projects, named customers and testimonials among the things that may never be
 * fabricated, and a script cannot grant itself either permission.
 *
 * So these rows exist to give the Studio screens something to show — the project editor, the
 * verification panel, the testimonial list and the consent workflow all need a row to be exercised
 * against. They never reach the public site. `/portfolio` keeps rendering the seeded SEED §28 empty
 * state, which is the honest thing for it to say.
 *
 * NOBODY IS NAMED. Every testimonial below is attributed to a role and a city, never to a person:
 * inventing a customer's name is the sharpest version of what D10 forbids, and it would still be
 * that with `is_demo` set. The quotes are written as the KIND of thing a client says, so the owner
 * can see how the strip reads and then replace every word of it.
 */

export interface DemoProject {
  readonly slug: string
  readonly title: string
  readonly subtitle: string
  readonly summary: string
  readonly projectType: string
  readonly locationLabel: string
}

export const DEMO_PROJECTS: readonly DemoProject[] = [
  {
    slug: 'demo-apartment-dining-room',
    title: 'Apartment Dining Room',
    subtitle: 'A dining table developed for a room with one long window',
    summary:
      'A placeholder project record. The brief, the constraints and the outcome are written here so the project editor and the verification panel have something to work against.',
    projectType: 'Dining table',
    locationLabel: 'Placeholder location',
  },
  {
    slug: 'demo-studio-reception',
    title: 'Studio Reception',
    subtitle: 'A console and a wall piece developed together',
    summary:
      'A placeholder project record covering two pieces in one space, so the gallery panel can be seen holding more than one asset role.',
    projectType: 'Console and wall piece',
    locationLabel: 'Placeholder location',
  },
  {
    slug: 'demo-stairwell-wall-piece',
    title: 'Stairwell Wall Piece',
    subtitle: 'A vertical composition for a double-height wall',
    summary:
      'A placeholder project record for a wall commission, so the story page template can be seen with a project that has no furniture in it.',
    projectType: 'Wall piece',
    locationLabel: 'Placeholder location',
  },
  {
    slug: 'demo-family-preservation',
    title: 'Family Preservation Commission',
    subtitle: 'Wedding garlands divided between three households',
    summary:
      'A placeholder project record for a preservation brief. Kept deliberately unspecific: what is possible depends entirely on the flowers, and a placeholder must not suggest otherwise.',
    projectType: 'Preservation',
    locationLabel: 'Placeholder location',
  },
  {
    slug: 'demo-workspace-desk',
    title: 'Workspace Desk',
    subtitle: 'A single-slab desk for a room used every day',
    summary:
      'A placeholder project record for a working piece rather than a display piece, so the archive is not made entirely of statement objects.',
    projectType: 'Desk',
    locationLabel: 'Placeholder location',
  },
  {
    slug: 'demo-gallery-installation',
    title: 'Gallery Installation',
    subtitle: 'Large-format work installed for a fixed period',
    summary:
      'A placeholder project record at installation scale, so the archive shows the range the studio describes rather than one repeated kind of commission.',
    projectType: 'Installation',
    locationLabel: 'Placeholder location',
  },
]

export interface DemoTestimonial {
  readonly attributedTo: string
  readonly attributionRole: string
  readonly quote: string
}

export const DEMO_TESTIMONIALS: readonly DemoTestimonial[] = [
  {
    attributedTo: 'Placeholder client',
    attributionRole: 'Dining table commission',
    quote:
      'Placeholder testimonial. Replace this with the client’s own words once they have given consent to be quoted.',
  },
  {
    attributedTo: 'Placeholder client',
    attributionRole: 'Wall piece commission',
    quote:
      'Placeholder testimonial. Nothing here was said by anyone; it exists so the strip can be seen with more than one card in it.',
  },
  {
    attributedTo: 'Placeholder client',
    attributionRole: 'Preservation commission',
    quote:
      'Placeholder testimonial. A preservation quote is the one most likely to be personal, which is why the consent workflow gates it.',
  },
  {
    attributedTo: 'Placeholder client',
    attributionRole: 'Console commission',
    quote:
      'Placeholder testimonial. Long enough to show how a card handles two lines of text and no longer.',
  },
  {
    attributedTo: 'Placeholder studio',
    attributionRole: 'Interior design practice',
    quote:
      'Placeholder testimonial from a trade relationship rather than a private client, so both kinds of attribution can be seen.',
  },
  {
    attributedTo: 'Placeholder client',
    attributionRole: '3D and resin commission',
    quote:
      'Placeholder testimonial. Attach this to a project once the project itself has been verified.',
  },
]
