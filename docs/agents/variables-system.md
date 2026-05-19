# Variables system

The Builder's typed Variables (workers 35, 36, 28) let a sequence
reference the same value from multiple step fields. Each variable
declares a `type` (`path`, `dvdCompareId`, `threadCount`, ...) registered
in the [type registry](../../packages/web/src/components/VariableCard/registry.ts);
step fields link to a variable via `step.links.<fieldName> = <variableId>`
and serialize as `@<variableId>` in the YAML/request payload.

At run time, the `@id` reference is resolved to the variable's `.value`
in two places:

- **Client (single-step runs)** — `resolveParams` in
  [packages/web/src/state/runAtoms.ts](../../packages/web/src/state/runAtoms.ts).
  Resolves before POSTing to `/commands/:name`.
- **Server (full-sequence runs)** — `resolveSequenceParams` in
  [packages/api/src/api/resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts).
  Resolves each step's params just before invoking
  `config.getObservable(resolved)`.

Both paths walk **every** variable type, not just `path`. That used to
be filtered (`type === "path"`) and broke worker 35's `dvdCompareId`
linking — keep both resolvers type-agnostic.

## Runtime value type — string vs number

Variables always store `.value` as a string (the input control is a
text field). When a step field's schema is `z.number()` (today:
`dvdCompareId`, `threadCount`), the resolver must coerce or the
request hits zod with the wrong type.

Two coordinated declarations carry this:

| Side   | Where                                                                                                                | Form                                                              |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Client | [registry.ts](../../packages/web/src/components/VariableCard/registry.ts) — `VariableTypeDefinition.runtimeValueType` | `"string"` (default) \| `"number"`                                |
| Server | [resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts) — `NUMERIC_VARIABLE_TYPES`           | small `Set<string>` of type names that should be coerced          |

The server can't import from `packages/web`, so the type name is the
wire contract. Both sides key on the same string
(`"dvdCompareId"`, `"threadCount"`).

### Adding a new numeric variable type

When you register a new variable type whose target field is `z.number()`
(e.g. a future `tmdbId` / `malId` / `anidbId`):

1. **Client** — declare `runtimeValueType: "number"` on the type's
   `VariableTypeDefinition`. Without it, the client resolver passes the
   raw string straight to `JSON.stringify(body)` and zod rejects it.
2. **Server** — add the type's name to `NUMERIC_VARIABLE_TYPES` in
   [resolveSequenceParams.ts](../../packages/api/src/api/resolveSequenceParams.ts).
   Without it, full-sequence runs of the new type fail the same way
   single-step runs do.
3. **Tests** — add a coercion case to
   [resolveSequenceParams.test.ts](../../packages/api/src/api/resolveSequenceParams.test.ts)
   so a future refactor that drops the type from the set fails loudly.

Forgetting either side recreates the worker-35 bug — exactly: "expected
number, received string" on the field that links to the new variable.

### Why NaN falls through

Coercion uses `Number(value)`; non-finite results fall through as the
raw string. That matters for `dvdCompareId`: its validator accepts both
numeric IDs (`"68856"`) and DVD Compare slugs (`"spider-man-2002"`),
and the resolver runs before zod. Letting the raw string through means
zod's error names the offending value instead of reporting `NaN`,
which makes the bug self-explanatory in the UI.
