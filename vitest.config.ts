import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  root: undefined,
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './vitest.setup.ts',
    alias: {
      '@/': new URL('./client/src/', import.meta.url).pathname,
      '@shared/': new URL('./shared/', import.meta.url).pathname,
    },
  },
}))
