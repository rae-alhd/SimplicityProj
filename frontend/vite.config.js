import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { normalizeApiUrl } from './src/config/validateApiUrl.js'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Task Q1.1: frontend (Vercel) and backend (Render) are deployed
  // separately, so a production build with no real API URL configured
  // would ship silently broken (or, worse, quietly pointed at the
  // Vercel origin itself). `command === 'build'` is what `vite build`
  // (this project's `npm run build`, and Vercel's own build step) passes
  // — `vite` (dev server) and Vitest both pass `command === 'serve'`, so
  // neither `npm run dev` nor the test suite ever hits this check, and
  // local development keeps its convenient localhost fallback (handled
  // in src/config/api.js, not here). `mode !== 'test'` is a second,
  // explicit belt-and-suspenders guard — if anything ever runs an actual
  // `vite build --mode test`, that's still not a real deployment either.
  if (command === 'build' && mode !== 'test') {
    const env = loadEnv(mode, process.cwd(), '')
    const result = normalizeApiUrl(env.VITE_API_URL)

    if (!result.ok) {
      throw new Error(
        `VITE_API_URL is required for a production build. ${result.detail} ` +
        'Set it to your deployed backend\'s API base URL, including the ' +
        '/api path (e.g. https://your-backend-name.onrender.com/api) — ' +
        'see frontend/.env.example and DEPLOYMENT_GUIDE.md.'
      )
    }
  }

  return {
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: false,
      coverage: {
        provider: 'v8',
        // Report against the whole frontend source tree, not just the files
        // this test suite happens to import — an honest coverage number,
        // not an inflated one. main.jsx is the Vite bootstrap entry point
        // (mounts <App /> to the DOM), analogous to the backend's
        // src/server.js exclusion.
        include: ['src/**/*.{js,jsx}'],
        exclude: ['src/main.jsx', 'src/**/*.test.{js,jsx}', 'src/test/**'],
      },
    },
  }
})
