import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
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
})
