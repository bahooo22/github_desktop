import * as React from 'react'
import { Tooltip } from '../../ui/lib/tooltip'
import { createObservableRef } from '../../ui/lib/observable-ref'

/**
 * The elements a translated string can sit inside that take focus themselves.
 * A `span` target nested in a button is never the focused element, so the
 * button is what has to be watched — see `onAncestorFocus`.
 */
const FocusableSelector =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

interface IL10nHintProps {
  /** The hint lines, in the order the catalog produces them. */
  readonly parts: ReadonlyArray<string>

  readonly children: React.ReactNode
}

interface IL10nHintState {
  readonly ancestorFocused: boolean

  /**
   * Set when the user dismissed the popup with Escape. While it stands the
   * `Tooltip` is not rendered at all, which is the only way to hide a popup
   * that is already visible from outside it: the component hides itself on
   * mouse, blur, and ancestor-focus transitions, and none of those happen just
   * because a key was pressed. Unmounting is also what stops the popup from
   * coming back on the next mousemove over the same word.
   */
  readonly dismissed: boolean
}

/**
 * The `tooltip` gloss form: the translated text is left alone and the hint
 * floats above it on hover and on keyboard focus.
 *
 * Hover comes from the upstream `Tooltip` for free. Focus needs both of the
 * ready-made channels, because the two ways a keyboard can reach a translated
 * string are on opposite sides of the target:
 *
 * - The label sits inside a button. The `span` is then never the focused
 *   element, and the tooltip opens on focus only when the target itself matches
 *   `:focus-visible` (`tooltip.tsx:465-475`), so this component watches the
 *   nearest focusable ancestor and feeds the `ancestorFocused` prop — the same
 *   way the file status icons in the changes list stay open while their row is
 *   focused.
 * - The label carries its own links (`about.l10nCredit`,
 *   `welcome.termsAndPrivacy`). Those are inside the target, and `focusin`
 *   bubbles down to it, so `openOnFocus` opens the hint for them. Without it
 *   neither channel covers the screens that are reachable without a repository,
 *   which is where the gloss is read the most.
 */
export class L10nHint extends React.Component<IL10nHintProps, IL10nHintState> {
  private targetRef = createObservableRef<HTMLElement>()
  private ancestor: Element | undefined

  public state: IL10nHintState = { ancestorFocused: false, dismissed: false }

  public componentDidMount() {
    const target = this.targetRef.current

    if (target === null) {
      return
    }

    // These two are the custom events `Tooltip` dispatches on its target when
    // the popup appears and disappears. The Escape handler only exists while
    // something is on screen to dismiss.
    target.addEventListener('tooltip-shown', this.onTooltipShown)
    target.addEventListener('tooltip-hidden', this.onTooltipHidden)

    const ancestor = target.closest(FocusableSelector)

    if (ancestor !== null) {
      this.ancestor = ancestor
      ancestor.addEventListener('focus', this.onAncestorFocus)
      ancestor.addEventListener('blur', this.onAncestorBlur)
    }
  }

  public componentWillUnmount() {
    const target = this.targetRef.current

    if (target !== null) {
      target.removeEventListener('tooltip-shown', this.onTooltipShown)
      target.removeEventListener('tooltip-hidden', this.onTooltipHidden)
    }

    this.ancestor?.removeEventListener('focus', this.onAncestorFocus)
    this.ancestor?.removeEventListener('blur', this.onAncestorBlur)

    document.removeEventListener('keydown', this.onKeyDown)
  }

  private onAncestorFocus = () => {
    this.setState({ ancestorFocused: true, dismissed: false })
  }

  private onAncestorBlur = () => {
    this.setState({ ancestorFocused: false })
  }

  /**
   * Leaving the word ends the hover trigger, and with it the dismissal: the
   * next time the pointer comes back the hint is shown again.
   */
  private onTargetMouseLeave = () => {
    this.setState({ dismissed: false })
  }

  private onTooltipShown = () => {
    document.addEventListener('keydown', this.onKeyDown)
  }

  private onTooltipHidden = () => {
    document.removeEventListener('keydown', this.onKeyDown)
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      this.setState({ dismissed: true })
    }
  }

  public render() {
    const { parts, children } = this.props
    const { ancestorFocused, dismissed } = this.state

    return (
      <span
        className="l10n-hint"
        ref={this.targetRef}
        onMouseLeave={this.onTargetMouseLeave}
      >
        {children}
        {/* The popup is the tooltip's own portal; the host element stays where
            the pointer hovers and keeps the `l10n-hint` class. The key the
            editor picks a string by is on the `Trans` wrapper above this one,
            and `pickTarget` reaches it with `closest`. */}
        {!dismissed && (
          <Tooltip
            target={this.targetRef}
            interactive={true}
            openOnFocus={true}
            className="selectable l10n-hint-tooltip"
            ancestorFocused={ancestorFocused}
            positionRelativeToTarget={true}
          >
            {/* A newline would collapse here: `.tooltip-content` has no
                `white-space: pre-line`, so each part is its own block. */}
            {parts.map((part, index) => (
              <div key={index}>{part}</div>
            ))}
          </Tooltip>
        )}
      </span>
    )
  }
}
