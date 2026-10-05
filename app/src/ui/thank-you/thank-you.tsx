import * as React from 'react'
import { DesktopFakeRepository } from '../../lib/desktop-fake-repository'
import { ReleaseNote } from '../../models/release-notes'
import { Dialog, DialogContent } from '../dialog'
import { RichText } from '../lib/rich-text'
import Confetti from 'react-confetti'
import { Emoji } from '../../lib/emoji'
import { t } from '../../lib/l10n'

interface IThankYouProps {
  readonly onDismissed: () => void
  readonly emoji: Map<string, Emoji>
  readonly userContributions: ReadonlyArray<ReleaseNote>
  readonly friendlyName: string
  readonly latestVersion: string | null
}

interface IThankYouState {
  readonly confettiHost?: HTMLDialogElement
  readonly confettiRect?: DOMRect
}

export class ThankYou extends React.Component<IThankYouProps, IThankYouState> {
  public constructor(props: IThankYouProps) {
    super(props)
    this.state = {}
  }
  private renderList(
    releaseEntries: ReadonlyArray<ReleaseNote>
  ): JSX.Element | null {
    if (releaseEntries.length === 0) {
      return null
    }

    const options = new Array<JSX.Element>()

    for (const [i, entry] of releaseEntries.entries()) {
      options.push(
        <li key={i}>
          <RichText
            text={entry.message}
            emoji={this.props.emoji}
            renderUrlsAsLinks={true}
            repository={DesktopFakeRepository}
          />
        </li>
      )
    }

    return (
      <div className="section">
        <ul className="entries">{options}</ul>
      </div>
    )
  }

  private renderConfetti() {
    const { confettiHost } = this.state
    if (confettiHost) {
      const { left, top } = this.state.confettiRect ?? { left: 0, top: 0 }

      return (
        <Confetti
          recycle={false}
          numberOfPieces={750}
          width={window.innerWidth}
          height={window.innerHeight}
          style={{ left, top }}
        />
      )
    }

    return undefined
  }

  private updateConfettiRect = (e: Event) => {
    if (e.currentTarget instanceof HTMLElement) {
      const { offsetLeft: x, offsetTop: y } = e.currentTarget
      const { innerWidth: w, innerHeight: h } = window
      const confettiRect = new DOMRect(-Math.round(x), -Math.round(y), w, h)
      this.setState({ confettiRect })
    }
  }

  private onDialogRef = (dialog: HTMLDialogElement | null) => {
    this.setState({ confettiHost: dialog ?? undefined })
    dialog?.addEventListener('dialog-show', this.updateConfettiRect)
  }

  public render() {
    const version =
      this.props.latestVersion !== null ? ` ${this.props.latestVersion}` : ''
    const friendlyName = this.props.friendlyName
    const thankYouNote = t('thankYou.note', { version })
    const title = `${t('thankYou.title', { name: friendlyName })} 🎉`

    return (
      <Dialog
        id="thank-you-notes"
        onDismissed={this.props.onDismissed}
        title={title}
        onDialogRef={this.onDialogRef}
      >
        <DialogContent>
          <div className="container">
            <div className="thank-you-note">{thankYouNote}</div>
            <div className="contributions-heading">
              {t('thankYou.contributed')}
            </div>
            <div className="contributions">
              {this.renderList(this.props.userContributions)}
            </div>
            {this.renderConfetti()}
          </div>
        </DialogContent>
      </Dialog>
    )
  }
}
