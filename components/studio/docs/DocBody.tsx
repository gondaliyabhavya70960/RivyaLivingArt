import Link from 'next/link'
import type { Route } from 'next'

import { Heading } from '@/components/primitives/Heading'
import { Text } from '@/components/primitives/Text'
import { t } from '@/components/studio/strings'
import type { Block, Inline, ListItem } from '@/lib/cms/docs/render'

/**
 * The block tree as React — Phase 38, RC-345. There is no HTML branch in the parser and no
 * `dangerouslySetInnerHTML` here, so a `<script>` in a document is text on the page. A doc link
 * becomes an in-app route, an anchor stays an anchor, and an external link is rendered as text
 * with its URL beside it and no `href` at all.
 */

const HEADING_SIZE = {
  1: 'display-md',
  2: 'display-sm',
  3: 'display-xs',
  4: 'display-xs',
  5: 'display-xs',
  6: 'display-xs',
} as const

function Inlines({ nodes }: { readonly nodes: readonly Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.kind) {
          case 'text':
            return <span key={index}>{node.text}</span>
          case 'code':
            return (
              <code key={index} className="bg-surface-raised-2 rounded-sm px-1 text-xs">
                {node.text}
              </code>
            )
          case 'strong':
            return (
              <strong key={index}>
                <Inlines nodes={node.children} />
              </strong>
            )
          case 'em':
            return (
              <em key={index}>
                <Inlines nodes={node.children} />
              </em>
            )
          case 'link': {
            const target = node.target
            if (target.kind === 'doc') {
              const href = `/studio/system/documentation/${target.key}${target.anchor === null ? '' : `#${target.anchor}`}`
              return (
                <Link key={index} href={href as Route} className="underline underline-offset-4">
                  <Inlines nodes={node.children} />
                </Link>
              )
            }
            if (target.kind === 'anchor') {
              return (
                <a key={index} href={`#${target.anchor}`} className="underline underline-offset-4">
                  <Inlines nodes={node.children} />
                </a>
              )
            }
            return (
              <span key={index} data-external-link={target.href}>
                <Inlines nodes={node.children} />
                <span className="text-ink-tertiary">
                  {' '}
                  ({t('studio.docs.external')}: {target.href})
                </span>
              </span>
            )
          }
        }
      })}
    </>
  )
}

function Items({
  items,
  ordered,
}: {
  readonly items: readonly ListItem[]
  readonly ordered: boolean
}) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={`my-2 pl-6 ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, index) => (
        <li key={index} className="my-1">
          <Text as="span" size="sm">
            <Inlines nodes={item.children} />
          </Text>
          {item.nested.length === 0 ? null : <Items items={item.nested} ordered={false} />}
        </li>
      ))}
    </Tag>
  )
}

export function DocBody({ blocks }: { readonly blocks: readonly Block[] }) {
  return (
    <div className="max-w-prose" data-doc-body="">
      {blocks.map((block, index) => {
        switch (block.kind) {
          case 'heading':
            return (
              <Heading
                key={index}
                level={block.level}
                size={HEADING_SIZE[block.level]}
                id={block.id}
                className="mt-6 mb-2"
              >
                <Inlines nodes={block.children} />
              </Heading>
            )
          case 'paragraph':
            return (
              <Text key={index} size="sm" className="my-2">
                <Inlines nodes={block.children} />
              </Text>
            )
          case 'code':
            return (
              <pre
                key={index}
                className="bg-surface-raised-2 my-3 overflow-x-auto rounded-sm p-3 text-xs"
                data-doc-code={block.language ?? ''}
              >
                {block.text}
              </pre>
            )
          case 'quote':
            return (
              <blockquote key={index} className="border-line my-3 border-l-2 pl-3">
                <Text size="sm" tone="secondary">
                  <Inlines nodes={block.children} />
                </Text>
              </blockquote>
            )
          case 'list':
            return <Items key={index} items={block.items} ordered={block.ordered} />
          case 'table':
            return (
              <div key={index} className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-line border-b">
                      {block.header.map((cell, cellIndex) => (
                        <th key={cellIndex} scope="col" className="px-2 py-1 align-top">
                          <Inlines nodes={cell} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-line border-b last:border-b-0">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="px-2 py-1 align-top">
                            <Inlines nodes={cell} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          case 'rule':
            return <hr key={index} className="border-line my-6" />
        }
      })}
    </div>
  )
}
