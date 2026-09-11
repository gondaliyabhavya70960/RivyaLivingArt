import Link from 'next/link'
import type { Route } from 'next'
import { notFound } from 'next/navigation'

import { Heading } from '@/components/primitives/Heading'
import { Stack } from '@/components/primitives/Stack'
import { Surface } from '@/components/primitives/Surface'
import { Text } from '@/components/primitives/Text'
import { DocBody } from '@/components/studio/docs/DocBody'
import { StudioPage, studioMetadata } from '@/components/studio/StudioPage'
import { t } from '@/components/studio/strings'
import { requirePermission } from '@/lib/auth/require'
import { DOC_ALLOWLIST, isDocKey } from '@/lib/cms/docs/allowlist'
import { getIndexedDoc } from '@/lib/cms/docs/index'
import { headings, parseMarkdown } from '@/lib/cms/docs/render'

/**
 * `/studio/system/documentation/[docKey]` — Phase 38. The parameter is an allowlist KEY; an
 * unknown one is `notFound()` before anything is read, and nothing here touches the filesystem
 * with it. The body is the indexed, redacted Markdown rendered without raw HTML.
 */
const BASE_PATH = '/studio/system/documentation'

export const metadata = studioMetadata(BASE_PATH)

export default async function Page({ params }: { params: Promise<{ docKey: string }> }) {
  await requirePermission('system.docs.read')
  const { docKey } = await params
  if (!isDocKey(docKey)) notFound()
  const doc = getIndexedDoc(docKey)
  if (doc === null) notFound()

  const blocks = parseMarkdown(doc.body)
  const toc = headings(blocks).filter((heading) => heading.level <= 2)

  return (
    <StudioPage path={BASE_PATH}>
      <Stack gap={4}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Heading level={2} size="display-sm" data-doc-title={docKey}>
            {DOC_ALLOWLIST[docKey].title}
          </Heading>
          <Link href={BASE_PATH as Route} className="underline underline-offset-4">
            <Text as="span" size="xs">
              {t('studio.docs.backToIndex')}
            </Text>
          </Link>
        </div>
        <Text size="xs" tone="tertiary">
          {`${DOC_ALLOWLIST[docKey].path} · ${t('studio.docs.redactedNote')}`}
        </Text>
        {toc.length === 0 ? null : (
          <Surface level={1} className="p-4">
            <nav aria-label={t('studio.docs.contents')}>
              <ul className="m-0 list-none p-0 text-xs">
                {toc.map((heading) => (
                  <li key={heading.id} className={heading.level === 1 ? '' : 'pl-3'}>
                    <a href={`#${heading.id}`} className="underline underline-offset-4">
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Surface>
        )}
        <Surface level={1} className="p-6">
          <DocBody blocks={blocks} />
        </Surface>
      </Stack>
    </StudioPage>
  )
}
