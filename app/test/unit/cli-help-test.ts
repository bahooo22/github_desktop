import assert from 'node:assert'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, it } from 'node:test'

import {
  formatCliUsage,
  getUserDataPath,
  readPreferredLanguage,
} from '../../src/cli/help'
import { createTempDirectory } from '../helpers/temp'

describe('CLI help', () => {
  it('places the Windows data directory under APPDATA', () => {
    assert.strictEqual(
      getUserDataPath(
        'win32',
        'GitHub Desktop',
        { APPDATA: join('C:', 'Roaming') },
        join('C:', 'Users', 'me')
      ),
      join('C:', 'Roaming', 'GitHub Desktop')
    )
  })

  it('places the macOS data directory under Application Support', () => {
    assert.strictEqual(
      getUserDataPath('darwin', 'GitHub Desktop', {}, '/Users/me'),
      join('/Users/me', 'Library', 'Application Support', 'GitHub Desktop')
    )
  })

  it('honours XDG_CONFIG_HOME on Linux', () => {
    assert.strictEqual(
      getUserDataPath(
        'linux',
        'GitHub Desktop',
        { XDG_CONFIG_HOME: '/cfg' },
        '/home/me'
      ),
      join('/cfg', 'GitHub Desktop')
    )
  })

  it('reads the language chosen in the application', async t => {
    const directory = await createTempDirectory(t)
    const catalogs = join(directory, 'localizations')
    await mkdir(catalogs)
    await writeFile(
      join(catalogs, 'settings.json'),
      JSON.stringify({ language: 'tlh' }),
      'utf8'
    )

    assert.strictEqual(readPreferredLanguage(directory), 'tlh')
  })

  it('treats a missing or broken settings file as no choice', async t => {
    const directory = await createTempDirectory(t)
    assert.strictEqual(readPreferredLanguage(directory), null)

    const catalogs = join(directory, 'localizations')
    await mkdir(catalogs)
    await writeFile(join(catalogs, 'settings.json'), '{', 'utf8')
    assert.strictEqual(readPreferredLanguage(directory), null)

    await writeFile(
      join(catalogs, 'settings.json'),
      JSON.stringify({ language: 42 }),
      'utf8'
    )
    assert.strictEqual(readPreferredLanguage(directory), null)
  })

  it('aligns descriptions and indents the wrapped hint', () => {
    const messages = new Map([
      ['cli.help-usage', 'Usage:'],
      ['cli.help-open-current', 'Open the current directory'],
      ['cli.help-open-path', 'Open the provided path'],
      ['cli.help-clone', 'Clone the repository'],
      ['cli.help-clone-hint', 'first line\nsecond line'],
    ])
    const text = formatCliUsage('github', key => messages.get(key) ?? key)

    assert.strictEqual(
      text,
      'Usage:\n' +
        '  github'.padEnd(36) +
        'Open the current directory\n' +
        '  github open [path]'.padEnd(36) +
        'Open the provided path\n' +
        '  github clone [-b branch] <url>'.padEnd(36) +
        'Clone the repository\n' +
        ' '.repeat(36) +
        'first line\n' +
        ' '.repeat(36) +
        'second line\n'
    )
  })
})
