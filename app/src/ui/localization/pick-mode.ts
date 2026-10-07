const PickModeClass = 'l10n-pick-mode'
const PickTargetClass = 'l10n-pick-target'
const KeySelector = '[data-l10n-key]'

/** Past this length the click landed on a paragraph rather than a label, and
 * searching for a whole sentence would name no catalog entry. */
const MaxPickedText = 80

type PickHandler = (query: string) => void

/**
 * Point-and-translate: while armed, the interface itself becomes the picker.
 *
 * Every listener lives on `document` in the capture phase so a pick can swallow
 * the click before any React handler in the app sees it, and the whole session
 * is torn down as a unit — re-arming replaces the previous session instead of
 * stacking a second set of listeners on top of it.
 */
class PickModeSession {
  private readonly onPicked: PickHandler
  private readonly onCancelled: () => void
  private highlighted: Element | undefined

  public constructor(onPicked: PickHandler, onCancelled: () => void) {
    this.onPicked = onPicked
    this.onCancelled = onCancelled

    document.body.classList.add(PickModeClass)
    document.addEventListener('mouseover', this.onMouseOver, true)
    document.addEventListener('mouseout', this.onMouseOut, true)
    document.addEventListener('click', this.onClick, true)
    document.addEventListener('keydown', this.onKeyDown, true)
  }

  private readonly onMouseOver = (event: Event) => {
    this.highlight(pickTarget(event))
  }

  private readonly onMouseOut = () => {
    this.highlight(undefined)
  }

  private readonly onClick = (event: Event) => {
    // A pick must never reach the application: the click would otherwise open
    // menus and toggle the controls underneath the cursor.
    event.preventDefault()
    event.stopPropagation()

    const query = pickedQuery(event)
    if (query === undefined) {
      return
    }

    disarmPickMode()
    this.onPicked(query)
  }

  private readonly onKeyDown = (event: Event) => {
    if ((event as KeyboardEvent).key !== 'Escape') {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    disarmPickMode()
    this.onCancelled()
  }

  private highlight(target: Element | undefined) {
    if (this.highlighted !== undefined && this.highlighted !== target) {
      this.highlighted.classList.remove(PickTargetClass)
    }

    this.highlighted = target
    target?.classList.add(PickTargetClass)
  }

  public teardown() {
    document.body.classList.remove(PickModeClass)
    document.removeEventListener('mouseover', this.onMouseOver, true)
    document.removeEventListener('mouseout', this.onMouseOut, true)
    document.removeEventListener('click', this.onClick, true)
    document.removeEventListener('keydown', this.onKeyDown, true)
    this.highlight(undefined)
  }
}

let session: PickModeSession | undefined

export function armPickMode(onPicked: PickHandler, onCancelled: () => void) {
  disarmPickMode()
  session = new PickModeSession(onPicked, onCancelled)
}

export function disarmPickMode() {
  session?.teardown()
  session = undefined
}

export function isPickModeArmed() {
  return session !== undefined
}

/**
 * The element a click would report. The hover highlight uses it too, so
 * whatever lights up is exactly what the click hands back.
 */
function pickTarget(event: Event): Element | undefined {
  const element = event.target instanceof Element ? event.target : undefined

  if (element === undefined) {
    return undefined
  }

  const keyed = element.closest<HTMLElement>(KeySelector)
  if (keyed !== null) {
    return keyed
  }

  return pickedText(element) === undefined ? undefined : element
}

function pickedText(element: Element): string | undefined {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim()

  return text === '' || text.length > MaxPickedText ? undefined : text
}

function pickedQuery(event: Event): string | undefined {
  const target = pickTarget(event)

  if (target === undefined) {
    return undefined
  }

  const key = target.getAttribute('data-l10n-key')
  if (key !== undefined && key !== null && key !== '') {
    return key
  }

  // Only `Trans` wrappers carry a key and they are few: most of the interface
  // gets its words through `t()`, which returns plain text. The editor's search
  // matches the original wording as well as its translation, so the text under
  // the cursor finds the same row without any attribute.
  return pickedText(target)
}
