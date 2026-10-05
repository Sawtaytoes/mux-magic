# Standalone Builder cache warnings

The cache fallback used to reach only the server log when a Builder lookup ran
outside a job. Provider query responses now carry `providerCacheFallbacks`,
collected within the request's async context. The existing Charcuterie Alert shows
the provider, request, age, and failure cause in the lookup modal or beside a
reverse-lookup/title-picker field.

Search notices survive DVDCompare variant/release navigation, including a direct
listing. A cached single release remains visible for review rather than closing
automatically. A new search starts with an empty notice; a successful live retry
returns an empty fallback list. Network-first policy and job circuit scope remain
as specified in the September 29 decision.

## Browser evidence

The screenshots use invented MusicBrainz results in the standalone Builder modal.
Both are captured by `e2e/modals.spec.ts` with `CACHE_NOTICE_SCREENSHOTS=1`:

- [Before](before.png): the legacy response contract omits fallback metadata, so
  the result appears with no warning.
- [After](after.png): the response includes a two-day-old cached answer and the
  live failure cause, so the warning is visible before selection.

The same browser test retries with live data, verifies the notice disappears, and
selects the result. API regression tests overlap two requests and emit an unrelated
background fallback to prove response isolation; they also cover fresh responses
and errors after a fallback. Field tests cover typed IDs and AniDB title loading.

Concurrent AniDB ID lookups and anime searches share their network read. The
shared read also retains its fallback metadata, so every lookup receives the
warning. Regression tests prove both callers report the fallback while the
provider is requested only once. The existing server log and job report still
occur once in the originating scope.
