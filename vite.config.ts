import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from 'vue/compiler-sfc'

import { cloudflare } from '@cloudflare/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    // `compiler` is passed explicitly (rather than left for the plugin to
    // lazily resolve on its own `buildStart`) to avoid a race with
    // @cloudflare/vite-plugin's multi-environment dev server: a file-change
    // event can call the Vue plugin's hot-update handler before its own
    // buildStart has run, crashing with "Cannot read properties of null
    // (reading 'invalidateTypeCache')" because its internal compiler
    // reference is still unset at that point. Passing it up front means it's
    // never null, regardless of hook ordering.
    {
      ...vue({ compiler: vueCompiler }),
      // Also scope it away from the Worker environment, which never
      // contains .vue files and doesn't need this plugin at all.
      applyToEnvironment: (env) => env.name === 'client',
    },
    cloudflare(),
  ],
})
