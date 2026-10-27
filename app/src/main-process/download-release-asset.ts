import { app, net, WebContents } from 'electron'
import { createWriteStream, existsSync, mkdirSync } from 'fs'
import { basename, join } from 'path'

import * as ipcMain from './ipc-main'

import {
  IReleaseAssetDownloadProgress,
  isAllowedReleaseAssetName,
  isAllowedReleaseAssetUrl,
  ReleaseAssetDownloadResult,
  releaseAssetExtensionsFor,
  uniqueFileName,
} from '../lib/release-asset-download'

/**
 * Saves a release asset the user picked into the downloads folder. The
 * renderer never names a path: it passes the release's own asset URL and file
 * name, and both are checked against the allowlist here before anything is
 * written. Which file types are allowed follows from the URL's channel, so the
 * caller cannot widen the gate. The download goes through Electron's net module
 * so GitHub's redirects and the system proxy are handled for us.
 */
export function registerReleaseAssetDownload() {
  ipcMain.handle(
    'download-release-asset',
    async (event, url: string, fileName: string) =>
      downloadAsset(event.sender, url, fileName)
  )
}

async function downloadAsset(
  sender: WebContents,
  url: string,
  fileName: string
): Promise<ReleaseAssetDownloadResult> {
  if (!isAllowedReleaseAssetUrl(url)) {
    return { status: 'error', message: 'release asset host is not allowed' }
  }

  const safeName = basename(fileName)

  if (
    safeName !== fileName ||
    !isAllowedReleaseAssetName(safeName, releaseAssetExtensionsFor(url))
  ) {
    return { status: 'error', message: 'release asset name is not allowed' }
  }

  const directory = app.getPath('downloads')

  try {
    mkdirSync(directory, { recursive: true })
  } catch (e) {
    return {
      status: 'error',
      message: e instanceof Error ? e.message : String(e),
    }
  }

  const target = join(
    directory,
    uniqueFileName(safeName, path => existsSync(path))
  )

  return new Promise<ReleaseAssetDownloadResult>(resolve => {
    const request = net.request({ method: 'GET', url })

    request.on('response', response => {
      if (response.statusCode !== 200) {
        resolve({
          status: 'error',
          message: `release asset answered with ${response.statusCode}`,
        })
        return
      }

      const header = response.headers['content-length']
      const total = Number(Array.isArray(header) ? header[0] : header) || 0

      let received = 0
      let settled = false

      const fail = (message: string) => {
        if (settled) {
          return
        }

        settled = true
        resolve({ status: 'error', message })
      }

      const stream = createWriteStream(target)

      stream.on('error', e => fail(e.message))

      response.on('data', (chunk: Buffer) => {
        received += chunk.length
        stream.write(chunk)

        const progress: IReleaseAssetDownloadProgress = { received, total }
        sender.send('release-asset-download-progress', progress)
      })

      response.on('error', e => fail(e.message))

      response.on('end', () => {
        stream.end(() => {
          if (settled) {
            return
          }

          settled = true
          resolve({ status: 'saved', path: target })
        })
      })
    })

    request.on('error', e => resolve({ status: 'error', message: e.message }))

    request.end()
  })
}
