import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, {
  reactCompilerPreset,
} from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset({ target: "19" })],
    }),
    tailwindcss(),
  ],
  server: {
    open: true,
    port: 5173,
    strictPort: true,
  },
  build: {
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
