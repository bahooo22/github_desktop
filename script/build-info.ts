import { mkdir, writeFile } from 'fs/promises'
import * as Path from 'path'

import { getSHA } from '../app/git-info'
import { getVersion } from '../app/package-info'
import { getDistRoot } from './dist-info'

/**
 * What the app compares itself against when it decides whether the fork has a
 * newer build.
 *
 * Squirrel can't answer that question: it only ever compares versions, so a
 * release that carries the same `app/package.json` version as the installed one
 * is invisible to it. A GitHub Release doesn't record the commit it was built
 * from either — `gh release create` writes `target_commitish` once, from the
 * default branch, and later `gh release upload` runs never move it. So the
 * release states its own commit in this asset and the app reads it back.
 */
export interface IForkBuildInfo {
  readonly schema: 1
  readonly platform: string
  readonly arch: string
  readonly sha: string
  readonly version: string
  readonly builtAt: string
}

export function getForkBuildInfo(): IForkBuildInfo {
  return {
    schema: 1,
    platform: process.platform,
    // The runner's own architecture says nothing about the package being built:
    // an arm64 release is packaged by an x64 node. The workflow passes it.
    arch: process.env.BUILD_INFO_ARCH ?? process.arch,
    sha: process.env.GITHUB_SHA ?? getSHA(),
    version: getVersion(),
    builtAt: new Date().toISOString(),
  }
}

async function main() {
  const info = getForkBuildInfo()

  if (info.sha === '') {
    console.error(
      'build-info: no commit to name (neither GITHUB_SHA nor git rev-parse HEAD)'
    )
    process.exit(1)
  }

  const target = Path.join(getDistRoot(), 'build-info.json')
  await mkdir(Path.dirname(target), { recursive: true })
  await writeFile(target, `${JSON.stringify(info, null, 2)}\n`)

  console.log(
    `build-info: ${target} — ${info.sha} (${info.version}, ${info.platform}-${info.arch})`
  )
}

main().catch(e => {
  console.error(`Error writing build info: ${e}`)
  process.exit(1)
})
