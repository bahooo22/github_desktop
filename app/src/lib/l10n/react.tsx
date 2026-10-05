import * as React from 'react'
import { localization } from './core'
import { interpolate } from './format'
import { TranslationParameters } from './types'

const listeners = new Set<() => void>()

localization.subscribe(() => {
  for (const listener of listeners) {
    listener()
  }
})

/**
 * Re-renders the caller whenever the active language changes. Components below
 * `LocalizationProvider` don't need this, but anything rendered outside of it
 * (portals, the crash window) should call it to stay in sync.
 */
export function useLocalization(): {
  tag: string
  direction: 'ltr' | 'rtl'
  translate: (key: string, params?: TranslationParameters) => string
} {
  const [, forceUpdate] = React.useState(0)

  React.useEffect(() => {
    const listener = () => forceUpdate(x => x + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    tag: localization.getActiveTag(),
    direction: getDirection(),
    translate: (key, params) => localization.translate(key, params),
  }
}

export function getDirection(): 'ltr' | 'rtl' {
  return localization.getLocale(localization.getActiveTag())?.direction ?? 'ltr'
}

type ProviderProps = { children: JSX.Element | ReadonlyArray<JSX.Element> }

/**
 * Applies the document language and writing direction, and re-renders the tree
 * when the language changes so that everything below it picks up new strings
 * without a restart.
 */
export class LocalizationProvider extends React.Component<
  ProviderProps,
  { revision: number }
> {
  private subscription: (() => void) | undefined

  public constructor(props: ProviderProps) {
    super(props)
    this.state = { revision: 0 }
  }

  public componentDidMount() {
    this.subscription = localization.subscribe(() =>
      this.setState({ revision: this.state.revision + 1 })
    )
    this.applyDocumentAttributes()
  }

  public componentDidUpdate() {
    this.applyDocumentAttributes()
  }

  public componentWillUnmount() {
    this.subscription?.()
  }

  private applyDocumentAttributes() {
    document.documentElement.lang = localization.getActiveTag()
    document.documentElement.dir = getDirection()
  }

  public render() {
    return this.props.children
  }
}

export type TransComponents = Readonly<
  Record<string, React.ReactElement<any> | string>
>

type TransProps = Omit<React.HTMLAttributes<HTMLElement>, 'children'> & {
  /** Catalog key, e.g. `changes.n-files`. */
  readonly k: string
  readonly params?: TranslationParameters
  /**
   * Elements to place around the message's `<name>` tags, e.g.
   * `components={{ link: <a href="..." /> }}`.
   */
  readonly components?: TransComponents
  /** Element to render as; `span` keeps inline text from breaking layout. */
  readonly as?: keyof JSX.IntrinsicElements
}

/**
 * Renders a message that contains markup, so translators keep the sentence in
 * one piece instead of assembling it from fragments in code.
 *
 * `Press <link>Cancel</link> to discard your changes` with
 * `components={{ link: <button onClick={...} /> }}`.
 *
 * The wrapper carries `data-l10n-key`, which is what lets the localization
 * editor point at a string on screen and find the entry behind it.
 */
export const Trans = ({
  k,
  params = {},
  components = {},
  as: element = 'span',
  ...rest
}: TransProps) => {
  const template = localization.getTemplate(k, params)
  const tag = localization.getActiveTag()

  const children =
    template === undefined
      ? [k]
      : renderTemplate(template, params, tag, components)

  return React.createElement(element, { ...rest, 'data-l10n-key': k }, children)
}

type Frame = { name: string; children: Array<React.ReactNode> }

function renderTemplate(
  template: string,
  params: TranslationParameters,
  tag: string,
  components: TransComponents
): ReadonlyArray<React.ReactNode> {
  const root: Array<React.ReactNode> = []
  const stack: Frame[] = []
  let text = ''
  let index = 0
  let key = 0

  const push = (node: React.ReactNode) => {
    const target = stack.length > 0 ? stack[stack.length - 1].children : root
    target.push(node)
  }

  const flushText = () => {
    if (text !== '') {
      const value = interpolate(text, params, tag)
      if (value !== '') {
        push(value)
      }
      text = ''
    }
  }

  while (index < template.length) {
    const open = template.indexOf('<', index)

    if (open === -1) {
      text += template.slice(index)
      break
    }

    text += template.slice(index, open)

    const close = template.indexOf('>', open)
    if (close === -1) {
      text += template.slice(open)
      break
    }

    const body = template.slice(open + 1, close).trim()
    const closing = body.startsWith('/')
    const selfClosing = body.endsWith('/')
    const name = (closing ? body.slice(1) : body).replace(/\/$/, '').trim()

    flushText()
    index = close + 1

    if (name === '') {
      continue
    }

    if (closing) {
      const frame = stack.pop()
      if (frame === undefined) {
        continue
      }

      const element = components[frame.name]
      push(
        element === undefined
          ? frame.children
          : typeof element === 'string'
            ? frame.children.length > 0
              ? frame.children
              : element
            : React.cloneElement(
                element,
                { key: key++ },
                frame.children.length > 0
                  ? frame.children
                  : element.props.children
              )
      )
      continue
    }

    if (selfClosing) {
      const element = components[name]
      if (element !== undefined) {
        push(
          typeof element === 'string'
            ? element
            : React.cloneElement(element, { key: key++ })
        )
      }
      continue
    }

    stack.push({ name, children: [] })
  }

  flushText()

  // An unclosed tag would otherwise swallow its content, so unwrap it.
  for (let frame = stack.pop(); frame; frame = stack.pop()) {
    const parent = stack.length > 0 ? stack[stack.length - 1].children : root
    parent.push(...frame.children)
  }

  return root
}
