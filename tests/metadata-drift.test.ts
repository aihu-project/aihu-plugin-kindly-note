import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf8')) as {
  name: string
  version: string
}
const readme = readFileSync(`${process.cwd()}/README.md`, 'utf8')

describe('published metadata seam', () => {
  it('keeps the release version in generated README facts', () => {
    expect(readme).toContain(`Auto-generated against \`${manifest.name}@${manifest.version}\`.`)
    expect(readme).toContain(`| **Version** | \`${manifest.version}\` |`)
  })
})
