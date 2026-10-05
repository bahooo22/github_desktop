import { t } from '../../lib/l10n/core'
import { Menu, shell, app, BrowserWindow } from 'electron'
import { ensureItemIds } from './ensure-item-ids'
import { MenuEvent } from './menu-event'
import { truncateWithEllipsis } from '../../lib/truncate-with-ellipsis'
import { getLogDirectoryPath } from '../../lib/logging/get-log-path'
import { UNSAFE_openDirectory } from '../shell'
import {
  enableCopilotAppHandoff,
  enableWorktreeSupport,
} from '../../lib/feature-flag'
import { MenuLabelsEvent } from '../../models/menu-labels'
import * as ipcWebContents from '../ipc-webcontents'
import { mkdir } from 'fs/promises'
import { buildTestMenu } from './build-test-menu'

/**
 * These are functions rather than constants because the active language can
 * change while the application runs, and a module level constant would freeze
 * whichever language happened to be loaded when this file was first imported.
 */
const createPullRequestLabel = () => t('menu.create-pull-request')
const showPullRequestLabel = () => t('menu.view-pull-request')
const defaultBranchNameValue = () => t('menu.default-branch-name')
const confirmRepositoryRemovalLabel = () => t('menu.remove-repository-confirm')
const repositoryRemovalLabel = () => t('menu.remove-repository')
const confirmStashAllChangesLabel = () => t('menu.stash-all-changes-confirm')
const stashAllChangesLabel = () => t('menu.stash-all-changes')

enum ZoomDirection {
  Reset,
  In,
  Out,
}

export const separator: Electron.MenuItemConstructorOptions = {
  type: 'separator',
}

export function buildDefaultMenu(params: MenuLabelsEvent): Electron.Menu {
  return Menu.buildFromTemplate(
    dedupeMenuAccessKeys(buildDefaultMenuTemplate(params))
  )
}

/**
 * Electron throws when two items in the same submenu advertise the same
 * access key, and localized labels (including user-supplied catalogs) can
 * easily collide. Keep the first mnemonic in each submenu and silently drop
 * the redundant ampersands from the rest — the text stays, only the
 * underline hint goes away.
 */
export function dedupeMenuAccessKeys(
  items: ReadonlyArray<Electron.MenuItemConstructorOptions>
): Electron.MenuItemConstructorOptions[] {
  const used = new Set<string>()

  return items.map(item => {
    const withSubmenu = Array.isArray(item.submenu)
      ? { ...item, submenu: dedupeMenuAccessKeys(item.submenu) }
      : item

    const label = withSubmenu.label
    if (typeof label !== 'string') {
      return withSubmenu
    }

    for (let i = 0; i < label.length - 1; i++) {
      if (label[i] !== '&') {
        continue
      }

      // '&&' is an escaped literal ampersand, not a mnemonic
      if (label[i + 1] === '&') {
        i++
        continue
      }

      const key = label[i + 1].toLowerCase()
      if (used.has(key)) {
        return {
          ...withSubmenu,
          label: label.slice(0, i) + label.slice(i + 1),
        }
      }

      used.add(key)
      break
    }

    return withSubmenu
  })
}

export function buildDefaultMenuTemplate({
  selectedExternalEditor,
  selectedShell,
  askForConfirmationOnForcePush,
  askForConfirmationOnRepositoryRemoval,
  hasCurrentPullRequest = false,
  contributionTargetDefaultBranch = defaultBranchNameValue(),
  isForcePushForCurrentRepository = false,
  isStashedChangesVisible = false,
  askForConfirmationWhenStashingAllChanges = true,
  isChangesFilterVisible = true,
}: MenuLabelsEvent): Electron.MenuItemConstructorOptions[] {
  contributionTargetDefaultBranch = truncateWithEllipsis(
    contributionTargetDefaultBranch,
    25
  )

  const removeRepoLabel = askForConfirmationOnRepositoryRemoval
    ? confirmRepositoryRemovalLabel()
    : repositoryRemovalLabel()

  const pullRequestLabel = hasCurrentPullRequest
    ? showPullRequestLabel()
    : createPullRequestLabel()

  const template = new Array<Electron.MenuItemConstructorOptions>()

  if (__DARWIN__) {
    template.push({
      label: 'GitHub Desktop',
      submenu: [
        {
          label: t('menu.about'),
          click: emit('show-about'),
          id: 'about',
        },
        separator,
        {
          label: t('menu.preferences'),
          id: 'preferences',
          accelerator: 'CmdOrCtrl+,',
          click: emit('show-preferences'),
        },
        separator,
        {
          label: t('menu.install-cli'),
          id: 'install-cli',
          click: emit('install-darwin-cli'),
        },
        separator,
        {
          role: 'services',
          submenu: [],
        },
        separator,
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        separator,
        { role: 'quit' },
      ],
    })
  }

  const fileMenu: Electron.MenuItemConstructorOptions = {
    label: __DARWIN__ ? 'File' : '&File',
    submenu: [
      {
        label: t('menu.new-repository'),
        id: 'new-repository',
        click: emit('create-repository'),
        accelerator: 'CmdOrCtrl+N',
      },
      separator,
      {
        label: t('menu.add-local-repository'),
        id: 'add-local-repository',
        accelerator: 'CmdOrCtrl+O',
        click: emit('add-local-repository'),
      },
      {
        label: t('menu.clone-repository'),
        id: 'clone-repository',
        accelerator: 'CmdOrCtrl+Shift+O',
        click: emit('clone-repository'),
      },
    ],
  }

  if (!__DARWIN__) {
    const fileItems = fileMenu.submenu as Electron.MenuItemConstructorOptions[]
    const exitAccelerator = __WIN32__ ? 'Alt+F4' : 'CmdOrCtrl+Q'

    fileItems.push(
      separator,
      {
        label: t('menu.preferences'),
        id: 'preferences',
        accelerator: 'CmdOrCtrl+,',
        click: emit('show-preferences'),
      },
      separator,
      {
        role: 'quit',
        label: t('menu.exit'),
        accelerator: exitAccelerator,
      }
    )
  }

  template.push(fileMenu)

  template.push({
    label: __DARWIN__ ? 'Edit' : '&Edit',
    submenu: [
      { role: 'undo', label: __DARWIN__ ? 'Undo' : '&Undo' },
      { role: 'redo', label: __DARWIN__ ? 'Redo' : '&Redo' },
      separator,
      { role: 'cut', label: __DARWIN__ ? 'Cut' : 'Cu&t' },
      { role: 'copy', label: __DARWIN__ ? 'Copy' : '&Copy' },
      { role: 'paste', label: __DARWIN__ ? 'Paste' : '&Paste' },
      {
        label: __DARWIN__ ? 'Select All' : 'Select &all',
        accelerator: 'CmdOrCtrl+A',
        click: emit('select-all'),
      },
      separator,
      {
        id: 'find',
        label: t('menu.find'),
        accelerator: 'CmdOrCtrl+F',
        click: emit('find-text'),
      },
    ],
  })

  template.push({
    label: __DARWIN__ ? 'View' : '&View',
    submenu: [
      {
        label: t('menu.show-changes'),
        id: 'show-changes',
        accelerator: 'CmdOrCtrl+1',
        click: emit('show-changes'),
      },
      {
        label: t('menu.show-history'),
        id: 'show-history',
        accelerator: 'CmdOrCtrl+2',
        click: emit('show-history'),
      },
      {
        label: t('menu.show-repository-list'),
        id: 'show-repository-list',
        accelerator: 'CmdOrCtrl+T',
        click: emit('choose-repository'),
      },
      {
        label: t('menu.show-branches-list'),
        id: 'show-branches-list',
        accelerator: 'CmdOrCtrl+B',
        click: emit('show-branches'),
      },
      {
        label: t('menu.show-worktrees-list'),
        id: 'show-worktrees-list',
        accelerator: 'CmdOrCtrl+Alt+W',
        click: emit('show-worktrees'),
        visible: enableWorktreeSupport(),
      },
      separator,
      {
        label: t('menu.go-to-commit-message'),
        id: 'go-to-commit-message',
        accelerator: 'CmdOrCtrl+G',
        click: emit('go-to-commit-message'),
      },
      {
        label: t(
          isStashedChangesVisible
            ? 'menu.hide-stashed-changes'
            : 'menu.show-stashed-changes'
        ),
        id: 'toggle-stashed-changes',
        accelerator: 'Ctrl+H',
        click: isStashedChangesVisible
          ? emit('hide-stashed-changes')
          : emit('show-stashed-changes'),
      },
      {
        label: t(
          isChangesFilterVisible
            ? 'menu.hide-changes-filter'
            : 'menu.show-changes-filter'
        ),
        id: 'toggle-changes-filter',
        accelerator: 'CmdOrCtrl+L',
        click: emit('toggle-changes-filter'),
      },
      {
        label: __DARWIN__ ? 'Toggle Full Screen' : 'Toggle &full screen',
        role: 'togglefullscreen',
      },
      separator,
      {
        label: __DARWIN__ ? 'Reset Zoom' : 'Reset zoom',
        accelerator: 'CmdOrCtrl+0',
        click: zoom(ZoomDirection.Reset),
      },
      {
        label: __DARWIN__ ? 'Zoom In' : 'Zoom in',
        accelerator: 'CmdOrCtrl+=',
        click: zoom(ZoomDirection.In),
      },
      {
        label: __DARWIN__ ? 'Zoom Out' : 'Zoom out',
        accelerator: 'CmdOrCtrl+-',
        click: zoom(ZoomDirection.Out),
      },
      {
        label: t('menu.increase-active-resizable-width'),
        id: 'increase-active-resizable-width',
        accelerator: 'CmdOrCtrl+9',
        click: emit('increase-active-resizable-width'),
      },
      {
        label: t('menu.decrease-active-resizable-width'),
        id: 'decrease-active-resizable-width',
        accelerator: 'CmdOrCtrl+8',
        click: emit('decrease-active-resizable-width'),
      },
      separator,
      {
        label: t('menu.reload-window'),
        id: 'reload-window',
        // Ctrl+Alt is interpreted as AltGr on international keyboards and this
        // can clash with other shortcuts. We should always use Ctrl+Shift for
        // chorded shortcuts, but this menu item is not a user-facing feature
        // so we are going to keep this one around.
        accelerator: 'CmdOrCtrl+Alt+R',
        click(item: any, focusedWindow: Electron.BaseWindow | undefined) {
          if (focusedWindow instanceof BrowserWindow) {
            focusedWindow.reload()
          }
        },
        visible: __RELEASE_CHANNEL__ === 'development',
      },
      {
        id: 'show-devtools',
        label: t('menu.show-devtools'),
        accelerator: (() => {
          return __DARWIN__ ? 'Alt+Command+I' : 'Ctrl+Shift+I'
        })(),
        click(item: any, focusedWindow: Electron.BaseWindow | undefined) {
          if (focusedWindow instanceof BrowserWindow) {
            focusedWindow.webContents.toggleDevTools()
          }
        },
      },
    ],
  })

  const pushLabel = getPushLabel(
    isForcePushForCurrentRepository,
    askForConfirmationOnForcePush
  )

  const pushEventType = isForcePushForCurrentRepository ? 'force-push' : 'push'

  template.push({
    label: t('menu.repository'),
    id: 'repository',
    submenu: [
      {
        id: 'push',
        label: pushLabel,
        accelerator: 'CmdOrCtrl+P',
        click: emit(pushEventType),
      },
      {
        id: 'pull',
        label: t('menu.pull'),
        accelerator: 'CmdOrCtrl+Shift+P',
        click: emit('pull'),
      },
      {
        id: 'fetch',
        label: t('menu.fetch'),
        accelerator: 'CmdOrCtrl+Shift+T',
        click: emit('fetch'),
      },
      {
        label: removeRepoLabel,
        id: 'remove-repository',
        accelerator: 'CmdOrCtrl+Backspace',
        click: emit('remove-repository'),
      },
      separator,
      {
        id: 'view-repository-on-github',
        label: t('menu.view-repository-on-github'),
        accelerator: 'CmdOrCtrl+Shift+G',
        click: emit('view-repository-on-github'),
      },
      {
        label: __DARWIN__
          ? `Open in ${selectedShell ?? 'Shell'}`
          : `O&pen in ${selectedShell ?? 'shell'}`,
        id: 'open-in-shell',
        accelerator: 'Ctrl+`',
        click: emit('open-in-shell'),
      },
      {
        label: t('menu.open-working-directory'),
        id: 'open-working-directory',
        accelerator: 'CmdOrCtrl+Shift+F',
        click: emit('open-working-directory'),
      },
      {
        label: __DARWIN__
          ? `Open in ${selectedExternalEditor ?? 'External Editor'}`
          : `&Open in ${selectedExternalEditor ?? 'external editor'}`,
        id: 'open-external-editor',
        accelerator: 'CmdOrCtrl+Shift+A',
        click: emit('open-external-editor'),
      },
      ...(enableCopilotAppHandoff()
        ? [
            {
              label: t('menu.open-in-copilot-app'),
              id: 'open-in-copilot-app',
              accelerator: 'CmdOrCtrl+Shift+J',
              click: emit('open-in-copilot-app'),
            },
          ]
        : []),
      {
        label: t('menu.open-with-external-editor'),
        id: 'open-with-external-editor',
        accelerator: 'CmdOrCtrl+Shift+Alt+A',
        click: emit('open-with-external-editor'),
      },
      separator,
      {
        id: 'create-issue-in-repository-on-github',
        label: t('menu.create-issue-in-repository-on-github'),
        accelerator: 'CmdOrCtrl+I',
        click: emit('create-issue-in-repository-on-github'),
      },
      separator,
      {
        id: 'create-worktree',
        label: t('menu.create-worktree'),
        click: emit('create-worktree'),
        accelerator: 'CmdOrCtrl+Shift+W',
        visible: enableWorktreeSupport(),
      },
      ...(enableWorktreeSupport() ? [separator] : []),
      {
        label: t('menu.show-repository-settings'),
        id: 'show-repository-settings',
        click: emit('show-repository-settings'),
      },
    ],
  })

  const branchSubmenu = [
    {
      label: t('menu.create-branch'),
      id: 'create-branch',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: emit('create-branch'),
    },
    {
      label: t('menu.rename-branch'),
      id: 'rename-branch',
      accelerator: 'CmdOrCtrl+Shift+R',
      click: emit('rename-branch'),
    },
    {
      label: t('menu.delete-branch'),
      id: 'delete-branch',
      accelerator: 'CmdOrCtrl+Shift+D',
      click: emit('delete-branch'),
    },
    separator,
    {
      label: t('menu.discard-all-changes'),
      id: 'discard-all-changes',
      accelerator: 'CmdOrCtrl+Shift+Backspace',
      click: emit('discard-all-changes'),
    },
    {
      label: askForConfirmationWhenStashingAllChanges
        ? confirmStashAllChangesLabel()
        : stashAllChangesLabel(),
      id: 'stash-all-changes',
      accelerator: 'CmdOrCtrl+Shift+S',
      click: emit('stash-all-changes'),
    },
    separator,
    {
      label: __DARWIN__
        ? `Update from ${contributionTargetDefaultBranch}`
        : `&Update from ${contributionTargetDefaultBranch}`,
      id: 'update-branch-with-contribution-target-branch',
      accelerator: 'CmdOrCtrl+Shift+U',
      click: emit('update-branch-with-contribution-target-branch'),
    },
    {
      label: t('menu.compare-to-branch'),
      id: 'compare-to-branch',
      accelerator: 'CmdOrCtrl+Shift+B',
      click: emit('compare-to-branch'),
    },
    {
      label: t('menu.merge-branch'),
      id: 'merge-branch',
      accelerator: 'CmdOrCtrl+Shift+M',
      click: emit('merge-branch'),
    },
    {
      label: t('menu.squash-and-merge-branch'),
      id: 'squash-and-merge-branch',
      accelerator: 'CmdOrCtrl+Shift+H',
      click: emit('squash-and-merge-branch'),
    },
    {
      label: t('menu.rebase-branch'),
      id: 'rebase-branch',
      accelerator: 'CmdOrCtrl+Shift+E',
      click: emit('rebase-branch'),
    },
    separator,
    {
      label: t('menu.compare-on-github'),
      id: 'compare-on-github',
      accelerator: 'CmdOrCtrl+Shift+C',
      click: emit('compare-on-github'),
    },
    {
      label: t('menu.branch-on-github'),
      id: 'branch-on-github',
      accelerator: 'CmdOrCtrl+Alt+B',
      click: emit('branch-on-github'),
    },
  ]

  branchSubmenu.push({
    label: t('menu.preview-pull-request'),
    id: 'preview-pull-request',
    accelerator: 'CmdOrCtrl+Alt+P',
    click: emit('preview-pull-request'),
  })

  branchSubmenu.push({
    label: pullRequestLabel,
    id: 'create-pull-request',
    accelerator: 'CmdOrCtrl+R',
    click: emit('open-pull-request'),
  })

  template.push({
    label: t('menu.branch'),
    id: 'branch',
    submenu: branchSubmenu,
  })

  if (__DARWIN__) {
    template.push({
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
        separator,
        { role: 'front' },
      ],
    })
  }

  const submitIssueItem: Electron.MenuItemConstructorOptions = {
    label: __DARWIN__ ? 'Report Issue…' : 'Report issue…',
    click() {
      shell
        .openExternal('https://github.com/desktop/desktop/issues/new/choose')
        .catch(err => log.error('Failed opening issue creation page', err))
    },
  }

  const contactSupportItem: Electron.MenuItemConstructorOptions = {
    label: __DARWIN__ ? 'Contact GitHub Support…' : '&Contact GitHub support…',
    click() {
      shell
        .openExternal(
          `https://github.com/contact?from_desktop_app=1&app_version=${app.getVersion()}`
        )
        .catch(err => log.error('Failed opening contact support page', err))
    },
  }

  const showUserGuides: Electron.MenuItemConstructorOptions = {
    label: t('menu.show-user-guides'),
    click() {
      shell
        .openExternal('https://docs.github.com/en/desktop')
        .catch(err => log.error('Failed opening user guides page', err))
    },
  }

  const showKeyboardShortcuts: Electron.MenuItemConstructorOptions = {
    label: t('menu.show-keyboard-shortcuts'),
    click() {
      shell
        .openExternal(
          'https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/keyboard-shortcuts'
        )
        .catch(err => log.error('Failed opening keyboard shortcuts page', err))
    },
  }

  const showLogsLabel = () => t('menu.show-logs')

  const showLogsItem: Electron.MenuItemConstructorOptions = {
    label: showLogsLabel(),
    click() {
      const logPath = getLogDirectoryPath()
      mkdir(logPath, { recursive: true })
        .then(() => UNSAFE_openDirectory(logPath))
        .catch(err => log.error('Failed opening logs directory', err))
    },
  }

  const helpItems = [
    submitIssueItem,
    contactSupportItem,
    showUserGuides,
    showKeyboardShortcuts,
    showLogsItem,
  ]

  helpItems.push(...buildTestMenu())

  if (__DARWIN__) {
    template.push({
      role: 'help',
      submenu: helpItems,
    })
  } else {
    template.push({
      label: t('menu.help'),
      submenu: [
        ...helpItems,
        separator,
        {
          label: t('menu.about'),
          click: emit('show-about'),
          id: 'about',
        },
      ],
    })
  }

  ensureItemIds(template)

  return template
}

function getPushLabel(
  isForcePushForCurrentRepository: boolean,
  askForConfirmationOnForcePush: boolean
): string {
  if (!isForcePushForCurrentRepository) {
    return __DARWIN__ ? 'Push' : 'P&ush'
  }

  if (askForConfirmationOnForcePush) {
    return __DARWIN__ ? 'Force Push…' : 'Force P&ush…'
  }

  return __DARWIN__ ? 'Force Push' : 'Force P&ush'
}

type ClickHandler = (
  menuItem: Electron.MenuItem,
  browserWindow: Electron.BaseWindow | undefined,
  event: Electron.KeyboardEvent
) => void

/**
 * Utility function returning a Click event handler which, when invoked, emits
 * the provided menu event over IPC.
 */
export function emit(name: MenuEvent): ClickHandler {
  return (_, focusedWindow) => {
    // focusedWindow can be null if the menu item was clicked without the window
    // being in focus. A simple way to reproduce this is to click on a menu item
    // while in DevTools. Since Desktop only supports one window at a time we
    // can be fairly certain that the first BrowserWindow we find is the one we
    // want.
    const window =
      focusedWindow instanceof BrowserWindow
        ? focusedWindow
        : BrowserWindow.getAllWindows()[0]
    if (window !== undefined) {
      if (!window.isVisible()) {
        window.show()
      }
      ipcWebContents.send(window.webContents, 'menu-event', name)
    }
  }
}

/** The zoom steps that we support, these factors must sorted */
const ZoomInFactors = [0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
const ZoomOutFactors = ZoomInFactors.slice().reverse()

/**
 * Returns the element in the array that's closest to the value parameter. Note
 * that this function will throw if passed an empty array.
 */
function findClosestValue(arr: Array<number>, value: number) {
  return arr.reduce((previous, current) => {
    return Math.abs(current - value) < Math.abs(previous - value)
      ? current
      : previous
  })
}

/**
 * Figure out the next zoom level for the given direction and alert the renderer
 * about a change in zoom factor if necessary.
 */
function zoom(direction: ZoomDirection): ClickHandler {
  return (menuItem, window) => {
    if (!(window instanceof BrowserWindow)) {
      return
    }

    const { webContents } = window

    if (direction === ZoomDirection.Reset) {
      webContents.zoomFactor = 1
      ipcWebContents.send(webContents, 'zoom-factor-changed', 1)
    } else {
      const rawZoom = webContents.zoomFactor
      const zoomFactors =
        direction === ZoomDirection.In ? ZoomInFactors : ZoomOutFactors

      // So the values that we get from zoomFactor property are floating point
      // precision numbers from chromium, that don't always round nicely, so
      // we'll have to do a little trick to figure out which of our supported
      // zoom factors the value is referring to.
      const currentZoom = findClosestValue(zoomFactors, rawZoom)

      const nextZoomLevel = zoomFactors.find(f =>
        direction === ZoomDirection.In ? f > currentZoom : f < currentZoom
      )

      // If we couldn't find a zoom level (likely due to manual manipulation
      // of the zoom factor in devtools) we'll just snap to the closest valid
      // factor we've got.
      const newZoom = nextZoomLevel === undefined ? currentZoom : nextZoomLevel

      webContents.zoomFactor = newZoom
      ipcWebContents.send(webContents, 'zoom-factor-changed', newZoom)
    }
  }
}
