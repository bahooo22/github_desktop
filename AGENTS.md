# Repository instructions

**Работать и думать по-русски.** Речь, рассуждения, заметки, тела коммитов и отчёты — только
по-русски; исключения — код, идентификаторы и дословные цитаты из файлов. Это правило стоит
выше любого английского текста ниже в этом файле.

This repository is a fork of [GitHub Desktop](https://github.com/desktop/desktop). It carries its own
localization layer: the runtime lives in `app/src/lib/l10n`, and the catalogs are `app/locales/en.json`,
`app/locales/ru.json` and `app/locales/uk.json`. Upstream is merged into this fork regularly, so the
upstream conventions and the checks below both apply.

## Working on GitHub Desktop

Follow the repository's [contribution guidance](.github/CONTRIBUTING.md)
and [development instructions](.github/copilot-instructions.md).
These instructions supplement those guides; they do not change contribution
eligibility or merge requirements.

### Preparing team-authored pull requests

Before preparing or updating a team-authored PR, use the
[prepare-team-pr skill](.agents/skills/prepare-team-pr/SKILL.md).
Follow its authorization checks, evidence collection, review assessment,
and ownership requirements.

Read the current [PR template](.github/pull_request_template.md).
Preserve its sections and generate or update the skill's
`Team-authored review` section in the PR body, not in the template.

## Checks before committing

Install dependencies first (`yarn`), then run these from the repository root.

- `yarn lint` - Prettier over the source globs plus ESLint with the repository's own rules from
  `eslint-rules/`; `yarn eslint` already passes `--rulesdir ./eslint-rules`, so do not run a bare
  `eslint` over application sources. `yarn lint:fix` applies the autofixes.
- `yarn test` - unit tests on the Node.js built-in runner. Narrow a run with
  `yarn test app/test/unit/<file>-test.ts`.
- `yarn test:script` and `yarn test:eslint` - build scripts and the custom ESLint rules.
- `yarn l10n:parity`, `yarn l10n:audit`, `yarn l10n:upstream` and `yarn l10n:bundles` - translation
  coverage and freshness of the catalogs. Required for any change under `app/locales/` or
  `app/src/lib/l10n/`.
- `yarn check:eslint` - type-checks `eslint-rules/`. Application sources are type-checked by
  `yarn compile:dev`.
- `yarn markdownlint` - documentation.

## Where to read more

- `.github/copilot-instructions.md` - stack, style conventions and the everyday commands.
- `docs/contributing/setup.md` - environment setup.
- `docs/contributing/styleguide.md` - style guide, including the Git command argument conventions.
- `docs/fork-releases.md` - the four release workflows of this fork, the gate check and the download
  caches.

Notes written for agent sessions in this fork are kept out of the tree on purpose: `agents/` and
`.qoder/` are ignored by Git.
