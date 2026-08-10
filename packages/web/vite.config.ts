import { precompressAssets } from "@charcuterie/server/vite"
import { createViteConfig } from "@charcuterie/vite-config"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"

export default createViteConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tailwindcss(),
    // Writes the `.br`/`.gz` siblings that `createStaticHandler` in
    // packages/server looks for. Build time, not request time — the
    // bytes are identical for every visitor and change only when the
    // build does, so Brotli quality 11 is affordable exactly once.
    precompressAssets(),
  ],
  server: {
    open: true,
    port: 5173,
    strictPort: true,
  },
  build: {
    // The shared base turns `sourcemap` on. Off here, deliberately: the
    // build ships inside the runtime image and `precompressAssets()` runs
    // Brotli-11 over everything it emits, so the maps cost far more than
    // they do in a repo that serves them from a dev host — measured, `dist/`
    // goes 1.7 MB -> 5.8 MB (118 map files, plus their .br/.gz siblings).
    sourcemap: false,
    rollupOptions: {
      output: {
        // Worker 79 split `js-yaml` (~big) out of the main chunk by
        // lazy-importing `yamlCodec`. Several eager modules
        // (useBuilderActions, BuilderPage's URL sync) need it
        // synchronously though, so a dynamic import there only tripped
        // rolldown's INEFFECTIVE_DYNAMIC_IMPORT warning without moving
        // anything. Forcing `yamlCodec` + `js-yaml` into their own chunk
        // here keeps them out of `index-*.js` (preserving the build
        // budget) while every consumer imports them statically — no
        // ineffective dynamic edges left to warn about.
        manualChunks(id) {
          if (
            id.includes("/src/jobs/yamlCodec") ||
            id.includes("/node_modules/js-yaml/")
          ) {
            return "yamlCodec"
          }
        },
      },
    },
  },
})
