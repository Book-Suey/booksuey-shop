import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function collectVueFiles(dirPath: string): string[] {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...collectVueFiles(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.vue')) {
      files.push(fullPath)
    }
  }

  return files
}

describe('Admin pages SSR hydration guard', () => {
  it('does not disable SSR with server: false in admin page data loaders', () => {
    const adminPagesDir = path.resolve(process.cwd(), 'app/pages/admin')
    const files = collectVueFiles(adminPagesDir)

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8')

      expect(
        content,
        `Unexpected server:false in ${path.relative(process.cwd(), filePath)}`
      ).not.toMatch(/server:\s*false/)
    }
  })
})
