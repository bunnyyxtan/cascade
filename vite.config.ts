import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import type { Plugin } from 'vite'

/**
 * rawMarkdown — resolves `*.md?raw` imports in both dev and build.
 *
 * Vite's built-in ?raw handler works for files it already knows how to
 * resolve, but treats .md as "unknown" and tries to parse it as JS first.
 * This plugin intercepts the transform step for any id ending in `.md` that
 * was requested with the `?raw` query and returns the file's text content
 * as a default export, which is exactly what `?raw` semantics promise.
 */
function rawMarkdown(): Plugin {
  return {
    name: 'raw-markdown',
    enforce: 'pre',
    transform(_code, id) {
      if (!id.endsWith('.md') && !id.includes('.md?')) return
      // Match ids like /abs/path/to/file.md?raw or /abs/path/to/file.md
      const match = id.match(/^(.+\.md)(\?.*)?$/)
      if (!match) return
      const hasRawQuery = id.includes('?raw') || id.includes('&raw')
      if (!hasRawQuery) return
      const filePath = match[1]
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        // Escape for JS string: backslash, backtick, ${
        const escaped = content
          .replace(/\\/g, '\\\\')
          .replace(/`/g, '\\`')
          .replace(/\$\{/g, '\\${')
        return { code: `export default \`${escaped}\``, map: null }
      } catch {
        return null
      }
    },
  }
}

export default defineConfig({
  plugins: [rawMarkdown(), react(), nodePolyfills()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'wagmi',
      'wagmi/chains',
      'wagmi/connectors',
      'viem',
      'viem/chains',
      'connectkit',
      'lucide-react',
      'sonner',
      'vite-plugin-node-polyfills/shims/buffer',
      'vite-plugin-node-polyfills/shims/global',
      'vite-plugin-node-polyfills/shims/process',
    ],
  },
  server: {
    allowedHosts: true,
    cors: true,
  },
})
