import * as React from 'react'

import { encodePathAsUrl } from '../../lib/path'
import { t, Trans } from '../../lib/l10n'

const CodeImage = encodePathAsUrl(__dirname, 'static/code.svg')
const TeamDiscussionImage = encodePathAsUrl(
  __dirname,
  'static/github-for-teams.svg'
)
const CloudServerImage = encodePathAsUrl(
  __dirname,
  'static/github-for-business.svg'
)

export class TutorialWelcome extends React.Component {
  public render() {
    return (
      <div id="tutorial-welcome">
        <div className="header">
          <h1>{t('tutorialWelcome.title')}</h1>
          <p>{t('tutorialWelcome.intro')}</p>
        </div>
        <ul className="definitions">
          <li>
            <img src={CodeImage} alt={t('tutorialWelcome.altCode')} />
            <p>
              <Trans k="tutorialWelcome.gitDefinition" />
            </p>
          </li>
          <li>
            <img src={TeamDiscussionImage} alt={t('tutorialWelcome.altTeam')} />
            <p>
              <Trans k="tutorialWelcome.githubDefinition" />
            </p>
          </li>
          <li>
            <img src={CloudServerImage} alt={t('tutorialWelcome.altCloud')} />
            <p>
              <Trans k="tutorialWelcome.desktopDefinition" />
            </p>
          </li>
        </ul>
      </div>
    )
  }
}
