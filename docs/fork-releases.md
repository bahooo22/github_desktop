# Релизы этого форка

Форк добавляет в GitHub Desktop полную локализацию интерфейса (русский и
украинский) и распространяет свои сборки отдельно от апстрима. Документ
объясняет, где брать готовые пакеты, как собрать их самому и за что отвечает
свой Squirrel-идентификатор.

## Идентификатор и фид обновлений

Все имена выводятся из одного значения — `getWindowsIdentifierName()`
(`script/dist-info.ts:106`), сейчас это `GitHubDesktopL10n`. От него зависят
имя исполняемого файла, `GitHubDesktopL10nSetup-<arch>.exe`/`.msi`,
`nugetPackageId` и имена `*-full.nupkg`/`*-delta.nupkg`, а также
`AppUserModelId` (`app/src/main-process/main.ts:136` собирает
`com.squirrel.<identifier>.<identifier>`).

Фид обновлений — ассеты обычного GitHub Release, по одному тегу на
архитектуру (`getUpdatesURL()`, `script/dist-info.ts:167`):

- `latest-win-x64` и `latest-win-arm64` — Windows,
- `latest-linux-x64` — Linux (portable-архив, обновлений Squirrel на Linux нет).

Один тег на архитектуру нужен потому, что в релизе не может лежать два разных
`RELEASES`: Squirrel.Windows дописывает это имя к адресу фида и читает оттуда
список пакетов. Переопределить адрес можно сборочной переменной
`DESKTOP_UPDATES_URL`. Тег всегда выбирается win-ный: `getUpdatesURL()` различает
только x64 и arm64, поэтому для сборки под macOS адрес надо переопределять явно
(сделанных macOS-релизов у форка нет).

Поведение, специфичное для апстримного `central.github.com` (query
`?version=&env=`, перезапись пути под arm64), отключено для форк-фида гейтом
`isCentralFeed()` в рантайме (`app/src/ui/lib/update-store.ts:37`) и
`isCentralUpdatesFeed()` при упаковке (`script/dist-info.ts:185`, вызывается из
`script/package.ts:113` и `:162` для `remoteReleases` и имён пакетов) — для
статики GitHub-ассетов оно ломало бы загрузку.

**Следствие смены идентификатора:** Windows-установка живёт в
`%LOCALAPPDATA%\GitHubDesktopL10n`, отдельно от апстримного
`%LOCALAPPDATA%\GitHubDesktop`. Ранее поставленная апстримная версия этим форком
не обновляется и не перезаписывается — раздельность и является целью, но
обновляться придётся дважды, если установлены обе редакции.

## Где взять собранное

Теги создаёт первый прогон workflow (см. ниже), до него этих тегов в репозитории
нет:

- Windows: `.../releases/tag/latest-win-x64` — `…Setup-x64.exe`, `.msi`,
  portable-`GitHubDesktopL10n-win32-x64-portable.zip`, `RELEASES` и пакеты фида.
- Linux: `.../releases/tag/latest-linux-x64` — `desktop-linux-x64-portable.tar.gz`
  (распаковать и запустить `desktop`). Обновлений Squirrel на Linux нет.

## Сборка одной командой в контейнере (Linux)

Сборка живёт в контейнере стенда: `tools/i18n-lab/lab.sh` идемпотентно собирает
образ `gdlab-i18n:1`, поднимает контейнер `gdlab` и монтирует рабочее дерево в
`/work` (тома для `node_modules`, `app/node_modules`, `out/` и каталога сборки
docker не пересобираются каждый раз).

```bash
bash tools/i18n-lab/lab.sh up                       # образ + контейнер
bash tools/i18n-lab/lab.sh exec "gdlab/release.sh"  # сама сборка
```

Получится `Release/desktop-linux-x64-portable.tar.gz`. Каталог `Release/`
исключён из git: в него складываются бинарные артефакты на гигабайты.

## Сборка Windows: только на windows-раннере

Цель `gdlab/release.sh win-portable` намеренно запрещена (скрипт печатает
подсказку и выходит с кодом 2). Причина: `yarn build:prod` внутри Linux-контейнера
кладёт в `out/` нативные компоненты, собранные под Linux, а `@electron/packager`
берёт то, что уже лежит в `node_modules` целевой платформы, и не подменяет их.
Замер `out/` после production-сборки: четыре `.node` — `keytar.node`,
`fs_admin.node`, `desktop-notifications.node`,
`copilot/prebuilds/linux-x64/runtime.node` — все `ELF 64-bit LSB shared object`;
`desktop-trampoline/desktop-askpass-trampoline` и `git/bin/git` — тоже ELF.
На Windows `require()` таких модулей падает, и приложение показывает пустое белое
окно при живом меню — этот дефект и был причиной запрета.

Windows-сборка идёт workflow-файлом `.github/workflows/release-fork.yml`:

```bash
gh workflow run release-fork.yml -f arch=x64
# первый релиз в пустой тег — добавить:
gh workflow run release-fork.yml -f arch=x64 -f first_run=true
```

Прогон делает две джобы: Windows выбранной архитектуры и Linux x64 portable
(джоба `linux` не гейтится входом, поэтому артефакты обоих тегов обновляются
сразу).

Что делает прогон:

1. `yarn build:prod` с `npm_config_arch` и `TARGET_ARCH` равными выбранной
   архитектуре (без `TARGET_ARCH` arm64-прогон собрал бы x64-нативы — см.
   `script/build.ts:203`).
2. Шаг `Guard the feed before packaging` (пропускается при `first_run=true`)
   скачивает `RELEASES` из тега и падает, если версия в `app/package.json` там
   уже есть: Squirrel определяет обновление по версии, поэтому прогон с той же
   версией физически перезаписал бы пакеты, которые никто не увидит. Проверка
   дешёвая, а обнаруживать бесполезный релиз после девяти минут сборки — дорого.
3. `yarn package` со `DESKTOP_UPDATES_URL`, указывающим на ассеты этого же тега, и
   `DESKTOP_SKIP_DELTA=1` при `first_run=true`. Флаг нужен для самого первого
   релиза: удалённого `RELEASES` ещё нет, а `electron-winstaller` при заданном
   `remoteReleases` вызывает `SyncReleases.exe` (`lib/index.js:272-274`) и падает
   на его ненулевом коде выхода (`lib/spawn-promise.js`) — гибла вся сборка.
   Дельта выключается вместе с этим вызовом, канал сборки остаётся `production`.
4. Portable-архив пакует `C:\Windows\System32\tar.exe` (bsdtar 3.7.7) — по
   полному пути, а не `tar` из PATH. Под `shell: bash` bare `tar` — это GNU tar
   1.35 из Git for Windows, а `-a` умеет только gzip/bzip2/xz/zstd: `.zip` для
   него не фильтр, и GNU tar с кодом выхода 0 писал **несжатый tar** под именем
   `*.zip` (должно было выйти 650 178 560 байт — кратно 512, `ustar` в смещении
   257, а не `PK\3\4` в нулевом). `Compress-Archive` сам по себе тоже не годится:
   спотыкается о длинные пути внутри `resources/app`. Теперь шаг после упаковки
   читает сигнатуры контейнера — `PK\3\4` в начале и `PK\5\6` за 22 байта до
   конца — и роняет джобу, если их нет: код выхода архиватора о формате не
   говорит ничего, и именно поэтому битый артефакт доехал до релиза.
5. Ассеты публикуются в тот же тег два раза: сначала установщики, portable-архив
   и пакеты, и только затем `RELEASES` — чтобы окно «клиент видит новую
   `RELEASES`, а пакет по ссылке ещё не долит» совпадало с самим фактом докачки.
   Пакеты прежних версий не удаляются, поэтому ссылка из старого `RELEASES`
   остаётся живой.

**Подписи нет.** `script/package.ts` включает подпись только при
`isGitHubActions() && isPublishable() && isCodeSigningConfigured()`, а секреты
Azure ACS намеренно не передаются, поэтому `Setup-*.exe`/`.msi` выпускаются
без подписи. Windows SmartScreen покажет предупреждение при первом запуске, а
Defender строже относится к неподписанным `.nupkg`. Для личного форка это
приемлемо; когда появится свой сертификат, подпись включается добавлением шага
`setup-windows-signing` по образцу апстримного `.github/workflows/ci.yml`.

## Какой артефакт устанавливать: `Setup-*.exe`, а не `*.msi`

- `GitHubDesktopL10nSetup-x64.exe` — обычный Squirrel-установщик на одного
  пользователя: раскладывает приложение в `%LOCALAPPDATA%\GitHubDesktopL10n`,
  создаёт ярлык и с этого момента сам смотрит фид. Ставить надо именно его.
- `GitHubDesktopL10nSetup-x64.msi` — машинный «Deployment Tool» для корпоративной
  раздачи (GPO/SCCM). Замер на win11 x64 24H2: Windows Installer отчитался
  «Product: GitHub Desktop Deployment Tool -- Installation completed
  successfully» (состояние 0, версия 3.6.7.0), и на этом всё. Из изменений —
  ровно один файл `C:\Program Files (x86)\GitHub Desktop Deployment\`
  `GitHubDesktopL10nDeploymentTool.exe` с sha256 `e716c846ba5186611d083585c3e8dd2bbbf7b706e82052c0f8e634cba3351f81`,
  то есть байт-в-байт тот же `Setup-x64.exe` из релиза. Каталога
  `%LOCALAPPDATA%\GitHubDesktopL10n`, ярлыка, записи в `CurrentVersion\Run` и
  задачи в планировщике MSI не создаёт, `SquirrelSetup.log` не появляется —
  приложение после MSI не установлено и само не доустановится.
- Отсюда практический смысл пары: MSI лишь доставляет установщик на машину, а
  ставят приложение запуском `Setup-x64.exe` (или уже положенного
  `GitHubDesktopL10nDeploymentTool.exe`) под профилем пользователя. Если MSI
  уже на машине и приложение им ставить не планируется — удаление через
  `MsiExec.exe /X{C43DDCCA-ABCF-454E-AF36-FBDB6673A388}` или список «Приложения и
  возможности».
- Portable-архив установки не требует вообще: распаковать и запускать
  `GitHubDesktopL10n.exe`.

## Сборка Windows локально на своей машине

Пререквизиты — как у апстрима для разработки (Node 24, `.node-version` фиксирует
24.19.0; Yarn 1.x; Visual C++ Build Tools; Python 3 — см.
`docs/contributing/setup-windows.md`), затем:

```powershell
yarn install --frozen-lockfile
$env:RELEASE_CHANNEL = 'production'
$env:npm_config_arch = 'x64'
$env:TARGET_ARCH = 'x64'
yarn build:prod
yarn package
```

Артефакты появятся в `dist\`: `GitHubDesktopL10n-win32-x64\` (portable),
`GitHubDesktopL10nSetup-x64.exe`, `.msi`, `*-full.nupkg`, `RELEASES`.

## Как проверить собранное перед раздачей

```bash
yarn l10n:bundles   # node script/i18n-freshness.mjs --bundles
```

Режим сравнивает `out/` со всеми раскатанными копиями бандла (`bin/resources/app`,
`dist/desktop-linux-x64/resources/app`, `dist/GitHubDesktopL10n-win32-x64/resources/app`)
по sha256 каждого `.js`/`.css`/`.html` и ищет `meta.nativeName` каждого каталога
внутри `main.js`/`renderer.js`/`crash.js`. Отсутствие копии — не ошибка,
отстающая копия — код выхода 1. Именно этот чекер поймал случай, когда в релизный
артефакт был раскатан dev-бандл: проверять надо сравнение содержимого, а не
время модификации.

Дополнительно для win-бандла: исполняемый файл называется `GitHubDesktopL10n.exe`
(не `electron.exe`), `resources/app` непустой, в `index.html` нет `localhost:3000`,
в `renderer.js` нет `central.github.com`, а `diff -rq out/resources/app` по
`.js`/`.css`/`.html` пуст.

## Выбор строки кликом

Кнопка «Выбрать строку» в футере редактора языкового пакета вооружает режим
`point-and-translate` (`app/src/ui/localization/pick-mode.ts`): по всему окну
курсор-прицел, подсветка наведения, Escape — отмена. Клик перехватывается на
`document` в capture-фазе с `preventDefault`/`stopPropagation`, поэтому
приложение его не видит и ничего под курсором не открывает и не переключает.

Что уходит обратно в редактор:

1. `data-l10n-key` ближайшего узла, отрисованного через `Trans`
   (`app/src/lib/l10n/react.tsx:130`): редактор открывает эту строку, скроллит к
   ней и ставит фокус в первое пустое плюральное поле.
2. Иначе — видимый текст под курсором. Он попадает в поле поиска, а
   `visibleKeys()` сопоставляет и оригинал, и перевод, так что строка
   находится и без атрибута. Длиной больше 80 символов считается абзац, а не
   надпись: такой клик не репортится, и режим остаётся вооружённым.

Атрибутом покрыто 11 узлов интерфейса: `Trans` стоит там, где в тексте есть
разметка или подстановка. Остальные надписи доступны только через текст, а
пункты нативного меню Windows недоступны вовсе — их нет в DOM.

Режим закрывает попап, а не прячет его: `Dialog` — нативный `<dialog>` с
`showModal()`, и пока он открыт, всё остальное окно инертно. Из-за этого учёт
языков с правками, которых ещё нет на диске, живёт в `LocalizationManager`
(`getUnsavedTags`/`hasUnsavedMessages`), а не в состоянии диалога: повторно
открытый редактор по-прежнему знает, что Save нажимать нужно.

## Проверка свежести сборки по хешу коммита

Squirrel сравнивает только номера версий, а форк пересобирается чаще, чем
бампит версию: один и тот же `3.6.7-beta2` может означать и сборку недельной
давности, и сегодняшнюю. Чтобы установленное приложение всё равно узнавало о
новой сборке, каждый релиз публикует ассет `build-info.json` с хешем коммита,
из которого он собран, а приложение сравнивает этот хеш со своим собственным
(`__SHA__` из `app/app-info.ts`) через GitHub Compare API.

### Схема `build-info.json`

Ассет генерирует `script/build-info.ts` и загружает workflow
`.github/workflows/release-fork.yml` в каждый тег фида (`latest-win-x64`,
`latest-win-arm64`, `latest-linux-x64`; mac-тега у форка нет). Файл содержит:

| поле | тип | смысл |
| --- | --- | --- |
| `schema` | `1` | версия формата; парсер (`parseBuildInfo` в `app/src/lib/fork-release.ts`) отвергает любое другое значение, чтобы не гадать по чужому формату |
| `platform` | строка | платформа сборки (`win32`, `linux`, …); для сравнения не используется, тег фида уже платформенный |
| `arch` | строка | архитектура (`x64`, `arm64`); аналогично, информация справочная |
| `sha` | 40 hex-символов | полный коммит-хеш, из которого собрана сборка; нормализуется к нижнему регистру |
| `version` | непустая строка | номер версии из `app/package.json` на момент сборки |
| `builtAt` | непустая строка | ISO-8601 время окончания сборки |

Любое нарушение схемы (неизвестный `schema`, усечённый или не-hex `sha`, пустые
`version`/`builtAt`) приводит к `null`: лучше ничего не сказать, чем показать
обновление по недоверенному ассету.

### Как приложение читает релиз

Транспорт — только `https://api.github.com/repos/bahooo22/github_desktop/releases/tags/<tag>`
(`getForkFeedURL()` в `script/dist-info.ts`). Download-URL ассета
(`github.com/.../download/...`) не годится: сервер отвечает 302 без заголовка
`Access-Control-Allow-Origin`, и браузерный `fetch` из renderer-процесса
блокируется CORS. API возвращает JSON с заголовком CORS, поэтому запрос
проходит.

Последовательность (`checkForkRelease` в `app/src/lib/fork-release.ts`):

1. GET релиза по тегу фида → `selectBuildInfoAsset()` находит URL ассета
   `build-info.json` в списке `assets[]`.
2. GET ассета с `Accept: application/vnd.github.raw+json` → `parseBuildInfo()`
   валидирует схему.
3. Если `sha` ассета совпадает с `__SHA__` текущего билда — возврат `null`
   (ничего нового).
4. Иначе GET `/repos/<owner>/<repo>/compare/<currentSha>...<releaseSha>` →
   поле `ahead_by`. Только положительное значение означает «релиз новее»;
   ноль или отрицательное (пользователь на своей ветке) — тоже `null`.
5. Результат кэшируется в `localStorage` на 24 часа (`getObject`/`setObject`),
   чтобы офлайн-приложение не спамило API при каждом открытии диалога.

При недоступности сети, rate-limit, отсутствии ассета или любой другой ошибке
функция возвращает `null` и пишет debug-лог `[fork-release] release check failed`.
UI в этом случае молчит: отсутствие информации неотличимо от «обновлений нет»,
и показывать ошибку пользователю не за что.

### Показ в интерфейсе

Результат отображается в двух местах:

- Диалог «О программе» (`app/src/ui/about/about.tsx`, `renderForkRelease()`):
  строка `about.forkRelease` с параметрами `{sha, date, count}` и ссылкой на
  страницу релиза.
- Баннер над списком изменений
  (`app/src/ui/banners/fork-release-available.tsx`): `banners.forkReleaseAvailable`
  с параметром `{count}`; текст ссылки живёт внутри `<link>` в самом каталоге,
  отдельный ключ под неё не нужен. Баннер уступает слот Squirrel-обновлению
  (когда установка уже готова, ссылка на страницу релиза менее полезна) и
  запоминается по SHA релиза (`dismissForkRelease`), а не по времени: следующая
  пересборка форка напомнит снова.

Существующая строка `about.upstream-behind` (сравнение с апстримом по версии)
остаётся как есть и работает независимо.

## Чего в форке сознательно нет

- Настоящих пакетов для Linux (`.deb`/`.rpm`/`.AppImage`): есть только
  portable-архив. `script/package.ts` умеет собирать только `.app` (darwin) и
  Squirrel-инсталлер (win32), а на любой другой платформе завершает процесс; для
  Linux-пакетов нужны `electron-builder` или `rpmbuild` плюс `.desktop`-файл и
  иконки, а образ контейнера (`tools/i18n-lab/Dockerfile`) этих инструментов не
  содержит.
- Обновлений на Linux: `autoUpdater` (электронный, `app/src/main-process/app-window.ts:6`)
  на Linux не поддерживается, а фид написан под Squirrel.Windows.
- macOS-релизов: механизм обновлений для macOS в коде есть (тот же
  `autoUpdater`), но форк не собирает `.app` и не публикует mac-тег, а
  `getUpdatesURL()` по умолчанию возвращает всегда win-ный тег. На macOS
  обновления заработают только при явном `DESKTOP_UPDATES_URL`.
