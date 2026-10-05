import * as React from 'react'
import { t, Trans } from '../../../lib/l10n'
import { ImageContainer } from './image-container'
import { ICommonImageDiffProperties } from './modified-image-diff'
import { ISize } from './sizing'
import { formatBytes } from '../../lib/bytes'
import classNames from 'classnames'

function percentDiff(previous: number, current: number) {
  return `${Math.abs(Math.round((current / previous) * 100))}%`
}

interface ITwoUpProps extends ICommonImageDiffProperties {
  readonly previousImageSize: ISize | null
  readonly currentImageSize: ISize | null
}

export class TwoUp extends React.Component<ITwoUpProps, {}> {
  public render() {
    const zeroSize = { width: 0, height: 0 }
    const previousImageSize = this.props.previousImageSize || zeroSize
    const currentImageSize = this.props.currentImageSize || zeroSize

    const { current, previous } = this.props

    const diffPercent = percentDiff(previous.bytes, current.bytes)
    const diffBytes = current.bytes - previous.bytes
    const diffBytesSign = diffBytes >= 0 ? '+' : ''

    const style: React.CSSProperties = {
      maxWidth:
        this.props.maxSize.width < 200 ? undefined : this.props.maxSize.width,
    }

    return (
      <div className="image-diff-container" ref={this.props.onContainerRef}>
        <div className="image-diff-two-up">
          <div className="image-diff-previous" style={style}>
            <div className="image-diff-header">{t('diff.image.deleted')}</div>
            <ImageContainer
              image={previous}
              onElementLoad={this.props.onPreviousImageLoad}
            />

            <div className="image-diff-footer">
              <Trans
                k="diff.image.dimensions"
                params={{
                  width: previousImageSize.width,
                  height: previousImageSize.height,
                  size: formatBytes(previous.bytes, 2),
                }}
                components={{
                  w: <span className="strong" />,
                  h: <span className="strong" />,
                  s: <span className="strong" />,
                }}
              />
            </div>
          </div>

          <div className="image-diff-current" style={style}>
            <div className="image-diff-header">{t('diff.image.added')}</div>
            <ImageContainer
              image={current}
              onElementLoad={this.props.onCurrentImageLoad}
            />

            <div className="image-diff-footer">
              <Trans
                k="diff.image.dimensions"
                params={{
                  width: currentImageSize.width,
                  height: currentImageSize.height,
                  size: formatBytes(current.bytes, 2),
                }}
                components={{
                  w: <span className="strong" />,
                  h: <span className="strong" />,
                  s: <span className="strong" />,
                }}
              />
            </div>
          </div>
        </div>
        <div className="image-diff-summary">
          {t('diff.image.diffLabel')}{' '}
          <span
            className={classNames({
              added: diffBytes > 0,
              removed: diffBytes < 0,
            })}
          >
            {diffBytes !== 0
              ? `${diffBytesSign}${formatBytes(diffBytes, 2)} (${diffPercent})`
              : t('diff.image.noSizeDifference')}
          </span>
        </div>
      </div>
    )
  }
}
