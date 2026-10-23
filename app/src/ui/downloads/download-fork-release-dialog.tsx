import * as React from 'react'

import { Dialog, DialogContent, DialogFooter } from '../dialog'
import { Button } from '../lib/button'
import { LinkButton } from '../lib/link-button'
import { t } from '../../lib/l10n'
import { shell } from '../../lib/app-shell'
import { formatBytes } from '../lib/bytes'
import { getReleaseAssets, IReleaseAsset } from '../../lib/fork-release'
import { IReleaseAssetDownloadProgress } from '../../lib/release-asset-download'
import {
  downloadReleaseAsset,
  onReleaseAssetDownloadProgress,
} from '../main-process-proxy'

interface IDownloadForkReleaseDialogProps {
  readonly version: string
  readonly onDismissed: () => void
}

interface IAssetLinkProps {
  readonly asset: IReleaseAsset
  readonly disabled: boolean
  readonly onSelect: (asset: IReleaseAsset) => void
}

/** Keeps the click handler out of the render's JSX, as the lint rules ask. */
class AssetLink extends React.Component<IAssetLinkProps> {
  public render() {
    return (
      <LinkButton onClick={this.onClick} disabled={this.props.disabled}>
        {this.props.asset.name}
      </LinkButton>
    )
  }

  private onClick = () => this.props.onSelect(this.props.asset)
}

interface IDownloadForkReleaseDialogState {
  readonly assets: ReadonlyArray<IReleaseAsset> | null
  readonly downloading: string | null
  readonly progress: IReleaseAssetDownloadProgress | null
  readonly savedPath: string | null
  readonly error: string | null
}

/**
 * Offers the files of the fork's release and saves the one the user picks into
 * the downloads folder. Nothing is fetched before the dialog opens and nothing
 * is written until a file is clicked.
 */
export class DownloadForkReleaseDialog extends React.Component<
  IDownloadForkReleaseDialogProps,
  IDownloadForkReleaseDialogState
> {
  private unsubscribeProgress: (() => void) | null = null

  public constructor(props: IDownloadForkReleaseDialogProps) {
    super(props)

    this.state = {
      assets: null,
      downloading: null,
      progress: null,
      savedPath: null,
      error: null,
    }
  }

  public componentDidMount() {
    this.unsubscribeProgress = onReleaseAssetDownloadProgress(
      (_event, progress) => this.setState({ progress })
    )

    getReleaseAssets(__DARWIN__ ? ['.zip'] : ['.deb', '.AppImage'])
      .then(assets => this.setState({ assets }))
      .catch(e =>
        this.setState({
          assets: [],
          error: e instanceof Error ? e.message : String(e),
        })
      )
  }

  public componentWillUnmount() {
    this.unsubscribeProgress?.()
  }

  public render() {
    return (
      <Dialog
        id="download-fork-release"
        title={t('downloadForkRelease.title', { version: this.props.version })}
        onSubmit={this.props.onDismissed}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>{this.renderContent()}</DialogContent>
        <DialogFooter>
          <Button type="submit">{t('common.close')}</Button>
        </DialogFooter>
      </Dialog>
    )
  }

  private renderContent() {
    const { assets, downloading, progress, savedPath, error } = this.state

    if (savedPath !== null) {
      return (
        <div>
          <p className="no-padding">
            {t('downloadForkRelease.saved', { path: savedPath })}
          </p>
          <p className="no-padding">
            <LinkButton onClick={this.onShowInFolder}>
              {t('downloadForkRelease.showInFolder')}
            </LinkButton>
          </p>
        </div>
      )
    }

    if (error !== null) {
      return (
        <p className="no-padding">
          {t('downloadForkRelease.error', { message: error })}
        </p>
      )
    }

    if (assets === null) {
      return <p className="no-padding">{t('downloadForkRelease.loading')}</p>
    }

    if (assets.length === 0) {
      return (
        <p className="no-padding">
          {t('downloadForkRelease.error', {
            message: t('downloadForkRelease.noAssets'),
          })}
        </p>
      )
    }

    const percent =
      progress === null || progress.total <= 0
        ? null
        : Math.round((progress.received / progress.total) * 100)

    return (
      <div>
        <ul className="download-fork-release-list">
          {assets.map(asset => (
            <li key={asset.name}>
              <AssetLink
                asset={asset}
                disabled={downloading !== null}
                onSelect={this.download}
              />{' '}
              {asset.size > 0 ? `(${formatBytes(asset.size)})` : null}
            </li>
          ))}
        </ul>
        {downloading !== null && (
          <p className="no-padding">
            {percent === null
              ? t('downloadForkRelease.downloadingNoPercent')
              : t('downloadForkRelease.downloading', { percent })}
          </p>
        )}
        {__DARWIN__ && (
          <p className="no-padding">{t('downloadForkRelease.gatekeeper')}</p>
        )}
      </div>
    )
  }

  private onShowInFolder = () => {
    const path = this.state.savedPath

    if (path !== null) {
      shell.showItemInFolder(path)
    }
  }

  private download = async (asset: IReleaseAsset) => {
    this.setState({
      downloading: asset.name,
      progress: null,
      error: null,
    })

    const result = await downloadReleaseAsset(asset.url, asset.name)

    if (result.status === 'saved') {
      this.setState({
        downloading: null,
        savedPath: result.path,
      })
    } else {
      this.setState({
        downloading: null,
        error: result.message,
      })
    }
  }
}
