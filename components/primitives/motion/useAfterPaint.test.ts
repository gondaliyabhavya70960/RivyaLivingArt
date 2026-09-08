import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

import { useAfterPaint } from './useAfterPaint'

/**
 * The gate that keeps the hero's motion layer out of the first frame.
 *
 * THE SERVER ANSWER IS THE ONE THAT MATTERS MOST. If this ever returned `true` during SSR, a
 * `<video>` would be in the server HTML and would compete with the still for the connection —
 * which is the exact failure the whole component exists to prevent, and it would not be visible
 * in any screenshot.
 *
 * THE MODULE-LEVEL FLAG IS DELIBERATE AND MAKES THESE TESTS ORDER-DEPENDENT, so the file resets it
 * between cases with `vi.resetModules()` and a fresh import. "This document has painted" is a fact
 * about the page rather than about a component; a per-instance flag would make a second hero wait
 * two more frames for something that already happened.
 */

/** Runs queued animation-frame callbacks on demand, one frame at a time. */
function installFrames(): { advance: () => void } {
  let queue: FrameRequestCallback[] = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})

  return {
    advance: () => {
      const due = queue
      queue = []
      act(() => {
        for (const cb of due) cb(0)
      })
    },
  }
}

function Probe({ hook }: { hook: () => boolean }): React.ReactElement {
  return React.createElement('p', null, String(hook()))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('useAfterPaint', () => {
  it('is false on the server', () => {
    const html = renderToStaticMarkup(React.createElement(Probe, { hook: useAfterPaint }))
    expect(html).toBe('<p>false</p>')
  })

  it('stays false until a paint has actually happened', async () => {
    const frames = installFrames()
    // A fresh module instance, because the painted flag is module-level by design: without this
    // the second test in this file would start with the first test's paint already recorded.
    vi.resetModules()
    const { useAfterPaint: fresh } = await import('./useAfterPaint')

    render(React.createElement(Probe, { hook: fresh }))
    expect(screen.getByText('false')).toBeInTheDocument()

    // ONE frame is not enough: a callback scheduled with `requestAnimationFrame` runs BEFORE the
    // paint it was scheduled against, so the flag must not flip here.
    frames.advance()
    expect(screen.getByText('false')).toBeInTheDocument()

    frames.advance()
    expect(screen.getByText('true')).toBeInTheDocument()
  })

  it('reports true immediately once the document has painted', async () => {
    const frames = installFrames()
    vi.resetModules()
    const { useAfterPaint: fresh } = await import('./useAfterPaint')

    const first = render(React.createElement(Probe, { hook: fresh }))
    frames.advance()
    frames.advance()
    first.unmount()

    // A second consumer on the same page does not wait two more frames for a paint that has
    // already happened.
    render(React.createElement(Probe, { hook: fresh }))
    expect(screen.getByText('true')).toBeInTheDocument()
  })
})
