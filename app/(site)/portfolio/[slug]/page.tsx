import type { Metadata } from 'next'
import * as React from 'react'

import { JsonLd } from '@/components/patterns/JsonLd'
import { LazyModelViewerMount } from '@/components/patterns/ModelViewerMount/lazy'
import { Container } from '@/components/primitives/Container'
import { cmsPageMetadata, renderCmsPage } from '@/lib/cms/render-page'
import { entityBreadcrumbs } from '@/lib/seo/breadcrumbs'
import { graphOf } from '@/lib/seo/jsonld'
import { optionalEnv } from '@/lib/env'
import { isEnabled } from '@/lib/flags'
import { getSiteChrome } from '@/lib/site/chrome'
import { NotFoundError } from '@/lib/supabase/errors'
import { createPublicClient } from '@/lib/supabase/public'
import { listMaterials } from '@/lib/supabase/repositories/materials'
import { listModelIdsForProject, loadPublicModel } from '@/lib/supabase/repositories/models'
import { getProjectBySlug, listPublishedProjects } from '@/lib/supabase/repositories/portfolio'
import { prerenderParams } from '@/lib/site/prerender'

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
 *
 * A MISSING TABLE IS AN EMPTY LIST, NOT A FAILED BUILD, and that was learned the hard way: the first
 * deploy of this route brought the WHOLE SITE's build down with
 * `Failed to collect page data for /portfolio/[slug]`, because `portfolio_projects` existed locally
 * and not yet on the hosted database. One table being a migration behind should cost this route its
 * pre-rendering, not every other page its deployment.
 *
 * IT USED TO SWALLOW ONLY THE MISSING-TABLE CODES, and said so here: *any other failure — a broken
 * policy, a bad column, a connection refused — still throws and still fails the build, because
 * those are faults nobody should discover from an empty portfolio.* That objection is right, and
 * `prerenderParams` answers it a better way than a failed deployment does: the fault is announced
 * in the build log, named, with the route and the cause beside the routes that did pre-render. It
 * is discovered — just not by taking the whole site's deploy down.
 *
 * What forced the change is that the narrow predicate did not hold. A database `Gateway Timeout` is
 * not a missing table, so the guard never fired, and `Failed to collect page data` brought the build
 * down four more times — the same failure this comment was written about, through the one door it
 * left open. The paragraph above already conceded the decisive half: *this is only the pre-render
 * list; `dynamicParams` still renders on request, and the same visibility rule applies there, so
 * nothing becomes reachable that would not otherwise have been.* If correctness is unaffected, a
 * failed build is the costlier way to report a fault. See ROADMAP E9 and `lib/site/prerender.ts`.
 */
export async function generateStaticParams(): Promise<Params[]> {
  return prerenderParams('/portfolio/[slug]', async () => {
    const projects = await listPublishedProjects(createPublicClient())
    return projects.map((project) => ({ slug: project.slug.toLowerCase() }))
  })
}

/** The project, or null — one read shared by the metadata, the trail and the model mount. */
async function projectFor(slug: string) {
  try {
    return await getProjectBySlug(createPublicClient(), slug)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const project = await projectFor(slug)
  return cmsPageMetadata(pathFor(slug), {
    ...(project === null
      ? {}
      : {
          entity: {
            type: 'portfolio_projects',
            id: project.id,
            description: project.summary,
            ogMediaId: project.hero_media_id,
          },
        }),
  })
}

export default async function ProjectPage({ params }: Props): Promise<React.ReactElement> {
  const { slug } = await params
  const path = pathFor(slug)
  const project = await projectFor(slug)
  /*
   * Phase 39: `BreadcrumbList` only. There is no `CreativeWork` or `Project` node for a delivered
   * project — a project page is a claim that Rivya delivered work, held to the database's own
   * evidence gate, and structured data about it would republish that claim to a machine that
   * cannot see the gate. The trail is home → the portfolio listing (while live) → this project.
   */
  const trail =
    project === null
      ? null
      : await entityBreadcrumbs({
          listingPath: '/portfolio',
          entityName: project.title,
          entityPath: path,
        })
  return (
    <>
      <JsonLd graph={graphOf([trail])} />
      {await renderCmsPage(path, await projectModel(slug))}
    </>
  )
}

/**
 * The Phase 21 mount: the first published model associated with this project, after the story's
 * sections. Null — and nothing rendered — when the flag is off, the project has no model, or the
 * model is not public with a poster. A project's page is a CMS page, so the mount arrives as the
 * page's trailing child rather than as a block: associating a model is a media decision made in
 * `/studio/media/models`, not an editorial one made on the page.
 */
async function projectModel(slug: string): Promise<React.ReactNode> {
  if (!(await isEnabled('three_d_viewer'))) return null
  const client = createPublicClient()
  let project
  try {
    project = await getProjectBySlug(client, slug)
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
  const modelId = (await listModelIdsForProject(client, project.id))[0]
  if (modelId === undefined) return null
  const [model, materials, chrome] = await Promise.all([
    loadPublicModel(client, modelId),
    listMaterials(client),
    getSiteChrome(),
  ])
  if (model === null) return null
  return (
    <Container>
      <LazyModelViewerMount
        model={model}
        materials={materials}
        dimensions={null}
        title={project.title}
        strings={chrome.strings}
        cloudName={optionalEnv('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME') ?? ''}
        enabled
        ratio="16:9"
        sizes="(min-width: 1024px) 80vw, 100vw"
      />
    </Container>
  )
}
