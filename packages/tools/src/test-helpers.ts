// Test-only subpath for @mux-magic/tools. Consumers import these via
// `@mux-magic/tools/test-helpers`. They live behind a separate subpath
// instead of the main barrel because they pull in `vitest`, which is a
// peer of the consumer's test runtime — production code that imports
// the main barrel must not transitively load `vitest`.
//
// `vitest` is declared as a devDependency of this package; consumers
// of `@mux-magic/tools/test-helpers` must have their own `vitest`
// installed (it will be present in every test runtime).
export { captureConsoleMessage } from "./captureConsoleMessage.js"
export { captureLogMessage } from "./captureLogMessage.js"
export {
  getOperatorValue,
  runPromiseScheduler,
  runTestScheduler,
} from "./test-runners.js"
