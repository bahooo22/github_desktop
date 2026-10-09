import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  ensureItemIds,
  buildDefaultMenuTemplate,
  dedupeMenuAccessKeys,
} from '../../../src/main-process/menu'
import { registerBuiltInLocales } from '../../../src/lib/l10n/builtins'
import { localization } from '../../../src/lib/l10n/core'
import { currentPlatform } from '../../../src/lib/l10n/format'
import type { MenuLabelsEvent } from '../../../src/models/menu-labels'
import { enableCopilotAppHandoff } from '../../../src/lib/feature-flag'

registerBuiltInLocales()

/** Extract the Windows-style access key from a menu item label, if any. */
function getAccessKey(label: string): string | null {
  const m = label.match(/(?<!&)&([^&])/)
  return m ? m[1].toLowerCase() : null
}

type DuplicateAccessKey = {
  readonly menuPath: string
  readonly accessKey: string
  readonly firstLabel: string
  readonly secondLabel: string
}

/**
 * Recursively walk a menu template and collect any duplicate access keys
 * within the same submenu level.
 */
function findDuplicateAccessKeys(
  items: ReadonlyArray<Electron.MenuItemConstructorOptions>,
  menuPath = 'root'
): ReadonlyArray<DuplicateAccessKey> {
  const duplicates: DuplicateAccessKey[] = []
  const seenKeys = new Map<string, string>()

  for (const item of items) {
    if (item.type === 'separator') {
      continue
    }
    if (item.visible === false) {
      continue
    }

    const label = item.label
    if (label !== undefined) {
      const accessKey = getAccessKey(label)
      if (accessKey !== null) {
        const existingLabel = seenKeys.get(accessKey)
        if (existingLabel !== undefined) {
          duplicates.push({
            menuPath,
            accessKey,
            firstLabel: existingLabel,
            secondLabel: label,
          })
        } else {
          seenKeys.set(accessKey, label)
        }
      }
    }

    const submenu = item.submenu
    if (submenu !== undefined && Array.isArray(submenu)) {
      const childPath =
        label !== undefined ? `${menuPath} > ${label}` : menuPath
      duplicates.push(...findDuplicateAccessKeys(submenu, childPath))
    }
  }

  return duplicates
}

describe('main-process menu', () => {
  describe('ensureItemIds', () => {
    it('leaves explicitly specified ids', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'File', id: 'foo' },
      ]

      ensureItemIds(template)

      assert.equal(template[0].id, 'foo')
    })

    it('assigns ids to items which lack it', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'File' },
      ]

      ensureItemIds(template)

      assert.equal(template[0].id, '@.File')
    })

    it('assigns ids recursively', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: 'File',
          id: 'foo',
          submenu: [
            { label: 'Open' },
            { label: 'Close' },
            {
              label: 'More',
              submenu: [{ label: 'Even more' }],
            },
          ],
        },
      ]

      ensureItemIds(template)

      assert.equal(template[0].id, 'foo')

      const firstSubmenu = template[0]
        .submenu as Electron.MenuItemConstructorOptions[]

      assert.equal(firstSubmenu[0].id, 'foo.Open')
      assert.equal(firstSubmenu[1].id, 'foo.Close')
      assert.equal(firstSubmenu[2].id, 'foo.More')

      const secondSubmenu = firstSubmenu[2]
        .submenu as Electron.MenuItemConstructorOptions[]

      assert.equal(secondSubmenu[0].id, 'foo.More.Even more')
    })

    it('handles duplicate generated ids', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        { label: 'foo' },
        { label: 'foo' },
      ]

      ensureItemIds(template)

      assert.equal(template[0].id, '@.foo')
      assert.equal(template[1].id, '@.foo1')
    })
  })

  describe('getAccessKey handles escaped ampersands', () => {
    it('does not treat && as an access key prefix', () => {
      // "Save && Upload" has a literal ampersand, no access key
      assert.equal(getAccessKey('Save && Upload'), null)
    })

    it('does not treat && at start of word as access key', () => {
      // "Ben&&Jerrys" has a literal ampersand, no access key
      assert.equal(getAccessKey('Ben&&Jerrys'), null)
    })

    it('extracts access key after escaped ampersand', () => {
      // "Save && &Upload" has a literal ampersand AND an access key 'u'
      assert.equal(getAccessKey('Save && &Upload'), 'u')
    })

    it('extracts normal access key correctly', () => {
      assert.equal(getAccessKey('&File'), 'f')
      assert.equal(getAccessKey('E&xit'), 'x')
    })
  })

  describe('dedupeMenuAccessKeys', () => {
    it('keeps the first mnemonic and strips the marker from collisions', () => {
      const deduped = dedupeMenuAccessKeys([
        { label: '&File' },
        { label: 'Re&cent' },
        { label: '&Favorites' },
      ])

      assert.deepStrictEqual(
        deduped.map(item => item.label),
        ['&File', 'Re&cent', 'Favorites']
      )
    })

    it('compares access keys case insensitively', () => {
      const deduped = dedupeMenuAccessKeys([
        { label: '&File' },
        { label: 'New &FILE from folder' },
      ])

      assert.deepStrictEqual(
        deduped.map(item => item.label),
        ['&File', 'New FILE from folder']
      )
    })

    it('leaves escaped ampersands and unmnemonized labels alone', () => {
      const deduped = dedupeMenuAccessKeys([
        { label: 'Save && &Upload' },
        { label: 'Ben&&Jerrys' },
        { label: 'Plain text' },
      ])

      assert.deepStrictEqual(
        deduped.map(item => item.label),
        ['Save && &Upload', 'Ben&&Jerrys', 'Plain text']
      )
    })

    it('dedupes submenus independently of their parents', () => {
      const deduped = dedupeMenuAccessKeys([
        {
          label: '&Repository',
          submenu: [{ label: '&Push' }, { label: 'P&ull' }],
        },
        {
          label: 'Branch',
          submenu: [{ label: '&Push' }, { label: 'P&ull' }],
        },
      ])

      const firstSubmenu = deduped[0]
        .submenu as Electron.MenuItemConstructorOptions[]
      const secondSubmenu = deduped[1]
        .submenu as Electron.MenuItemConstructorOptions[]

      assert.deepStrictEqual(
        firstSubmenu.map(item => item.label),
        ['&Push', 'P&ull']
      )
      assert.deepStrictEqual(
        secondSubmenu.map(item => item.label),
        ['&Push', 'P&ull']
      )
    })

    it('does not mutate the original template', () => {
      const template: Electron.MenuItemConstructorOptions[] = [
        {
          label: '&File',
          submenu: [{ label: 'Re&cent' }, { label: '&Favorites' }],
        },
      ]

      dedupeMenuAccessKeys(template)

      const submenu = template[0]
        .submenu as Electron.MenuItemConstructorOptions[]

      assert.equal(submenu[1].label, '&Favorites')
    })
  })

  describe('buildDefaultMenuTemplate', () => {
    it('gates Copilot handoff to supported platforms and preview channels', t => {
      const preview = process.env.GITHUB_DESKTOP_PREVIEW_FEATURES
      const hasCopilotMenuItem = () => {
        const template = buildDefaultMenuTemplate(baseParams)
        const repository = template.find(item => item.id === 'repository')
        assert.ok(Array.isArray(repository?.submenu))
        return repository.submenu.some(
          item => item.id === 'open-in-copilot-app'
        )
      }

      t.after(() => {
        if (preview === undefined) {
          delete process.env.GITHUB_DESKTOP_PREVIEW_FEATURES
        } else {
          process.env.GITHUB_DESKTOP_PREVIEW_FEATURES = preview
        }
      })

      delete process.env.GITHUB_DESKTOP_PREVIEW_FEATURES
      assert.strictEqual(
        enableCopilotAppHandoff(),
        (__DARWIN__ || __WIN32__) && (__DEV__ || __RELEASE_CHANNEL__ === 'beta')
      )
      assert.strictEqual(hasCopilotMenuItem(), enableCopilotAppHandoff())

      process.env.GITHUB_DESKTOP_PREVIEW_FEATURES = '1'
      assert.strictEqual(enableCopilotAppHandoff(), __DARWIN__ || __WIN32__)
      assert.strictEqual(hasCopilotMenuItem(), enableCopilotAppHandoff())
    })

    // The boolean parameters that affect which labels (and therefore access
    // keys) appear in the menu. We generate all 2^N combinations to ensure no
    // state produces a duplicate access key in any submenu.
    const variantKeys = [
      'isStashedChangesVisible',
      'isChangesFilterVisible',
      'hasCurrentPullRequest',
      'askForConfirmationOnRepositoryRemoval',
      'askForConfirmationWhenStashingAllChanges',
      'isForcePushForCurrentRepository',
      'askForConfirmationOnForcePush',
    ] as const

    type VariantKey = typeof variantKeys[number]

    const baseParams: MenuLabelsEvent = {
      selectedShell: null,
      selectedExternalEditor: null,
      askForConfirmationOnForcePush: false,
      askForConfirmationOnRepositoryRemoval: false,
    }

    it('provides a gated Copilot handoff without replacing the editor command', () => {
      const template = buildDefaultMenuTemplate(baseParams)
      const repository = template.find(item => item.id === 'repository')
      assert.ok(Array.isArray(repository?.submenu))
      const copilot = repository.submenu.find(
        item => item.id === 'open-in-copilot-app'
      )
      assert.strictEqual(copilot !== undefined, enableCopilotAppHandoff())
      if (copilot !== undefined) {
        assert.strictEqual(copilot.accelerator, 'CmdOrCtrl+Shift+J')
        assert.ok(
          repository.submenu.indexOf(copilot) <
            repository.submenu.findIndex(
              item => item.id === 'open-with-external-editor'
            )
        )
      }
      assert.ok(
        repository.submenu.some(item => item.id === 'open-external-editor')
      )
    })

    it('has no duplicate access keys in any built-in catalog for any combination of label-affecting parameters', () => {
      const combinationCount = 1 << variantKeys.length

      // Platform belongs in the loop because the catalogs carry `@win32`
      // variants, and a mnemonic that is unique under `@other` can collide with
      // a sibling once the Windows wording is chosen. Without this the test
      // passes in a Linux container and fails the Windows job of ci.yml, which
      // is exactly how the collision in `menu.open-working-directory` reached
      // CI unnoticed.
      //
      // Collisions accumulate instead of failing at the first one: the same key
      // repeats across the parameter combinations, so the set is keyed by
      // (platform, locale, submenu, key, labels) and one run reports every
      // distinct collision rather than one per red run.
      const found = new Map<string, DuplicateAccessKey>()

      for (const platform of ['win32', 'linux', 'darwin'] as const) {
        localization.setPlatform(platform)
        for (const tag of ['en', 'ru', 'uk']) {
          localization.setRequestedLocale(tag)
          try {
            for (let bits = 0; bits < combinationCount; bits++) {
              const variantEntries = variantKeys.map(
                (key, i) => [key, !!(bits & (1 << i))] as [VariantKey, boolean]
              )

              const params: MenuLabelsEvent = {
                ...baseParams,
                ...Object.fromEntries(variantEntries),
              }

              const template = buildDefaultMenuTemplate(params)

              for (const duplicate of findDuplicateAccessKeys(template)) {
                found.set(
                  `${platform}/${tag}|${duplicate.menuPath}|${duplicate.accessKey}|${duplicate.firstLabel}|${duplicate.secondLabel}`,
                  duplicate
                )
              }
            }
          } finally {
            localization.setRequestedLocale(null)
          }
        }
      }
      localization.setPlatform(currentPlatform())

      // The key already reads `platform/locale | submenu | key | labels`, so
      // reporting the keys reports every collision with where to look for it.
      const report = [...found.keys()]

      assert.deepStrictEqual(
        report,
        [],
        `duplicate access keys found:\n${report.join('\n')}`
      )
    })
  })
})
