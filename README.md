# [GitHub Desktop](https://desktop.github.com)

[GitHub Desktop](https://desktop.github.com/) is an open-source [Electron](https://www.electronjs.org/)-based
GitHub app. It is written in [TypeScript](https://www.typescriptlang.org) and
uses [React](https://reactjs.org/).

<picture>
  <source
    srcset="https://user-images.githubusercontent.com/634063/202742848-63fa1488-6254-49b5-af7c-96a6b50ea8af.png"
    media="(prefers-color-scheme: dark)"
  />
  <img
    width="1072"
    src="https://user-images.githubusercontent.com/634063/202742985-bb3b3b94-8aca-404a-8d8a-fd6a6f030672.png"
    alt="A screenshot of the GitHub Desktop application showing changes being viewed and committed with two attributed co-authors"
  />
</picture>

## Этот форк

Форк GitHub Desktop с полностью локализованным интерфейсом: русский и
украинский языки (`app/locales/ru.json`, `app/locales/uk.json`), четыре учебных
каталога (`la`, `eo`, `tlh`, `qya`) и редактор
переводов, встроенный в само приложение. Латинский и эсперанто закрыты целиком
(остались бренды и чистые подстановки), клингонский и квенья закрыты батчами:
переведённых форм — 1 966 и 1 963 из 2 018, непереведённых — 52 и 55 формы
(юридический текст, бренды, шаблоны); в счётчике редактора готовыми отмечены
1 718 и 1 717 строк из 1 753. Справка CLI тоже локализована: `github-l10n --help`
печатает её на языке, выбранном в настройках.
Аудит клингонского закрыт: мера по словарю boQwI' и правилам Hol 'ampaS не
находит ни одной неподтверждённой формы. Обе меры проверяют форму слова, а не
его значение, поэтому сверху добавлена смысловая сверка по первичным словарям:
она выправила 8 уже закоммиченных форм (`gham` → `ghIgh mIw`, `latya` → `vehta`,
`vehtaina`, `antacina`, `lávima`) и закрепила в глоссарии термины, оставленные
сознательно. Остальное — апстрим: номер версии в
`app/package.json` совпадает с апстримным (после мержа 23.10.2026 —
`3.6.8`), а тулчейн форка — TypeScript 6.0.3, webpack 5.111,
Electron 44.9.1 на Node 24.22 (`.node-version`).

### Что здесь своё

| Область | Отличие от апстрима |
| --- | --- |
| Строки интерфейса | Тексты вынесены в `app/locales/en.json`, из него строятся ru и uk; скелет нового каталога даёт `yarn l10n:scaffold`; покрытие меряют `yarn l10n:parity`, `l10n:audit`, `l10n:upstream`, `l10n:menu`, а сколько строк ещё английских — `--untranslated <tag>`. Мнемоники проверяются по `builtInLocaleTags` — по тому же списку, по которому каталоги регистрируются, а значения, подставляемые внутрь чужой подписи, берутся через `tv()`: подсказка второй строки не должна появляться в середине метки меню |
| Настройки → Язык | Выбор языка интерфейса, редактор переводов с сохранением в свой каталог и режим «выбрать строку кликом». Для языков, записанных транскрипцией, каталог задаёт `meta.gloss`, и в «Языке» появляется чекбокс «Показывать перевод-подсказку» с выбором вида. Подсказка всегда одна и та же словарная строка — `[кириллическое чтение] русский перевод`, где чтение курсивом, а подпись и перевод полужирным; режим решает только, куда она попадает: второй строкой под подписью, после тире в нативном меню (его подпись держит одну строку) либо во всплывающей подсказке над строкой. Вторая строка показывается в кнопках, вкладках, подсказках, заголовках, абзацах, списках, подписях полей и баннерах диалогов; остальной интерфейс сохраняет обычную обработку пробелов |
| Идентификатор Squirrel | `GitHubDesktopL10n` вместо `GitHubDesktop`: отдельный каталог в `%LOCALAPPDATA%` и свой фид, поэтому форк и стоковая сборка не перезаписывают друг друга. Имя ярлыка разводится отдельно (`getWindowsShortcutName()`, `script/dist-info.ts`): Squirrel называет `.lnk` по `FileDescription` exe, и с апстримным значением обе редакции писали бы один `GitHub Desktop.lnk`. CLI ставится как `github-l10n`: каталоги `bin` у редакций разные, а имя команды было общее, так что `github` разыгрывался порядком `PATH` |
| Релизы | Пять workflow: `Release Fork (Windows)` публикует в `latest-win-x64` или `latest-win-arm64` (вход `arch`), `Release Fork (Linux)` — в `latest-linux-x64`, `Release Fork (macOS)` — в `latest-macos-arm64` или `latest-macos-x64`, каждый прогон трогает только свой тег; `Release Fork (Windows all arches)` и `Release Fork (All platforms)` вызывают те же файлы матрицей, чтобы все фиды стартовали одной кнопкой. Дешёвая джоба `gate` перед сборкой пропускает уже опубликованный коммит (пишет ссылку на готовый релиз) и не даёт публиковать версию, которая в `RELEASES` уже лежит |
| Обновления | Проверка автоматическая, скачивание — только по кнопке «Скачать» в баннере. Windows отдаёт фид Squirrel (`getUpdatesURL()`, `script/dist-info.ts:167`), Linux — диалог выбора `.deb`/AppImage, macOS — неподписанный zip; официальный канал только оповещает ссылкой |
| Свежесть сборки | Отдельная проверка по хешу коммита: каждый релиз называет, из чего собран, приложение сравнивает хеш со своим `__SHA__` и показывает баннер со ссылкой на релиз |
| Отзыв о переводе | Номер сборки в диалоге «О программе» ведёт в заранее заполненную issue этого репозитория |

### Где взять

- **Windows x64:** тег
  [latest-win-x64](
  https://github.com/bahooo22/github_desktop/releases/tag/latest-win-x64) —
  ставить `GitHubDesktopL10nSetup-x64.exe`, а не `.msi`: второй лишь доставляет
  установщик на машину. Есть и portable-архив `…-portable.zip`.
- **Linux x64:** тег
  [latest-linux-x64](
  https://github.com/bahooo22/github_desktop/releases/tag/latest-linux-x64) —
  `github-desktop-l10n.deb` (`sudo dpkg -i`, ставит меню, иконку и команду
  `github-l10n`), `GitHubDesktopL10n-x86_64.AppImage` (`chmod +x` и запустить)
  или `desktop-linux-x64-portable.tar.gz` (распаковать и запустить `desktop`).
- **Windows arm64:** тег
  [latest-win-arm64](
  https://github.com/bahooo22/github_desktop/releases/tag/latest-win-arm64) —
  тот же набор ассетов, что у x64, но с суффиксом `arm64`.
- **macOS arm64:** тег
  [latest-macos-arm64](
  https://github.com/bahooo22/github_desktop/releases/tag/latest-macos-arm64) —
  `GitHub Desktop L10n-arm64.zip`; распаковать и перетащить `.app` в
  «Программы».
- **macOS x64:** тег
  [latest-macos-x64](
  https://github.com/bahooo22/github_desktop/releases/tag/latest-macos-x64) —
  `GitHub Desktop L10n-x64.zip`.

Сборка macOS не подписана и не нотаризована, поэтому Gatekeeper блокирует первый
запуск: откройте приложение через «Системные настройки» → «Конфиденциальность и
безопасность» → «Открыть всё равно» либо снимите карантин
`xattr -dr com.apple.quarantine "/Applications/GitHub Desktop L10n.app"`.
У форка свой bundle ID и имя (`com.github.GitHubClientL10n`), поэтому он
устанавливается рядом с официальным и не делит с ним настройки.

Обновления устроены одинаково: приложение само узнаёт о новой сборке и
показывает баннер, но ничего не скачивает до нажатия «Скачать». На Windows
дальше работает Squirrel, на Linux открывается выбор `.deb`/AppImage (файл
сохраняется в «Загрузки»), на macOS скачивается zip. AppImage можно обновлять и
внешним `appimageupdatetool -u` по `.zsync` из того же тега. Официальный канал
GitHub Desktop тоже только оповещает и даёт ссылку — официальная сборка ставится
отдельно и без локализации. На Ubuntu 24.04 с ограниченным user namespace
AppImage может потребовать `--no-sandbox`.

Панель «Примечания к выпуску» показывает и апстримные релизы, и изменения
форка: свои записи лежат в `changelog-fork.json` (апстримный `changelog.json`
не трогается), а их тексты — ключи каталога, которые переводятся вместе с
интерфейсом. Подробности — в [`docs/fork-releases.md`](docs/fork-releases.md).

### Как собрать

| Задача | Команда |
| --- | --- |
| Поднять контейнер стенда | `bash tools/i18n-lab/lab.sh up` |
| Dev-сборка | `bash tools/i18n-lab/lab.sh exec "yarn build:dev"` |
| Linux: portable, `.deb` и AppImage | `bash tools/i18n-lab/lab.sh exec "gdlab/release.sh"`; AppImage добавится, если в контейнере задан `APPIMAGETOOL=/путь/к/appimagetool` |
| Windows | `gh workflow run release-fork-windows.yml -f arch=x64` (или `arch=arm64`) — только на windows-раннере; `-f first_run=true` нужен ровно когда тег ещё пуст, иначе он выключит дельту |
| Windows, обе архитектуры | `gh workflow run release-fork-windows-all.yml` |
| Все три фида | `gh workflow run release-fork-all.yml` — win x64 + win arm64 + linux параллельно |
| Linux в тег фида | `gh workflow run release-fork-linux.yml` — публикация в `latest-linux-x64`: portable, `.deb`, AppImage, входов нет |
| Проверить раскатанные бандлы | `yarn l10n:bundles` |

Подробности — в [docs/fork-releases.md](docs/fork-releases.md): почему из Linux
не получается рабочая Windows-сборка, зачем один тег на архитектуру, что делает
каждый шаг релизного workflow, как приложение читает хеш сборки и чем
отличаются `.exe` от `.msi`. Про встроенные реквизиты тестового
OAuth-приложения —
[docs/fork-oauth-client.md](docs/fork-oauth-client.md). О том, как считается
готовность каждого каталога, в каком состоянии четыре учебных языка и по какой
таблице из их латиницы получается кириллическая транскрипция —
[docs/fork-localization-progress.md](docs/fork-localization-progress.md). Общая
настройка сборки для разработки — апстримная
[`setup.md`](./docs/contributing/setup.md).

### Чего в форке сознательно нет

- Подписи Windows-инсталлера: секреты Azure ACS не передаются, поэтому
  SmartScreen покажет предупреждение при первом запуске.
- `.rpm`, Flatpak и Snap: для RedHat-дистрибутивов и прочих Linux-систем
  предлагается AppImage, `.deb` — для Debian/Ubuntu.
- Подписи macOS-сборки: Apple Developer Program не оплачивается, поэтому zip
  не подписан и не нотаризован, а первый запуск требует обхода Gatekeeper.
- Автоматического скачивания обновлений: приложение только проверяет фиды и
  оповещает; любой пакет скачивается после нажатия «Скачать».

## Where can I get it?

Download the official installer for your operating system:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32)
 - [Windows machine-wide install](https://central.github.com/deployments/desktop/desktop/latest/win32?format=msi)

Linux is not officially supported; however, you can find installers created for Linux from a fork of GitHub Desktop in the [Community Releases](https://github.com/desktop/desktop#community-releases) section.

### Beta Channel

Want to test out new features and get fixes before everyone else? Install the
beta channel to get access to early builds of Desktop:

 - [macOS](https://central.github.com/deployments/desktop/desktop/latest/darwin?env=beta)
 - [macOS (Apple silicon)](https://central.github.com/deployments/desktop/desktop/latest/darwin-arm64?env=beta)
 - [Windows](https://central.github.com/deployments/desktop/desktop/latest/win32?env=beta)
 - [Windows (ARM64)](https://central.github.com/deployments/desktop/desktop/latest/win32-arm64?env=beta)

The release notes for the latest beta versions are at
[desktop.github.com/release-notes](https://desktop.github.com/release-notes/?env=beta).

### Past Releases
You can find past releases at https://desktop.githubusercontent.com. After installation of a past version, the auto update functionality will attempt to download the latest version. 

### Community Releases

There are several community-supported package managers that can be used to
install GitHub Desktop:
 - Windows users can install using [winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/) `c:\> winget install github-desktop` or [Chocolatey](https://chocolatey.org/) `c:\> choco install github-desktop`
 - macOS users can install using [Homebrew](https://brew.sh/) package manager:
      `$ brew install --cask github`

Installers for various Linux distributions can be found on the
[`shiftkey/desktop`](https://github.com/shiftkey/desktop) fork.

## Is GitHub Desktop right for me? What are the primary areas of focus?

[This document](https://github.com/desktop/desktop/blob/development/docs/process/what-is-desktop.md) describes the focus of GitHub Desktop and who the product is most useful for.

## I have a problem with GitHub Desktop

Note: The [GitHub Desktop Code of Conduct](https://github.com/desktop/desktop/blob/development/CODE_OF_CONDUCT.md) applies in all interactions relating to the GitHub Desktop project.

First, please search the [open issues](https://github.com/desktop/desktop/issues?q=is%3Aopen)
and [closed issues](https://github.com/desktop/desktop/issues?q=is%3Aclosed)
to see if your issue hasn't already been reported (it may also be fixed).

There is also a list of [known issues](https://github.com/desktop/desktop/blob/development/docs/known-issues.md)
that are being tracked against Desktop, and some of these issues have workarounds.

If you can't find an issue that matches what you're seeing, open a [new issue](https://github.com/desktop/desktop/issues/new/choose),
choose the right template and provide us with enough information to investigate
further.

## The issue I reported isn't fixed yet. What can I do?

If nobody has responded to your issue in a few days, you're welcome to respond to it with a friendly ping in the issue. Please do not respond more than a second time if nobody has responded. The GitHub Desktop maintainers are constrained in time and resources, and diagnosing individual configurations can be difficult and time consuming. While we'll try to at least get you pointed in the right direction, we can't guarantee we'll be able to dig too deeply into any one person's issue.

## How can I contribute to GitHub Desktop?

The [CONTRIBUTING.md](./.github/CONTRIBUTING.md) document will help you get setup and
familiar with the source. The [documentation](docs/) folder also contains more
resources relevant to the project.

If you're looking for something to work on, check out the [help wanted](https://github.com/desktop/desktop/issues?q=is%3Aissue+is%3Aopen+label%3A%22help%20wanted%22) label.

## Building Desktop

To setup your development environment for building Desktop, check out: [`setup.md`](./docs/contributing/setup.md).

## More Resources

See [desktop.github.com](https://desktop.github.com) for more product-oriented
information about GitHub Desktop.

See our [getting started documentation](https://docs.github.com/en/desktop/overview/getting-started-with-github-desktop) for more information on how to set up, authenticate, and configure GitHub Desktop.

## License

**[MIT](LICENSE)**

The MIT license grant is not for GitHub's trademarks, which include the logo
designs. GitHub reserves all trademark and copyright rights in and to all
GitHub trademarks. GitHub's logos include, for instance, the stylized
Invertocat designs that include "logo" in the file title in the following
folder: [logos](app/static/logos).

GitHub® and its stylized versions and the Invertocat mark are GitHub's
Trademarks or registered Trademarks. When using GitHub's logos, be sure to
follow the GitHub [logo guidelines](https://github.com/logos).
