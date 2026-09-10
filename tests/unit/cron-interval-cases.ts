/**
 * The six-hour minimum, as ONE table of expressions two implementations must both answer.
 *
 * A MODULE RATHER THAN A CONSTANT INSIDE ONE TEST FILE, because the two implementations now run in
 * two different vitest projects: the TypeScript in `unit`, which needs no cluster, and the SQL in
 * `rls`, which runs after the migrations. The whole value of the table is that BOTH are asked the
 * same rows, and a table copied into two files is a table that stops being the same one.
 *
 * Not a `.test.ts`, so neither project collects it as a suite.
 *
 * THE INTERESTING ANSWER IS 360, NOT 5. Anyone can see that a five-minute schedule is too frequent.
 * The rows worth having are the ones where a plausible reading gives the wrong number: `0 0,18` is
 * a SIX-hour gap across midnight rather than an eighteen-hour one inside the day, and `0x1 3` looks
 * like a daily schedule to JavaScript and like an unreadable expression to PostgreSQL.
 */

export interface IntervalCase {
  /** The expression as an operator would type it into the schedule form. */
  readonly expression: string
  /** What BOTH implementations must answer, in minutes. */
  readonly minutes: number
  /** Which rule decides it — what a future reader needs, rather than the arithmetic. */
  readonly why: string
}

/**
 * Every example the SQL function's own comments give, the phase document's refusal case, and the
 * three ways the two grammars could disagree.
 *
 * NOTHING HERE ASSERTS AN ANSWER THE DATABASE WOULD NOT GIVE. An integer literal too large for a
 * PostgreSQL `int` is the one input where the two differ — SQL raises inside the CHECK, TypeScript
 * refuses the field and answers 0 — so no row uses one. Both refuse the write; only the wording is
 * different, and a row asserting a number here would fail the database half for the wrong reason.
 */
export const INTERVAL_CASES: readonly IntervalCase[] = [
  {
    expression: '*/5 * * * *',
    minutes: 5,
    why: 'twelve minutes selected in the hour, five apart — the phase document’s refusal case',
  },
  {
    expression: '0 */6 * * *',
    minutes: 360,
    why: 'one minute, four hours six apart: exactly the floor, and therefore acceptable',
  },
  {
    expression: '0 */4 * * *',
    minutes: 240,
    why: 'the same shape one step too fast, which is the only reason 360 is a boundary worth having',
  },
  {
    expression: '0 0,18 * * *',
    minutes: 360,
    why: 'the wrap IS the answer: midnight to 18:00 is eighteen hours, 18:00 to midnight is six',
  },
  {
    expression: '0 0,1 * * *',
    minutes: 60,
    why: 'two adjacent hours — the gap inside the day, not the twenty-three-hour one around it',
  },
  {
    expression: '0,45 * * * *',
    minutes: 15,
    why: 'minutes wrap at 60 exactly as hours wrap at 24: 45 → 00 is fifteen minutes',
  },
  {
    expression: '0,30 3 * * *',
    minutes: 30,
    why: 'more than one minute selected means two fires inside one hour, whatever the hour says',
  },
  {
    expression: '0-10/5 * * * *',
    minutes: 5,
    why: 'a range with a step is a list of minutes like any other',
  },
  {
    expression: '30 3 * * *',
    minutes: 1440,
    why: 'one minute, one hour: at most once a day',
  },
  {
    expression: '0 2 * * *',
    minutes: 1440,
    why: 'the SQL comment’s own example — hours {2} is a daily schedule, not a two-hourly one',
  },
  {
    expression: '0 0 1 * *',
    minutes: 1440,
    why: 'a day-of-month restriction only ever makes a schedule less frequent, so it is ignored',
  },
  {
    expression: '0 3 * * 1',
    minutes: 1440,
    why: 'and so does a day-of-week restriction — neither can admit something that fires too often',
  },
  {
    expression: '  0   3   *   *   *  ',
    minutes: 1440,
    why: 'both sides trim and split on runs of whitespace, so padding changes nothing',
  },
  {
    expression: '0 24 * * *',
    minutes: 0,
    why: 'hour 24 is outside 0–23, and an out-of-range value is unreadable rather than clamped',
  },
  {
    expression: '0 0 * * * *',
    minutes: 0,
    why: 'six fields is not this grammar, and the sixth would be seconds — far below the floor',
  },
  {
    expression: 'not a cron',
    minutes: 0,
    why: 'three fields: unreadable, and unreadable is 0 so the CHECK refuses it',
  },
  {
    expression: '',
    minutes: 0,
    why: 'the empty string splits to one field, not five',
  },
  {
    expression: 'a b c d e',
    minutes: 0,
    why: 'five fields that are not numbers — the shape is right and the grammar is not',
  },
  {
    expression: '0x1 3 * * *',
    minutes: 0,
    why: 'JavaScript reads 0x1 as one; PostgreSQL’s ^[0-9]+$ reads nothing, so the answer is 0',
  },
  {
    expression: '0, 3 * * *',
    minutes: 0,
    why: 'a blank list item is null in SQL — not a zero, which is what Number("") would make it',
  },
  {
    expression: '0/ 3 * * *',
    minutes: 1440,
    why: 'an empty step is no step on both sides, so this is the daily schedule it looks like',
  },
]

export const label = (expression: string) => JSON.stringify(expression)
