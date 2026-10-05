import * as React from 'react'
import { DialogContent } from '../dialog'
import { LinkButton } from '../lib/link-button'
import { CallToAction } from '../lib/call-to-action'
import { t, Trans } from '../../lib/l10n'

const HelpURL = 'https://help.github.com/articles/about-remote-repositories/'

interface INoRemoteProps {
  /** The function to call when the users chooses to publish. */
  readonly onPublish: () => void
}

/** The component for when a repository has no remote. */
export class NoRemote extends React.Component<INoRemoteProps, {}> {
  public render() {
    return (
      <DialogContent>
        <CallToAction
          actionTitle={t('repositorySettings.publish')}
          onAction={this.props.onPublish}
        >
          <Trans
            k="repositorySettings.no-remote-message"
            components={{ link: <LinkButton uri={HelpURL} /> }}
            className="no-remote-publish-message"
            as="div"
          />
        </CallToAction>
      </DialogContent>
    )
  }
}
