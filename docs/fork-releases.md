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
кладёт в `out/` нативные модули, собранные под Linux (`keytar.node`,
`fs_admin.node`, `desktop-notifications.node`, `desktop-trampoline/*`, `git/`), а
`@electron/packager` берёт то, что уже лежит в `node_modules` целевой платформы, и
не подменяет их. На Windows `require()` этих файлов падает, и приложение
показывает пустое белое окно при живом меню — этот дефект и был причиной
запрета.

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
4. Portable-архив собирается `tar -a` (bsdtar), а не `Compress-Archive`: последний
   спотыкается о длинные пути внутри `resources/app`.
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
- Режима «клик по строке интерфейса → правка в редакторе языкового пакета»:
  атрибут `data-l10n-key` проставляется (`app/src/lib/l10n/react.tsx:130`), но
  пока нигде не читается.
