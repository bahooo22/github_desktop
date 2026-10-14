import * as React from 'react'
import { TooltippedContent } from './lib/tooltipped-content'
import { formatDate } from '../lib/format-date'
import { formatRelative, IFormatRelativeOptions } from '../lib/format-relative'
import { t } from '../lib/l10n'

interface IRelativeTimeProps {
  /**
   * The date instance that will be used for calculating
   * the relative time elapsed
   */
  readonly date: Date

  /**
   * By default the RelativeTime component will start displaying a compact
   * absolute date if the date is more than one week ago. Setting `onlyRelative`
   * to true overrides this behavior and forces relative times for all dates.
   */
  readonly onlyRelative?: boolean

  readonly className?: string

  /** Whether to show a tooltip with the absolute date on hover - Default = true */
  readonly tooltip?: boolean

  /**
   * Keep the relative form past a week instead of collapsing to an absolute date,
   * counted in whole weeks ('1 week ago', '3 weeks ago') and then months. Needs
   * `numeric: 'always'` under the hood, see `coarseAfterWeek` in
   * `format-relative.ts`.
   */
  readonly coarseAfterWeek?: boolean

  /**
   * Count in whole seconds for the first minute instead of showing 'just now'
   * until the minute is up, and re-render on every second boundary while doing
   * so. Only the age counters in the About dialog use this; everything else
   * keeps the upstream 'just now' wording.
   */
  readonly countSeconds?: boolean
}

interface IRelativeTimeState {
  readonly absoluteText: string
  readonly relativeText: string
}

const SECOND = 1000
const MINUTE = SECOND * 60
const HOUR = MINUTE * 60
const DAY = HOUR * 24

// The maximum value that can be used in setInterval or
// setTimeout without it overflowing (2 ^ 31 - 1). See
//  http://stackoverflow.com/a/16314807
const MAX_INTERVAL = 2147483647

type RelativeTimeInfo = {
  absoluteText: string
  relativeText: string
  duration?: number
}

export function getRelativeTimeInfoFromDate(
  then: Date,
  onlyRelative: boolean = true,
  options: IFormatRelativeOptions = {}
): RelativeTimeInfo {
  const diff = then.getTime() - Date.now()
  const duration = Math.abs(diff)

  const absoluteText = formatDate(then, {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const relativeText = formatRelative(diff, options)

  // Future date, let's just show as absolute and reschedule. If it's less
  // than a minute into the future we'll treat it as 'just now'.
  if (diff > 0 && duration > MINUTE) {
    return {
      absoluteText,
      relativeText: formatDate(then, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      duration,
    }
  } else if (duration < MINUTE) {
    // 'just now' would hide the counter for the whole first minute, so on
    // request we keep the seconds and reschedule on the next second boundary.
    // Under a second `formatRelative` would say 'now' (`numeric: 'auto'` on
    // zero) so that stays 'just now'.
    if (options.countSeconds === true && duration >= SECOND) {
      return {
        absoluteText,
        relativeText,
        duration: SECOND - (duration % SECOND),
      }
    }

    return {
      absoluteText,
      relativeText: t('relativeTime.justNow'),
      duration: MINUTE - duration,
    }
  } else if (duration < HOUR) {
    return { absoluteText, relativeText, duration: MINUTE }
  } else if (duration < DAY) {
    return { absoluteText, relativeText, duration: HOUR }
  } else if (duration < 7 * DAY) {
    return { absoluteText, relativeText, duration: 6 * HOUR }
  } else {
    if (onlyRelative || options.coarseAfterWeek) {
      // The weekly scale only moves once a week, but the existing 6 hour tick
      // stays: it is cheaper than tracking week boundaries by hand.
      return { absoluteText, relativeText, duration: 6 * HOUR }
    } else {
      // More than a week ago, just the date will suffice
      return {
        absoluteText,
        relativeText: formatDate(then, { time: false, dateStyle: 'medium' }),
      }
    }
  }
}

/**
 * An auto-updating component rendering a relative time in human readable form.
 *
 * Example: 'just now', '4 minutes ago', '3 days ago'.
 * or if abbreviated: 'just now', '4m', '3d'.
 *
 * For timestamps that are more than 7 days in the past the absolute
 * date is rendered instead.
 *
 * This component will automatically re-render when the relative time
 * changes by scheduling state changes at reasonable intervals.
 */
export class RelativeTime extends React.Component<
  IRelativeTimeProps,
  IRelativeTimeState
> {
  private timer: number | null = null

  public constructor(props: IRelativeTimeProps) {
    super(props)
    this.state = { absoluteText: '', relativeText: '' }
  }

  private clearTimer() {
    if (this.timer) {
      window.clearTimeout(this.timer)
      this.timer = null
    }
  }

  private updateAndSchedule(
    absoluteText: string,
    relativeText: string,
    timeout: number
  ) {
    this.clearTimer()
    this.timer = window.setTimeout(
      this.updateFromScheduler,
      Math.min(timeout, MAX_INTERVAL)
    )
    this.setState({ absoluteText, relativeText })
  }

  private updateWithDate(then: Date) {
    const { onlyRelative, coarseAfterWeek, countSeconds } = this.props

    const { absoluteText, relativeText, duration } =
      getRelativeTimeInfoFromDate(then, onlyRelative, {
        coarseAfterWeek,
        countSeconds,
      })

    if (duration !== undefined) {
      this.updateAndSchedule(absoluteText, relativeText, duration)
    } else {
      this.setState({ absoluteText, relativeText })
    }
  }

  private readonly updateFromScheduler = () => {
    this.updateWithDate(this.props.date)
  }

  public componentWillReceiveProps(nextProps: IRelativeTimeProps) {
    if (this.props.date !== nextProps.date) {
      this.updateWithDate(nextProps.date)
    }
  }

  public componentWillMount() {
    this.updateWithDate(this.props.date)
  }

  public componentWillUnmount() {
    this.clearTimer()
  }

  public shouldComponentUpdate(
    nextProps: IRelativeTimeProps,
    nextState: IRelativeTimeState
  ) {
    return (
      nextProps.date !== this.props.date ||
      nextState.absoluteText !== this.state.absoluteText ||
      nextState.relativeText !== this.state.relativeText
    )
  }

  public render() {
    if (this.props.tooltip === false) {
      return (
        <span className={this.props.className}>{this.state.relativeText}</span>
      )
    }

    return (
      <TooltippedContent
        className={this.props.className}
        tooltip={this.state.absoluteText}
      >
        {this.state.relativeText}
      </TooltippedContent>
    )
  }
}
