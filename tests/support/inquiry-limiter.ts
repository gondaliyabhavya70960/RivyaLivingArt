import pg from 'pg'

/**
 * Clear the enquiry rate-limit buckets for this machine.
 *
 * THE LIMITER FINDS THIS SUITE BEFORE THIS SUITE FINDS ANYTHING. Phase 41's rule is five enquiries
 * per ten minutes and ten per hour from one connection, and every browser project runs from the
 * same address — `127.0.0.1`, or whatever single value `addressFromHeaders` falls back to when
 * nothing forwarded the request. So the eight width projects submitting the same three enquiries
 * are, to the limiter, one very determined visitor: the ninth submission of a run is refused with
 * "several enquiries from this connection in a short time", and the test that gets it reports a
 * conversion path that is in fact working perfectly.
 *
 * THE LIMIT IS REAL AND MUST NOT BE RELAXED, so the suite resets the counter instead — the same
 * thing waiting ten minutes would do, minus the ten minutes. Spoofing `x-forwarded-for` per test
 * would also work and is worse: `addressFromHeaders` reads the LAST entry precisely so that a
 * caller cannot mint itself a fresh bucket, and a suite that mints them anyway is a suite that
 * would keep passing if that rule were ever removed.
 *
 * `bucket_key` is `<surface>:<ip hash>` and the enquiry surface is `inq`, so this leaves the
 * `vitals`, `csp_report` and `inq_upload` buckets alone. Matched with the colon rather than by
 * prefix, so `inq_upload` is not swept up with it.
 */
export async function clearInquiryRateLimit(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  try {
    await client.query("delete from rate_limit_buckets where bucket_key like 'inq:%'")
  } finally {
    await client.end()
  }
}
