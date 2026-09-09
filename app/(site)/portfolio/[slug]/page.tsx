import type { Metadata } from 'next'
import * as React from 'react'

import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { createPublicClient } from '@/lib/supabase/public'
import { listPublishedProjects } from '@/lib/supabase/repositories/portfolio'

/**
 * `/portfolio/[slug]` — one delivered project.
 *
 * IT RETURNS 404 FOR EVERY SLUG TODAY, and that is the phase's exit criterion rather than a gap.
 * `portfolio_projects` holds zero rows; a project exists because the owner entered one, verified it
 * happened, and — if it names a client — recorded that client's consent. Until then there is nothing
 * to show and the archive says so on `/portfolio`, in words SEED §28 supplies.
 *
 * A CMS PAGE, NOT A BESPOKE LAYOUT, exactly as `/collections/[slug]` is. A project's story is an
 * ordered block list on the `pages` row `portfolio_projects.page_id` names, rendered by the same
 * `renderCmsPage` that serves `/about`. `project-gallery` reads that project's photographs; every
 * other band is an ordinary block. If a project needs a new kind of band, that is a block — never a
 * branch in this file.
 *
 * THE PATH IS DERIVED, NOT STORED TWICE. `sync_project_page_path` (`0153`) writes
 * `'/portfolio/' || lower(slug)` onto the page whenever the slug or the link changes, so the URL a
 * visitor loads and the `pages.path` the resolver looks up are the same string by construction. The
 * slug is `citext`, so it is lowercased here too.
 *
 * ONE GATE, AND IT IS THE PAGE'S. `renderCmsPage` answers an unpublished page, or one with no live
 * sections, with a 404 — and that single rule covers every case, including a project whose consent
 * was withdrawn: the evidence gate archives the project row on the same statement, the status sync
 * carries ARCHIVED to its page, and the URL stops resolving. A person who withdraws consent does
 * not wait for a deploy.
 *
 * NO JSON-LD YET, DELIBERATELY. `CreativeWork` for a project would want a creator, a date and an
 * image, and every one of those is a business fact that is either absent or gated. Structured data
 * is read by machines that cannot see the page's carefulness, so this route emits none until there
 * is a project to describe — at which point it is a small addition with something true to say.
 */

type Params = { readonly slug: string }
type Props = { readonly params: Promise<Params> }

const pathFor = (slug: string) => `/portfolio/${slug.toLowerCase()}`

/**
 * Published projects only.
 *
 * The anonymous client is the filter, as everywhere else — nothing here says `status = 'PUBLISHED'`,
 * because RLS says it once in a policy, and the two evidence gates stand behind PUBLISHED. Today
 * this returns an empty list, so nothing is pre-rendered and nothing is reachable.
 */
export async function generateStaticParams(): Promise<Params[]> {
  const projects = await listPublishedProjects(createPublicClient())
  return projects.map((project) => ({ slug: project.slug.toLowerCase() }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return cmsPageMetadata(pathFor(slug))
}

export default async function ProjectPage({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  return renderCmsPage(pathFor(slug))
}
