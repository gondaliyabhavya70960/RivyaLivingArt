import type { SeedModule, SeedRecord } from './types'

/**
 * The words the bespoke configurator's own controls use.
 *
 * A MODULE OF ITS OWN, FOLLOWING `journal-ui.ts`, `portfolio-ui.ts` AND `product-detail-ui.ts`.
 * Not one of these sentences is quoted from the specification: every one names a control this phase
 * invented — a progress indicator, a Back button, the heading over a review screen. D2 leaves no
 * room for typing them into JSX, and `scripts/cms/check-section-copy.ts` fails the build over it.
 *
 * THE QUESTIONS THEMSELVES ARE NOT HERE. A step's title and a field's label live in
 * `customization_form_steps` and `customization_form_fields`, which is the entire point of Phase 19:
 * changing what the form asks is an editorial act with no deploy. What is here is the CHROME around
 * the questions, which is the same on every form and would be eleven copies of the same string if it
 * lived in the form definition.
 *
 * FOUR OF THEM CARRY A PLACEHOLDER, and each is a whole sentence rather than fragments glued in
 * JSX, for the reason `journal.reading_time` gives: an owner must be able to reword or reorder it,
 * and a language that puts the number first must be able to.
 *
 * NOTHING HERE MENTIONS PRICE, COST, QUOTE OR ESTIMATE. `tests/unit/no-pricing.test.ts` reads this
 * file among others. The submit label is not here either — it is `CTA.send_an_enquiry`, already
 * seeded, and named by `customization_forms.submit_label_key` so the site's action vocabulary has
 * one copy.
 *
 * EVERY ROW IS `EDITORIAL_COPY` / `NOT_REQUIRED` AND SEEDS PUBLISHED. They name controls; a Next
 * button with no name is not a button, and gating the configurator's navigation behind owner
 * verification would make the form unusable while telling the owner nothing they could act on.
 */

function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const configuratorUiSeed: SeedModule = {
  name: 'configurator-ui',
  description: 'Phase 19 configurator chrome: progress, navigation, upload and review controls.',
  records: [
    uiRow(
      'configurator.progress',
      'Step {{current}} of {{total}}',
      'Configurator — progress indicator',
      'Above the current step. A whole sentence rather than two numbers and a word, so it can be reworded or reordered without a code change.',
    ),
    uiRow(
      'configurator.progress.label',
      'Your brief',
      'Configurator — progress region name',
      'The accessible name of the progress indicator. Without it a screen reader announces a number with no subject.',
    ),
    uiRow(
      'configurator.next',
      'Continue',
      'Configurator — advance to the next step',
      'Deliberately not "Next": it says what happens rather than naming a direction, which reads better on the step before the review.',
    ),
    uiRow(
      'configurator.back',
      'Back',
      'Configurator — return to the previous step',
      'Returns to the previous step without losing anything typed. Absent on the first step, where there is nowhere to go back to.',
    ),
    uiRow(
      'configurator.review',
      'Review your brief',
      'Configurator — the review step heading',
      'The final screen before submitting. It lists every answer given and nothing else; it states no price, because nothing in this system calculates one.',
    ),
    uiRow(
      'configurator.review.edit',
      'Edit',
      'Configurator — jump back to a step from the review',
      'Beside each group on the review screen. Returns to that step rather than starting again.',
    ),
    uiRow(
      'configurator.review.empty',
      'Nothing answered yet.',
      'Configurator — review screen with no answers',
      'Shown when a visitor reaches the review having skipped every optional question. Says what is true rather than showing an empty box.',
    ),
    uiRow(
      'configurator.optional',
      'Optional',
      'Configurator — marks a field that may be left blank',
      'Most of the brief is optional. Marking the optional ones rather than the required ones matches the form: a visitor should feel able to answer only what they know.',
    ),
    uiRow(
      'configurator.required',
      'Required',
      'Configurator — marks a field that must be answered',
      'Rendered beside the label, never as an asterisk alone: an asterisk is not announced by every screen reader and means nothing to a first-time visitor.',
    ),
    uiRow(
      'configurator.upload.choose',
      'Add reference images',
      'Configurator — the file picker',
      'References are optional and always have been. The wording invites rather than instructs.',
    ),
    uiRow(
      'configurator.upload.hint',
      'Up to {{count}} files, {{size}} each. JPEG, PNG, WebP, HEIC or PDF.',
      'Configurator — upload limits',
      'Stated before the visitor picks a file rather than after the upload fails. The numbers are substituted from the server’s own limits so the sentence cannot drift from what is enforced.',
    ),
    uiRow(
      'configurator.upload.remove',
      'Remove {{filename}}',
      'Configurator — remove an uploaded reference',
      'The accessible name of the remove control. It names the file, because a list of identical "Remove" buttons is unusable by keyboard or screen reader.',
    ),
    uiRow(
      'configurator.upload.uploading',
      'Uploading…',
      'Configurator — upload in progress',
      'Replaces the picker while a file is on its way. Not a percentage: a direct-to-provider upload reports no reliable progress.',
    ),
    uiRow(
      'configurator.saved',
      'Your answers are kept on this device until you send them.',
      'Configurator — draft persistence notice',
      'Explains why a refresh does not lose the brief. It says "on this device" because that is the truth: nothing is saved to Rivya until the brief is sent, and no account exists.',
    ),
    uiRow(
      'configurator.step.errors',
      'Please check the highlighted answers before continuing.',
      'Configurator — per-step validation summary',
      'Shown above the step when Continue is pressed with something missing. Distinct from FORM_COPY.error.generic, which is the whole-form message on submit.',
    ),
  ],
}
