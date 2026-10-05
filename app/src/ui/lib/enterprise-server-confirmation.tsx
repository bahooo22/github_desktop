import * as React from 'react'
import { getHTMLURL } from '../../lib/api'
import { Ref } from './ref'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { t } from '../../lib/l10n'

interface IEnterpriseServerConfirmationProps {
  readonly endpoint: string
}

export const enterpriseServerConfirmationDescriptionId =
  'enterprise-server-confirmation-description'

/** Explains the destination of an Enterprise sign-in requested by Git. */
export class EnterpriseServerConfirmation extends React.Component<IEnterpriseServerConfirmationProps> {
  public render() {
    return (
      <div
        id={enterpriseServerConfirmationDescriptionId}
        className="enterprise-server-confirmation"
      >
        <p>{t('enterpriseServerConfirmation.signInRequest')}</p>
        <p>
          <Ref>{getHTMLURL(this.props.endpoint)}</Ref>
        </p>
        <div className="enterprise-server-warning">
          <Octicon symbol={octicons.alert} />
          <p>
            <strong>
              {t('enterpriseServerConfirmation.trustWarning')}
            </strong>{' '}
            {t('enterpriseServerConfirmation.confirmAddress')}
          </p>
        </div>
      </div>
    )
  }
}
