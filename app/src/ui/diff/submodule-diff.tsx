import React from 'react'
import { t, Trans } from '../../lib/l10n'
import { parseRepositoryIdentifier } from '../../lib/remote-parsing'
import { ISubmoduleDiff } from '../../models/diff'
import { LinkButton } from '../lib/link-button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { SuggestedAction } from '../suggested-actions'
import { Ref } from '../lib/ref'
import { CopyButton } from '../copy-button'
import { shortenSHA } from '../../models/commit'

type SubmoduleItemIcon =
  | {
      readonly octicon: typeof octicons.info
      readonly className: 'info-icon'
    }
  | {
      readonly octicon: typeof octicons.diffModified
      readonly className: 'modified-icon'
    }
  | {
      readonly octicon: typeof octicons.diffAdded
      readonly className: 'added-icon'
    }
  | {
      readonly octicon: typeof octicons.diffRemoved
      readonly className: 'removed-icon'
    }
  | {
      readonly octicon: typeof octicons.fileDiff
      readonly className: 'untracked-icon'
    }

function ShaRef({
  sha,
  copyAriaLabel,
  children,
}: {
  readonly sha: string
  readonly copyAriaLabel: string
  readonly children?: React.ReactNode
}) {
  return (
    <>
      <Ref>{children ?? shortenSHA(sha)}</Ref>
      <CopyButton ariaLabel={copyAriaLabel} copyContent={sha} />
    </>
  )
}

interface ISubmoduleDiffProps {
  readonly onOpenSubmodule?: (fullPath: string) => void
  readonly diff: ISubmoduleDiff

  /**
   * Whether the diff is readonly, e.g., displaying a historical diff, or the
   * diff's content can be committed, e.g., displaying a change in the working
   * directory.
   */
  readonly readOnly: boolean
}

export class SubmoduleDiff extends React.Component<ISubmoduleDiffProps> {
  public constructor(props: ISubmoduleDiffProps) {
    super(props)
  }

  public render() {
    return (
      <div className="changes-interstitial submodule-diff">
        <div className="content">
          <div className="interstitial-header">
            <div className="text">
              <h1>{t('diff.submodule.header')}</h1>
            </div>
          </div>
          {this.renderSubmoduleInfo()}
          {this.renderCommitChangeInfo()}
          {this.renderSubmodulesChangesInfo()}
          {this.renderOpenSubmoduleAction()}
        </div>
      </div>
    )
  }

  private renderSubmoduleInfo() {
    if (this.props.diff.url === null) {
      return null
    }

    const repoIdentifier = parseRepositoryIdentifier(this.props.diff.url)
    if (repoIdentifier === null) {
      return null
    }

    const hostname =
      repoIdentifier.hostname === 'github.com'
        ? ''
        : ` (${repoIdentifier.hostname})`

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.info, className: 'info-icon' },
      <Trans
        k="diff.submodule.repository"
        params={{
          identifier: `${repoIdentifier.owner}/${repoIdentifier.name}${hostname}`,
        }}
        components={{
          link: (
            <LinkButton
              uri={`https://${repoIdentifier.hostname}/${repoIdentifier.owner}/${repoIdentifier.name}`}
            />
          ),
        }}
      />
    )
  }

  private renderCommitChangeInfo() {
    const { diff, readOnly } = this.props
    const { oldSHA, newSHA } = diff

    const suffix = readOnly ? null : <> {t('diff.submodule.canCommit')}</>

    if (oldSHA !== null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffModified, className: 'modified-icon' },
        <>
          <Trans
            k="diff.submodule.commitChanged"
            params={{
              previous: shortenSHA(oldSHA),
              new: shortenSHA(newSHA),
            }}
            components={{
              previous: (
                <ShaRef
                  sha={oldSHA}
                  copyAriaLabel={t('diff.submodule.copyPreviousSha')}
                />
              ),
              new: (
                <ShaRef
                  sha={newSHA}
                  copyAriaLabel={t('diff.submodule.copyNewSha')}
                />
              ),
            }}
          />
          {suffix}
        </>
      )
    } else if (oldSHA === null && newSHA !== null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffAdded, className: 'added-icon' },
        <>
          <Trans
            k={
              readOnly
                ? 'diff.submodule.commitAddedWas'
                : 'diff.submodule.commitAdded'
            }
            params={{ new: shortenSHA(newSHA) }}
            components={{
              new: (
                <ShaRef
                  sha={newSHA}
                  copyAriaLabel={t('diff.submodule.copySha')}
                />
              ),
            }}
          />
          {suffix}
        </>
      )
    } else if (oldSHA !== null && newSHA === null) {
      return this.renderSubmoduleDiffItem(
        { octicon: octicons.diffRemoved, className: 'removed-icon' },
        <>
          <Trans
            k={
              readOnly
                ? 'diff.submodule.commitRemovedWas'
                : 'diff.submodule.commitRemoved'
            }
            params={{ previous: shortenSHA(oldSHA) }}
            components={{
              previous: (
                <ShaRef
                  sha={oldSHA}
                  copyAriaLabel={t('diff.submodule.copySha')}
                />
              ),
            }}
          />
          {suffix}
        </>
      )
    }

    return null
  }

  private renderSubmodulesChangesInfo() {
    const { diff } = this.props

    if (!diff.status.untrackedChanges && !diff.status.modifiedChanges) {
      return null
    }

    const changes =
      diff.status.untrackedChanges && diff.status.modifiedChanges
        ? t('diff.submodule.changesModifiedAndUntracked')
        : diff.status.untrackedChanges
        ? t('diff.submodule.changesUntracked')
        : t('diff.submodule.changesModified')

    return this.renderSubmoduleDiffItem(
      { octicon: octicons.fileDiff, className: 'untracked-icon' },
      <>{t('diff.submodule.pendingChanges', { changes })}</>
    )
  }

  private renderSubmoduleDiffItem(
    icon: SubmoduleItemIcon,
    content: React.ReactElement
  ) {
    return (
      <div className="item">
        <Octicon symbol={icon.octicon} className={icon.className} />
        <div className="content">{content}</div>
      </div>
    )
  }

  private renderOpenSubmoduleAction() {
    // If no url is found for the submodule, it means it can't be opened
    // This happens if the user is looking at an old commit which references
    // a submodule that got later deleted.
    if (this.props.diff.url === null) {
      return null
    }

    return (
      <span>
        <SuggestedAction
          title={t('diff.submodule.openTitle')}
          description={t('diff.submodule.openDescription')}
          buttonText={t('diff.submodule.openButton')}
          type="primary"
          onClick={this.onOpenSubmoduleClick}
        />
      </span>
    )
  }

  private onOpenSubmoduleClick = () => {
    this.props.onOpenSubmodule?.(this.props.diff.fullPath)
  }
}
