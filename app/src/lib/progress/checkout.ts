import { GitProgressParser } from './git'

// l10n-ignore: этот заголовок git сравнивает со своим выводом дословно
// (GitProgressParser.parse), поэтому перевод срывает сопоставление шага.
const steps = [{ title: 'Checking out files', weight: 1 }]

/**
 * A class that parses output from `git checkout --progress` and provides
 * structured progress events.
 */
export class CheckoutProgressParser extends GitProgressParser {
  public constructor() {
    super(steps)
  }
}
