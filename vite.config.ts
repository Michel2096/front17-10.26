import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const API = process.env.API_URL ?? 'http://localhost:3000'

/**
 * Tras el build, inyecta en dist/sw.js la lista de archivos generados (con hash) para
 * precachearlos, y una versión derivada de su contenido para invalidar cachés viejas.
 */
function precacheServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'precache-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const listar = (dir: string): string[] =>
        readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? listar(join(dir, e.name)) : [join(dir, e.name)],
        )
      const archivos = listar(outDir)
        .map((f) => '/' + relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== '/sw.js')
      const hash = createHash('sha256')
      for (const f of archivos) hash.update(f).update(readFileSync(join(outDir, f)))
      const swPath = join(outDir, 'sw.js')
      const sw = readFileSync(swPath, 'utf8')
        .replace("['__PRECACHE__']", JSON.stringify(archivos))
        .replace('__VERSION__', hash.digest('hex').slice(0, 10))
      writeFileSync(swPath, sw)
      console.log(`[precache-sw] ${archivos.length} archivos precacheados en sw.js`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), precacheServiceWorker()],
  server: { proxy: { '/api': API } },
  preview: { proxy: { '/api': API } },
})
