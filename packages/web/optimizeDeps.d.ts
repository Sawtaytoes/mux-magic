/**
 * `optimizeDeps.js` is plain JavaScript so that
 * `charcuterie-check-optimize-deps` can import it from a plain Node
 * process, which cannot load a TypeScript Vitest config. This
 * declaration is what lets `vitest.config.ts` import it without the
 * type-aware lint rules seeing an untyped value.
 */
export declare const optimizeDepsInclude: readonly string[]
