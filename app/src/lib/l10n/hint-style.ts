import { localization } from './core'

/** A piece of a rendered hint and the class that gives it its shape. */
export interface IHintRun {
  readonly text: string
  readonly className: string
}

/**
 * The translated text the hint sits under. It gets its own run so that it can
 * carry the heavier weight of a dictionary headword without that reaching the
 * rest of the interface.
 */
export const OriginalClass = 'l10n-original'

/** The Cyrillic reading, in brackets, italic. */
export const ReadingClass = 'l10n-reading'

/** The glossary language. */
export const MeaningClass = 'l10n-meaning'

/**
 * The two halves of a hint as the runs that draw them.
 *
 * Built from the parts rather than by cutting up `getHint`'s string: the
 * renderer knows which half is which and has nothing to re-guess. What it does
 * copy from `getHint` is the layout — a reading in brackets, a space, the
 * meaning — because that same string is what the observer below has to cut
 * apart for the labels that reach the DOM as one piece of text.
 */
export function hintRuns(
  reading: string | undefined,
  meaning: string | undefined
): ReadonlyArray<IHintRun> {
  const runs: IHintRun[] = []

  if (reading !== undefined && reading !== '') {
    runs.push({ text: `[${reading}]`, className: ReadingClass })
  }

  if (meaning !== undefined && meaning !== '') {
    runs.push({
      text: runs.length === 0 ? meaning : ` ${meaning}`,
      className: MeaningClass,
    })
  }

  return runs
}

/**
 * A whole hint line: a bracketed reading, then anything up to the end of that
 * line and nothing else. Anchored at both ends, so a line that merely begins
 * with a bracket — a branch called `[wip]`, a markdown checkbox — is not
 * mistaken for one.
 */
const HintLine = /^\[[^\]\n]+\][^\n]*$/

/**
 * A composed `block` label cut into runs, or `undefined` when the text carries
 * no hint.
 *
 * `translate` appends the hint as the last line, so the boundary is the last
 * newline and the shape is `HintLine`. Both halves of that measure belong to
 * the composition in `core`: should the separator or the brackets change there,
 * this answers `undefined` and the label simply stays unstyled — the words are
 * still the right ones, only the typeface is missing.
 */
export function styledRuns(value: string): ReadonlyArray<IHintRun> | undefined {
  const boundary = value.lastIndexOf('\n')

  if (boundary < 0) {
    return undefined
  }

  const line = value.slice(boundary + 1)

  if (!HintLine.test(line)) {
    return undefined
  }

  const reading = line.slice(0, line.indexOf(']') + 1)
  const meaning = line.slice(reading.length)

  const runs: IHintRun[] = [
    { text: value.slice(0, boundary + 1), className: OriginalClass },
    { text: reading, className: ReadingClass },
  ]

  if (meaning !== '') {
    runs.push({ text: meaning, className: MeaningClass })
  }

  return runs
}

/**
 * Elements a run must never be put into: their text is read back as a value by
 * the platform (`option`, `textarea`) or is not language at all (`script`), so
 * splitting it there would change what the app submits, not how it looks.
 */
const HostsToSkip = 'option, textarea, select, title, script, style'

type Styled = {
  /** The text React last wrote, which is what the runs were built from. */
  readonly text: string
  readonly nodes: ReadonlyArray<HTMLElement>
}

/**
 * One entry per React-owned text node.
 *
 * The text node keeps its place in the tree and is left holding nothing: React
 * writes new strings into that exact node, so the node has to stay where it is
 * and stay reachable. The words the user reads live in the spans after it. That
 * is also why the label's `textContent` comes out the same as before — an empty
 * node plus runs carrying the whole string — and point-and-translate, text
 * selection and search all still find the text they always saw.
 */
const styled = new WeakMap<Text, Styled>()

/** The runs this module created, so the observer can tell them from content. */
const own = new WeakSet<Node>()

/**
 * Only `block` composes a hint into the text itself; `tooltip` hands it to the
 * popup's own elements and `off` composes nothing. Without a transcription
 * table no line can start with a bracket, so the pass would find nothing and is
 * skipped instead.
 */
function isActive() {
  return (
    localization.getGlossMode() === 'block' &&
    localization.getTranslitScheme() !== undefined
  )
}

function unstyle(text: Text) {
  const entry = styled.get(text)

  if (entry !== undefined) {
    for (const node of entry.nodes) {
      node.remove()
    }
    styled.delete(text)
  }
}

/**
 * Re-derives one text node from the string React wrote into it.
 */
function apply(text: Text) {
  const value = text.data
  const runs = isActive() ? styledRuns(value) : undefined
  const parent = text.parentElement

  if (
    runs === undefined ||
    parent === null ||
    parent.closest(HostsToSkip) !== null
  ) {
    unstyle(text)
    return
  }

  const entry = styled.get(text)

  if (entry !== undefined) {
    // Already drawn from this very string and still sitting next to the node:
    // nothing to do. Everything else — a new string, or runs something moved
    // away — is rebuilt below, and the runs of the old string have to leave
    // first, or the label would read its hint twice.
    if (entry.text === value && entry.nodes[0]?.previousSibling === text) {
      return
    }

    unstyle(text)
  }

  const nodes = runs.map(run => {
    const span = document.createElement('span')
    span.className = run.className
    span.textContent = run.text
    own.add(span)
    return span
  })

  // Blank first, then insert: from here the runs are the only visible copy of
  // the string, and React's next write has to be a change that can be seen.
  text.data = ''

  const reference = text.nextSibling

  for (const node of nodes) {
    parent.insertBefore(node, reference)
  }

  styled.set(text, { text: value, nodes })
}

/**
 * Every text node of a subtree, skipping the hosts that must not be split and
 * the runs the layer itself drew.
 */
function collect(node: Node, into: Array<Text>) {
  if (own.has(node)) {
    return
  }

  if (node.nodeType === Node.TEXT_NODE) {
    into.push(node as Text)
    return
  }

  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).matches(HostsToSkip)
  ) {
    return
  }

  for (const child of Array.from(node.childNodes)) {
    collect(child, into)
  }
}

/**
 * Lets go of the runs belonging to text nodes that left the document. A text
 * node can be removed on its own while its runs stay behind, and those are what
 * this is here for; when a whole row goes, both halves of an entry go with it,
 * and removing an already detached node costs nothing.
 */
function forget(node: Node) {
  const found: Array<Text> = []
  collect(node, found)

  for (const text of found) {
    unstyle(text)
  }
}

function onMutations(records: ReadonlyArray<MutationRecord>) {
  const found = new Set<Text>()

  for (const record of records) {
    if (record.type === 'characterData') {
      if (
        !own.has(record.target) &&
        record.target.nodeType === Node.TEXT_NODE
      ) {
        found.add(record.target as Text)
      }
      continue
    }

    for (const removed of Array.from(record.removedNodes)) {
      forget(removed)
    }

    for (const added of Array.from(record.addedNodes)) {
      const texts: Array<Text> = []
      collect(added, texts)
      for (const text of texts) {
        found.add(text)
      }
    }
  }

  for (const text of found) {
    apply(text)
  }

  // Whatever is queued from here on is our own doing: the blanks, the runs put
  // in, the runs taken out. Dropping those records is what keeps this handler
  // from being called for its own edits, and it cannot swallow a write of
  // React's, because nothing else can touch the DOM while this runs.
  observer?.takeRecords()
}

/** Reads every text node already on screen. */
function rescan() {
  if (typeof document === 'undefined' || document.body === null) {
    return
  }

  const found: Array<Text> = []
  collect(document.body, found)

  for (const text of found) {
    apply(text)
  }

  observer?.takeRecords()
}

let observer: MutationObserver | undefined

/**
 * Turns the dictionary shape on: the reading in italics, the text it belongs to
 * and the glossary language in the heavier weight.
 *
 * Called once, before the first render. The layer is a `MutationObserver`
 * rather than a wrapper component because a translated string reaches the DOM
 * through `t('…')` in about a thousand places — inside JSX text, into a
 * `label`, a `title`, an `aria-label` — and not one of them can hold an element
 * the hint could be styled from. The text node is the only place all of them
 * pass through.
 *
 * A language or mode change needs no special pass of its own: React rewrites
 * every one of those labels with its own string, and a write into a node this
 * layer holds is exactly the record that re-derives it.
 */
export function startHintStyling(): void {
  if (observer !== undefined) {
    return
  }

  observer = new MutationObserver(records => onMutations(records))

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  })

  rescan()
}
