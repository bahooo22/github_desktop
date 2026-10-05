import * as React from 'react'
import { Dialog, DialogContent, DefaultDialogFooter } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { t, Trans } from '../../lib/l10n'

interface ITermsAndConditionsProps {
  /** A function called when the dialog is dismissed. */
  readonly onDismissed: () => void
}

const contact = 'https://github.com/contact'
const logos = 'https://github.com/logos'
const privacyStatement =
  'https://help.github.com/articles/github-privacy-statement/'
const license = 'https://creativecommons.org/licenses/by/4.0/'

export class TermsAndConditions extends React.Component<
  ITermsAndConditionsProps,
  {}
> {
  public render() {
    return (
      <Dialog
        id="terms-and-conditions"
        title={t('terms.title')}
        onSubmit={this.props.onDismissed}
        onDismissed={this.props.onDismissed}
      >
        <DialogContent>
          <p>{t('terms.intro')}</p>

          <h2>{t('terms.connecting-to-github')}</h2>

          <p>{t('terms.connecting-governed')}</p>

          <p>{t('terms.connecting-violation')}</p>

          <h2>{t('terms.open-source-licenses')}</h2>

          <p>{t('terms.licenses-notices')}</p>

          <p>
            <Trans
              k="terms.licenses-source-code-offer"
              components={{ link: <LinkButton uri={contact} /> }}
            />
          </p>

          <p>{t('terms.licenses-supersede')}</p>

          <h2>{t('terms.logos')}</h2>

          <p>{t('terms.logos-trademark-rights')}</p>

          <p>
            <Trans
              k="terms.logos-trademarks"
              components={{ link: <LinkButton uri={logos} /> }}
            />
          </p>

          <h2>{t('terms.privacy')}</h2>

          <p>
            <Trans
              k="terms.privacy-description"
              components={{ link: <LinkButton uri={privacyStatement} /> }}
            />
          </p>

          <h2>{t('terms.additional-services')}</h2>

          <h3>{t('terms.auto-update-services')}</h3>

          <p>{t('terms.auto-update-description')}</p>

          <h3>{t('terms.disclaimers')}</h3>

          <p>{t('terms.disclaimer-as-is')}</p>

          <p>{t('terms.disclaimer-liability')}</p>

          <p>{t('terms.disclaimer-modify')}</p>

          <h2>{t('terms.miscellanea')}</h2>

          <ol>
            <li>{t('terms.misc-no-waiver')}</li>

            <li>{t('terms.misc-entire-agreement')}</li>

            <li>{t('terms.misc-governing-law')}</li>

            <li>{t('terms.misc-third-party-packages')}</li>

            <li>{t('terms.misc-no-modifications')}</li>

            <li>
              <Trans
                k="terms.misc-license-to-policies"
                components={{ link: <LinkButton uri={license} /> }}
              />
            </li>

            <li>
              <Trans
                k="terms.misc-contact"
                components={{ link: <LinkButton uri={contact} /> }}
              />
            </li>
          </ol>
        </DialogContent>

        <DefaultDialogFooter />
      </Dialog>
    )
  }
}
