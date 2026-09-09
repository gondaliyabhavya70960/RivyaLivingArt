import * as React from 'react'

import { Stack } from '@/components/primitives/Stack'
import { Text } from '@/components/primitives/Text'
import { t, type StudioStringKey } from '@/components/studio/strings'
import { unmetGates, type PublishGate } from '@/lib/portfolio/gates'

/**
 * Why this cannot be published yet, said before anyone presses the button.
 *
 * THE TRIGGERS ARE THE ENFORCEMENT; THIS IS THE EXPLANATION. `enforce_project_evidence_gate` and
 * `enforce_testimonial_evidence_gate` refuse in the database and cannot be bypassed — but an editor
 * who presses Publish and gets "that change could not be saved" learns nothing they can act on. The
 * useful sentence is "this names a client, and their consent is not recorded as granted", shown
 * next to the field that fixes it, before the request is ever made.
 *
 * IT LISTS ONLY WHAT IS UNMET. A checklist of satisfied conditions is noise on a page whose job is
 * to answer one question: what is stopping this. When nothing is stopping it, the panel says so in
 * one line rather than showing an empty list.
 *
 * IT SAYS WHO CAN CLEAR EACH ONE, because "you cannot publish this" and "you cannot publish this and
 * you are not the person who can fix it" are different messages, and only the second tells an editor
 * to go and ask somebody. Owner verification and consent are both owner/admin decisions.
 *
 * THE GATES COME FROM `lib/portfolio/gates.ts`, WHICH IS TESTED AGAINST THE DATABASE.
 * `tests/unit/rls/phase17.test.ts` asks that module whether a row should publish, then asks Postgres
 * to publish the same row, and requires the answers to match across every combination. So a panel
 * that says "ready" is not a guess — it is the same verdict the trigger will reach.
 */

export interface OwnerVerificationPanelProps {
  readonly gates: readonly PublishGate[]
}

/** The Studio string for one gate. A closed map, so an unhandled gate fails the build. */
const GATE_COPY: Record<PublishGate['id'], StudioStringKey> = {
  owner_verification: 'studio.verification.gate.owner_verification',
  client_consent: 'studio.verification.gate.client_consent',
  attribution_consent: 'studio.verification.gate.attribution_consent',
  consent_withdrawn: 'studio.verification.gate.consent_withdrawn',
}

export function OwnerVerificationPanel({ gates }: OwnerVerificationPanelProps): React.ReactElement {
  const blocking = unmetGates(gates)

  return (
    <Stack gap={3} data-verification-panel="">
      <Text size="sm" tone="secondary">
        {t('studio.verification.heading')}
      </Text>

      {blocking.length === 0 ? (
        <Text size="sm" data-verification-ready="">
          {t('studio.verification.ready')}
        </Text>
      ) : (
        <ul role="list" className="list-none p-0">
          {blocking.map((gate) => (
            <li
              key={gate.id}
              className="border-b border-line py-2"
              data-verification-gate={gate.id}
            >
              <Stack gap={1}>
                <Text size="sm">{t(GATE_COPY[gate.id])}</Text>
                {gate.ownerOnly ? (
                  <Text size="sm" tone="secondary">
                    {t('studio.verification.ownerOnly')}
                  </Text>
                ) : null}
              </Stack>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  )
}
