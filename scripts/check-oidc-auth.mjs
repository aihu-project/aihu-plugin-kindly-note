import { existsSync, readFileSync } from 'node:fs'

const forbiddenEnv = ['NPM_TOKEN', 'NODE_AUTH_TOKEN']
for (const name of forbiddenEnv) {
  if (process.env[name]) throw new Error(`${name} must be empty; npm trusted publishing uses GitHub OIDC`)
}
for (const [name, value] of Object.entries(process.env)) {
  if (value && /^npm_config_.*authToken$/i.test(name)) {
    throw new Error(`${name} must be empty; npm trusted publishing uses GitHub OIDC`)
  }
}

const configPaths = [
  new URL('../.npmrc', import.meta.url).pathname,
  process.env.NPM_CONFIG_USERCONFIG,
].filter(Boolean)
for (const file of configPaths) {
  if (!existsSync(file)) continue
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const match = line.match(/^\s*[^#;]*_authToken\s*=\s*(.*?)\s*$/i)
    if (!match) continue
    const value = match[1].replace(/^['"]|['"]$/g, '')
    if (value && value !== '${NODE_AUTH_TOKEN}' && value !== '${NPM_TOKEN}') {
      throw new Error(`classic npm token found in ${file}; trusted publishing requires OIDC`)
    }
  }
}

console.log('classic npm token checks passed; release may use npm trusted publishing')
