# Готовность каталогов перевода

Документ нужен для одного: чтобы по числам было видно, сколько осталось переводить,
и каким правилом это число считается. Код каталогов — `app/locales/<tag>.json`,
движок — `app/src/lib/l10n`, гейты — `script/i18n-freshness.mjs`.

## Как меряется готовность

```bash
yarn l10n:untranslated <tag>
```

Счётчик проходит по строкам целевого каталога и сравнивает каждую с английским
текстом того же места. Печатается три числа:

- `untranslated` — строк, побайтово равных английскому. Это и есть объём работы.
- `compared` — строк, для которых в `en.json` нашёлся оригинал.
- `without an English original` — строк, которых в английском нет: формы
  (`_few`, `_many`), добавленные грамматикой языка, а не каталогом. Их сравнить
  не с чем, поэтому они в работу не входят.

Сравниваются формы, а не запись целиком: `plural:_one` и `plural:_other` — две
разные строки текста. Прежняя мера сверяла записи через `===`, из-за чего
плюральные и платформенные строки (258 из 1 743 ключей) не попадали в счёт вообще,
и каталог, состоящий из английских копий, выглядел переведённым.

Ноль — правильный ориентир, но недостижимый: часть строк остаётся английской и в
русском каталоге, потому что это имена продуктов, технологии и чистые
плейсхолдеры. Ориентир — столько, сколько у русского:

| тег | untranslated | compared | без оригинала | состояние |
| --- | --- | --- | --- | --- |
| `ru` | 25 | 1 905 | 114 | переведён |
| `uk` | 25 | 1 905 | 114 | переведён |
| `la` | 28 | 2 011 | 1 718 | переведён, остаток — бренды и подстановки |
| `eo` | 20 | 2 011 | 1 791 | переведён, остаток — бренды и подстановки |
| `tlh` | 1 362 | 2 011 | 423 | группы `about`/`common`/`welcome`/`menu`/`settings` и частичный батч |
| `qya` | 1 364 | 2 011 | 422 | группы `about`/`common`/`welcome`/`menu`/`settings`, `about`/`welcome` — 36 ключей из 59 |

Числа сняты 18.10.2026 тем же `--untranslated`, после аудита латыни и эсперанто
(69 и 6 исправленных форм), после закрытия verbatim-дыр (41 и 8) и после
терминоправок там, где каталог молча оставлял английское содержательное слово:
`settings.integrations.shell` → `Interpres`, `multiCommit.operation.rebase` →
`Translatio`, `multiCommit.operation.squash` → `Contractio`, `repositoryAlias.alias`
→ `Aliud nomen` в латыни; в эсперанто — `terms.miscellanea` → `Diversaĵoj`,
`commitMessage.error-word` и `appError.generic` → `Eraro`,
`multiCommit.operation.cherryPick` → `Ĉerelpikado`, `multiCommit.operation.rebase` →
`Rebaziĝo`, `repositoryAlias.alias` → `Alinomo`. Тем же вечером закрыта группа
`menu` в двух конланговых каталогах: 144 формы в `tlh` (`E:/tmp/tlh_menu_fill.py`)
и 144 в `qya` (`E:/tmp/qya_menu_fill.py`) — у квенья осталось 1589 только потому,
что `menu.open-in-shell-default` = `Shell` совпадает с оригиналом по сути. Следом
закрыта группа `settings`: у `tlh` 1 362 (`E:/tmp/tlh_settings_fill.py`), у `qya`
1 364 (`E:/tmp/qya_settings_fill.py`) — счётчики двух конлангов сошлись с
разницей в два ключа. Остаток
`la`/`eo` — то же, что и у
русского: `Copilot`, `Git`, `Azure`, `Anthropic`, `GitHub.com`, `GitHub Enterprise`,
`URL`, `Apple silicon`, `Arm64`, `{example} ({pattern})`, `{speed}/s` и подобные
строки, где перевод совпадает с оригиналом по сути. Отдельно оговоримое: в латыни
`Error` остаётся `Error` (это и есть латинское *error, errōris*), а `Miscellanea` —
уже латинская форма.

### Почему у квенья 36 ключей, а не 59

Из первого квенья-черновика (59 ключей) 23 сняты с готовности, и их значения
возвращены английскими копиями — счётчик и `meta.ready` сходятся ровно на этом
числе. Снятие — не косметика: гейт подтверждает слово, а черновик для этих строк
брал слова, которых в Eldamo нет в нужном смысле либо которые дают ровно одну
омографную запись. Сняты 15 ключей `about` (`title`, `check-time-error`,
`dev-no-updates`, `downloadSpeed`, `downloadingSize`, `firstRunOfBuild`,
`firstRunOfBuild-rich`, `forkRelease`, `l10nCredit`, `license-notices`,
`os-unsupported`, `quit-and-install-update`, `responsible-use-copilot`,
`terms-and-conditions`, `upstream-behind`), 3 ключа `common`
(`do-not-show-again`, `learnMore`, `ok`) и 5 ключей `welcome`
(`configure-git-description`, `create-account`, `legal-footer`,
`start-description`, `user-metrics`). Английский остаток в них — осознанное
состояние «подтверждения нет», а не пропуск: следующий батч закрывает строку,
только когда найдёт запись в дампе, а не когда придумает правдоподобное слово.

## Готовность строки и `meta.ready`

Счётчик выше меряет перевод, а редактор показывает готовность — это разные вещи, и
путаница стоила того, чтобы её разделить. Каталог без секции `ready` редактор
читает как «каждая заполненная строка готова» (`localization-editor.tsx:1066`),
и маска из en-копий выглядела бы переведённой полностью. Поэтому каждый батч
дописывает свои ключи в `meta.ready` — 1 746 у `la` и `eo` (каталог закрыт весь:
остались только бренды и чистые подстановки), 541 у `tlh` (257 прежних +
76 строк `menu` + 208 строк `settings`) и 541 у `qya` (257 прежних +
76 строк `menu` + 208 строк `settings`; см. «Почему у
квенья 36 ключей, а не 59» выше). Строки,
совпадающие с английским по сути (`about.downloadingLine`), в этот список входят:
готовая — не значит отличная от оригинала, значит «переводчик её закрыл».

Единица списка — строка, а не форма: `menu.copy`, а не `menu.copy.@other`. Первый
меню-батч дописал пути форм и получил 204 записи там, где строк 76; список
пересобран из HEAD плюс имена строк группы, и ни одна запись не ведёт в
несуществующий ключ.

## Реестр батчей

| коммит | теги | группы | ключей | строк | гейт словаря |
| --- | --- | --- | --- | --- | --- |
| `df3c6459b7` | `la`, `eo` | `about`, `common`, `welcome` | 59 | 62 | сверка не нужна |
| этот | `tlh` | те же три группы | 59 | 62 | 218 слов, 0 неподтверждённых |
| этот | `qya` | те же три группы | 36 | 37 | 52 вхождения, 0 неподтверждённых |
| этот | `eo` | `menu` | 76 | 145 | Glosbe + eo.wikipedia: `deponejo`, `kunfandi` |
| `e463ff01f3` | `tlh` | `menu` | 76 | 145 | boQwI' + Eldamo/Klingon AI: `bartIq`, `De' ngaSwI'` |
| этот | `qya` | `menu` | 76 | 145 | Eldamo (`qya_attest.py --gloss/--show`): `olba`, `haura`, `quettasta`, `remparma` |
| этот | `tlh` | `settings` | 208 | 233 | boQwI' (`tlh_gloss_search.py`) + Computer Terms: `vep`, `DeQ`, `vuS`, `taw Dor` |
| этот | `qya` | `settings` | 208 | 233 | Eldamo (`qya_attest.py --gloss/--show`): `sinwata-`, `nemesta`, `cantemma`, `hríma`, `pella` |

## Методика батчей

Шаг 7 плана: перевод идёт батчами по группам верхнего уровня `en.json`, каждый
батч — отдельный коммит после зелёных `yarn l10n:parity` и `yarn l10n:audit`.
Групп 151, всего 2 008 строк. Крупнейшие:

| группа | строк | группа | строк |
| --- | --- | --- | --- |
| `settings` | 230 | `commitMessage` | 50 |
| `menu` | 145 | `copilotByokProvider` | 46 |
| `changes` | 128 | `commitList` | 42 |
| `multiCommit` | 125 | `about` | 31 |
| `localizationEditor` | 70 | остальные 141 группа | 1 073 |
| `diff` | 68 | | |

Первый батч — 40 литералов из `yarn l10n:audit` (то, что видно в интерфейсе и ещё
не покрыто ключами).

Что проверяется вместе с каждым батчем:

- плейсхолдеры совпадают с английскими, `&`-мнемоники на месте — это делает
  `yarn l10n:audit`;
- для `tlh` и `qya` значение пишется оригинальной записью языка, то есть
  латиницей; кириллица в каталог не идёт — она выходит из значения
  транслитератором (таблицы ниже). Признаком незакрытого перевода остаётся
  побайтовое совпадение с `en`, его и меряет счётчик;
- после батча — `node script/i18n-freshness.mjs --untranslated <tag>`, число
  пишется в таблицу состояния выше.

### Меню-батч: мнемоники и терминах (`eo`)

Группа `menu` — первая, где перевод упирается не только в слова. Три вещи, которые
пришлось сделать вместе со строками:

- Мнемоника обязана остаться в переводимом слове. Автоматическая расстановка
  (`E:/tmp/auto_mnemonic.py`) снимает все `&` с английской позиции, затем на каждое
  подменю подбирает первую латинскую букву, которая в нём ещё не занята; позиции
  внутри `{...}`-плейсхолдеров не предлагаются. Ручная расстановка
  дала 14 коллизий, поэтому она и автоматизирована.
- Проверка коллизий раньше перебирала `en`, `ru`, `uk` списком в тексте теста, и
  четыре новых каталога не проверялись вовсе — они молча несли дубли. Теперь тест
  идёт по `builtInLocaleTags` (тот же объект, что регистрирует каталоги), а дефект
  доказан мутацией: `&Paste` → `&Copy` даёт `win32/eo|root > &Edit|c|&Copy|&Copy`.
- Терминах: `deponejo` (репозиторий) и `kunfandi` (слиять) — Glosbe, у `deponejo`
  та же статья в эсперанто-Википедии в контексте Git; `komito`, `suprenflua`,
  `eldono`, `forĵeti` взяты из уже переведённых групп этого же каталога, чтобы
  один термин не получил два перевода в соседних меню. Аттестованного термина для
  «pull request» нет ни в Glosbe, ни в `PIV`; `peto pri kunigo` — словообразование
  по правилам языка, и это осознанный остаток, а не цитата из словаря.

Скорость `la` и `eo` ожидаемо близка к мерке русского (1 500–2 000 строк за день),
`tlh` и `qya` — теперь фактом: столбец `tlh` первого батча (62 листа) написан этим
окном за 9 минут 40 секунд непрерывной работы (16.10.2026, 03:16:36 → 03:26:16 UTC
по часам сеанса), то есть ≈ 300 листов за восьмичасовой день. Квенья в том же
батче достались от черновика и в мерку не входит. Догадка плана «500–800 полей за
день» для клингонского не подтвердилась: она завышена примерно вдвое, потому что
считала подбор по-русски, а тут каждый корень ещё надо построить по
словообразованию языка.

### Меню-батч квенья: падежи вместо порядка слов (`qya`)

`E:/tmp/qya_menu_fill.py` повторяет клингонский скрипт, но опоры другие: лексика
снимается не словарной статьёй, а дампом Eldamo
(<https://eldamo.org>, `glm/scripts/data/eldamo-data.xml`) прогоном
`E:/tmp/qya_attest.py --gloss/--show`. Отсюда три правила стиля, которые держат
весь батч:

- повелительное = голая основа глагола, как в уже переведённых строках каталога
  (`common.cancel` = `apta`, `app.select-repository` = `cilë i haura`);
- связи несут падежи, а не порядок слов: локатив `-ssë/-issë` («i GitHubissë»,
  `{editor}issë`), аблатив `-llo` («{branch}ullo»), датив `-nna`
  («i quettastanna»), родственный `-o/-mo` («ahyaniëo silta», «hauramo partië»);
- термина, которого в Eldamo нет, в каталог не идёт. Вместо него — описание из
  аттестованных основ: pull request = `luc-` «тянуть» + `iquist-` «запрос» =
  `luciquista`, worktree = `haura` + `már` «жилище» = `hauramar`, developer =
  `car-` «делать» + `-indo` «тот, кто» = `carindo`. Такие сборки помечены в
  глоссарии `source: not` и не выдают себя за словарные цитаты.

Отсеянное на этом батче: `apuco` и `túlelma` («прежде», «прошлое») — лемм в дампе
нет, поэтому `menu.preview-pull-request` строится на future-форме `ertava`
(«запрос, который будет слит»); `to widen`, `to expand`, `to paste`, `to exit`
в Eldamo не аттестованы — взяты `meletya-` «увеличить», `net-` «получить»,
`lóya-` «уйти (откуда)». `mnemonic_dedupe` развёл 27 коллизий мнемоник,
`mnemonic_fix` не нашёл ни одной недостающей (`&` уже стоял в 1 805 формах).

### Настройки клингонского: описания разбиты на короткие предложения (`tlh`)

Группа `settings` — первая, где клингонский упирается не в термины, а в синтаксис:
68 из 233 форм — полные предложения по 15–40 английских слов (`hooks-load-env-description`,
`repository-indicators-off-description`, `underline-description`). Клингонский не
соединяет такие придаточными цепочками, поэтому батч (`E:/tmp/tlh_settings_fill.py`)
держит три правила:

- английское сложное предложение распадается на 2–3 коротких, каждое — объект с
  топиком `'e'` и глагол в конце; связь — `'ach` «но/однако», `'ej` «и», `-chugh`
  «если», `-DI'`/`-bogh` «когда», `-meH` «для/чтобы». Ни одного союза, которого нет
  в дампе.
- корень берётся только из дампа boQwI' или со страницы «Computer Terms»; где статьи
  нет, собирается по словообразованию из подтверждённых основ и помечается в
  глоссарии `source: not`: «провайдер модели» = `peS-` «provide» (дамп 1979) +
  `-wI'` = `peSwI'`, «иконка статуса» = `patlh vo'nIng` (`vo'nIng` — image, дамп 3518),
  «квота» и «лимит» — `vuS` «limit» (дамп 4118), «токен» — `QujwI' lIw` «play token»
  (дамп 2844), «кредит» — `DeQ` «credit (monetary unit)» (дамп 1657).
- термины не получают второй перевод: `ngeq` «cache, store» остаётся и для stash
  (`ngeqlu' choH` — как в `menu.hide-stashed-changes`), `vum` — для worktree,
  `choH vem` — для commit, `motlh` — для default; `Shell`, `Git`, `Copilot`, `Azure`,
  `Anthropic`, `URL`, `OpenSSH`, `Git Credential Manager` и `{example} ({pattern})`
  совпадают с оригиналом как бренды и подстановки — 7 таких ключей скрипт печатает
  отдельной строкой, чтобы совпадение не выглядело пропуском.

Числительные с существительным не требуют плюрального суффикса, поэтому
`copilot.provider-model-count` в обеих формах (`_one`/`_other`) получает одно и то же
`{count:number} ghantoH` — это не недосмотр, а следствие декларации `meta.pluralCategories`
этого каталога. Формы времени «обновится через N минут/часов/дней» собраны на
аттестованных `tup` (дамп 4523), `rep` (3342), `jaj` и локативе `-Daq`
(`{count:number} tupDaH motlh 'oH choHlu'`), «еженедельно» — `Hogh` «week» (7909),
«ежемесячно» — `jar` «month» (4578).

Отсеянное на этом батче: «accessible», «prompt», «stash», «worktree», «dialog», «permission», «license», «premium», «endpoint», «overage», «remaining», «executable»,
«argument» (в значении аргумента команды), «weekly», «usage», «reload», «reset»,
«default», «warning», «credential», «high-signal» — статьёй в дампе не лежат; везде
взято либо описание из подтверждённых основ (`naw' laH` «доступ возможен» для
accessibility, `woQ Qorwagh` «окно подтверждения» для confirmation dialog), либо
ближайший по смыслу подтверждённый корень (`jem` для detected, `'ol` для make sure /
check, `Hev` для available — по образцу `about.dev-no-updates`).

### Настройки квенья: опора только на дамп, четыре опоры пересняты (`qya`)

`E:/tmp/qya_settings_fill.py` — те же 208 путей, что у клингонского батча, но
опоры другие: каждое слово либо из дампа Eldamo (`--show` по лемме, `--gloss` по
английской глоссе, `--forms` по основе), либо собрано из аттестованных основ и
тогда помечено в `gloss_qya.json` как `source: not`. Так закрыты термины, которых
в языке нет: «уведомление» = `sinwatië` (sinwata- «to make known, announce,
notify»), «интеграции» = `ocarië` (ocar- «to cooperate, work together»),
«подтверждения» = `tancatië` (tancata- «to make firm, fix, confirm», 6 форм),
«внешность» = аттестованное `nemesta` («appearance, seeming»), «расширенные» =
`tumba partië` (tumba — q прил. «deep, lowlying»), «граница лимита» = `hríma`
(«edge, hem, border») с послелогом `pella` («beyond (boundary or limit)»),
«модель ИИ» = `cantemma` («shaped image, sculpture»), «провайдер» = `antindo`
(anta- «to give» + -indo по прецеденту `tecindo`/`minasurindo`), «поставщик
доли/квоты» — `massë` и `estatië` (оба «portion, share»). Время собрано на
аттестованных мерах: `lúmincë` (минута), `lúmë` (час), `aurë` (день), `otsola`
(неделя), `asta` (месяц, мн. `astar`), плюс `nótima` «several», `úoio` «never»,
`ríllumë` «often», `epë` «after».

Четыре опоры батч и предшествующие группы вернули назад в дамп, потому что
проверка леммы не сошлась:

- `fána` для «премиум/отлично» — в Eldamo это «raiment, veil», а прилагательное
  `fána` значит «белый»; взято `maira` («admirable, excellent, precious», 4 форм).
  Форму `fana` без ударения батч оставил там, где смысл «форма/облик»:
  `i aurëo fana` = «формат дня» (это отдельная аттестованная запись).
- `cóma` — лемма «file» в дампе одна: `cómë` (nq n, 0 форм), множественное по
  модели `lissë → lissi` даёт `cómi`; формы на `-a` в дампе нет вовсе (`--show cóma`
  — 0 записей). Сведено к `cómë` (единичное), `cómi` (множественное и модификатор:
  «File Manager» = `i cómi mahtandossë`) и `cómillon` (собранный аблатив
  множественного для «from disk»). Всего пять строк: три из этого батча
  (`settings.language.folderHint`, `settings.language.reloaded`,
  `settings.git.edit-global-config-link`) и две закоммиченные ранее —
  `menu.open-working-directory`, `menu.show-logs`.
- `indyaro tengwi` для «переменные окружения» — `indya` в дампе значит
  «device, machine, engine», а глоссы `environment`/`medium` дают 0 записей.
  В каталог опора не попала: черновик батча переписан на `amparo tengwi`
  («настройки хуков») плюс `i Shellollo` («из оболочки») — пять строк подгруппы
  `git`; `indya` в `qya.json` не встречается вовсе.
- `vëalta` — ни леммы, ни корневой глоссы; в `toolbar.forcePushWarning` им было
  передано «to match». Заменено на связочное `i nyárë úva ve i palan hauramo nyárë`
  («история будет как история удалённого хранилища»), где `ve` — аттестованный
  предлог «as, like» (39 форм).

Омографных ловушек в батче три, все помечены в глоссарии: `hríma` и `massë` имеют
омографы в более ранних стадиях языка (`hríma` = «many», `masse¹` = «where»), а
`sana-` («to think», 1 форма) отличается от `sana-` глоссы «can, know how». Один
случай, где проверка леммы обманула: `cata` не находится по `--show cata`, потому
что в дампе лемма записана как `ca(ta)` — нашлась только по `--gloss behind`
(8 форм); «фоновые обновления» = `enhanya cata` оставлено как подтверждённое.

Глоссарий языка после батча — 330 записей (было 280): `E:/tmp/gloss_qya_add_settings.py`
дописал 50 терминов этого батча, каждая с периодом (`nq`/`q`), числом аттестованных
форм и ссылкой на источник дампа; ни одна запись не добавлена без прогона меры.
Совпадений с оригиналом — 8 (`tab.copilot`, `tab.git`, `integrations.shell`,
`advanced.gcm-name`, `appearance.format-example`, три `copilot.provider-type-*`):
бренды и имя службы, как и в клингонском.

## Формы множественного числа
Набор форм берётся из каталога (`meta.pluralCategories`), а не из `Intl`: для тега,
которого нет в CLDR, `Intl` выдаёт формы системной локали машины, и на русской
Windows клингонский обзавёлся бы `_few` и `_many`. Декларация делает набор
одинаковым у всех переводчиков.

| тег | категории | почему |
| --- | --- | --- |
| `en` | `one, other` | данные CLDR |
| `ru`, `uk` | `one, few, many, other` | данные CLDR |
| `eo` | `one, other` | данные CLDR |
| `la` | `one, other` | латынь различает единственное и множественное |
| `tlh` | `one, other` | при числительном существительное не требует плюрального суффикса |
| `qya` | `one, other` | у квенья четыре числа, но двойственное («неразделимая пара», руки) и собирательное («народ») — не предсказатели счёта; произвольный числительный остаётся множественным |

`la`, `tlh`, `qya` в CLDR отсутствуют, поэтому их категории — следствие грамматики,
а не упрощение. Плюс к этому редактор умеет открывать любую из шести CLDR-форм
кнопкой «Добавить форму» — так клингонский или квенья могут получить `_two` там,
где строка говорит о паре.

Источники: таблица «Language Plural Rules» CLDR
(<https://www.unicode.org/cldr/charts/48/supplemental/language_plural_rules.html>),
«Klingon grammar» (<https://en.wikipedia.org/wiki/Klingon_grammar>) и статья
«Квенья» (<https://ru.wikipedia.org/wiki/Квенья>), раздел «Числа»: там четыре
числа квенья перечислены и объяснены, а `qya` стоит как ISO/DIS 639-3 код языка —
тот же тег, что несёт каталог.

## Русская подстрочница

Каталоги `tlh` и `qya` объявляют `meta.gloss: "ru"`. В экране «Настройки → Язык»
появляется чекбокс «Показывать перевод-подсказку» и `Select` с её формой: «под
строкой» или «во всплывающей подсказке». Под каждой подписью печатается русский
текст той же строки. В окне — вторая строка, в нативном меню — та же подпись в
скобках, потому что `MenuItem.sublabel` доступен только на macOS 14.4+.
Форма лежит в отдельном ключе `localization-gloss-form`, поэтому снятие и
повторное включение чекбокса возвращает выбранную форму, а не дефолт.

Подсказка открывается и по наведению, и по фокусу, причём фокус бывает по обе
стороны от неё: `span` с переводом сам фокуса не получает, поэтому слушается
его ближайший фокусируемый предок (`button`, `a[href]`, поле ввода), а если
переведённая строка несёт собственные ссылки — как «О программе» с именем
автора — подсказку открывает и фокус внутри неё. Текст внутри неё выделяется,
`Escape` её гасит, а вход курсором в саму подсказку не прячет её — три
требования критерия WCAG 1.4.13
«Content on Hover or Focus»
(<https://www.w3.org/TR/WCAG22/#content-on-hover-or-focus>). Озвучки по этой
подсказке нет: апстрим держит её корень с `aria-hidden="true"`, и для читающих
экраном предназначена форма «под строкой».

Мнемоники (`&`) из подстрочницы вырезаются: метку акселератора несёт сама
подпись меню, и русская подсказка не имеет права добавлять вторую.

Режим по умолчанию выключен, поэтому ни существующие тесты, ни e2e-селекторы по
тексту его не видят. Подсказка есть только у строк, которые рендерит `<Trans>`;
у подписей, переданных в чужой компонент строкой через `t()`, своего элемента
под подсказку нет — там остаётся форма «под строкой».

## Транскрипция: латиница → кириллица

Значения `tlh` и `qya` в каталоге — оригинальной записью языка, латиницей
(«tlhIngan Hol», «Quenya»), как и `meta.name` с `meta.nativeName`. Кириллица —
не запись каталога, а транскрипция: она выводится из значения таблицей ниже,
когда включён режим подсказки. Латиницу читает тот, кто знает язык, кириллицу —
тот, кто его только слышит, а смысл даёт русская подстрочница.

Клингонский — по статье «Клингонский язык»
(<https://ru.wikipedia.org/wiki/Клингонский_язык>), где таблица соответствий
приведена целиком:

| запись | кириллицей |
| --- | --- |
| `a` | а |
| `e` | э |
| `I` | ы |
| `o` | о |
| `u` | у |
| `b` | б |
| `ch` | ч |
| `D` | д |
| `gh` | г |
| `H` | х |
| `j` | дж |
| `l` | л |
| `m` | м |
| `n` | н |
| `ng` | нг |
| `p` | п |
| `q` | к |
| `Q` | кх |
| `r` | р |
| `S` | ш |
| `t` | т |
| `tlh` | тль |
| `v` | в |
| `w` | уа / ва |
| `y` | й |
| `'` | апостроф — гортанная смычка |

Квенья — по статье «Квенья» (<https://ru.wikipedia.org/wiki/Квенья>), раздел
«Фонетика и фонология»: там для каждой записи приведён звук в МФА. Кириллица в
этой таблице — наше приближение к названному источнику звуку, собственной
кириллической таблицы у статьи нет (для записи квенья, говорит она, «часто
используется латиница»).

| запись | звук | кириллицей | откуда |
| --- | --- | --- | --- |
| `c` | [k] | к | «буква c всегда произносится как [k]»; `c` вместо `k` — ради латинского вида написания |
| `k` | [k] | к | Толкин «использует в разных текстах как c, так и k» |
| `ty` | [c] | ть | палатальный взрывной; статья приводит его в списке начальных сочетаний: «кроме qu [kʷ], ty [c], ny [ɲ] и nw [nʷ]». Русская грамматика (<http://www.tolkien.ru/drauger/quenya.htm>, «Фонология») описывает его как [т’й], то есть смягчённый взрывной, а не аффрикату, поэтому «ть» |
| `ny` | [ɲ] | нь | тот же список |
| `hy` | [ç] | хь | «вместо [ʃ] и [ʒ] — глухой палатальный спирант [ç], который Толкин обозначал как hy», пример `hyarmen` [ˈçarmen] «юг» |
| `qu` | [kʷ] | кв | тот же список |
| `nw` | [nʷ] | нв | тот же список; отдельного русского соответствия у лабиализованного [n] нет, поэтому «н» плюс «в» |
| `ng` | [ŋ] | нг | звонкие смычные встречаются «только в сочетаниях mb, nd/ld/rd и ng» |
| `x` | [ks] | кс | список сочетаний середины слова |
| `v` | [v] | в | ряд фрикативных |
| `w` | [w] | в | аппроксимант ряда лабиальных; собственного знака у звука в русском нет, «в» — то, чем его пишут |
| `y` | [j] | й | аппроксимант ряда палатальных |
| `b`, `d`, `g` | [b], [d], [ɡ] | б, д, г | те же ограниченные позиции |
| `a e i o u` | краткие | а э и о у | «пять гласных … которые могут быть краткими и долгими», тембром «скорее напоминает латынь» |
| `á é í ó ú` | долгие | а: э: и: о: у: | «долгота гласного на письме обозначается при помощи знака акута» |
| `ë`, `ä` | те же гласные | е, а | трема только показывает, что `e` не немая (`Manwë`) и что гласные не сливаются (`Eärendil`); «смысловой нагрузки не несёт и может быть опущена» |
| `ai au oi ui eu iu ei` | дифтонги | ай ау ой уй эу йу ей | раздел «Гласные звуки»; про `ei` статья говорит «вероятно … передаёт звукосочетание [эй]», а `ui` и `iu` читаются через «й», как русская орфография пишет то же [j] перед гласной |

Отдельно про то, чего в таблице нет. Аффрикат в квенья отсутствует — «отсутствуют
звуки [t͡ʃ], [d͡ʒ]; вместо [ʃ] и [ʒ] — [ç]», — поэтому из прежней редакции таблицы
убрана строка `hz` → «дз»: ни [d͡z], ни [z] как аффрикат источник не описывает, и
соответствия ей мы не знаем. `s` в конце слова остаётся «с», потому что [θ] и [ð],
в отличие от синдарина, в квенья нет.

И отдельно про то, чего в таблице не может быть. Строка даёт букву за звуком, а
русское письмо пишет сочетание по-своему, и читатель произносит именно его. Поэтому
после таблицы идёт правка орфографии (`refineQuenya` в `app/src/lib/l10n/translit.ts`),
которая держит четыре соглашения:

- `y` [j] после согласной становится мягким знаком, а не отдельной «й»: `cirya` —
  «кирья», а не «кирйа»;
- та же «й» в начале слова только смягчает свою гласную, как пишет источник:
  `Yavana` — «Явана»;
- «ь» и «хь» перед гласной уносят гласную к себе: `tyalië` — «тьялиэ»;
- `l` вне позиции перед гласной пишется полумягко, «ль»: `Eldar` — «Эльдар»,
  `Eärendil` — «Эарендиль», а перед гласной остаётся твёрдым: `lanta` — «ланта».

Клингонскому ничего из этого не нужно: его `I` пишется «ы» именно для того, чтобы
согласная перед ним осталась твёрдой.

Каждая строка обеих таблиц закреплена кодом в
`app/test/unit/l10n-translit-test.ts`: документ — проза, а проверка отвечает за то,
что буква не поменяла чтение и диграф не проиграл буквам внутри себя.

## Откуда слова

- `eo` — живой язык с устоявшейся IT-терминологией; единственные категории
  которого подтверждены CLDR.
- `la` — мёртвый, но терминография существует.
- `tlh` — словарь Окранда в машинном дампе boQwI'; технические термины образуются
  из его корней словообразованием.
- `qya` — Eldamo Пола Строка: там Толкин (отметка `q`) отделён от посттолкиновского
  Neo-Quenya (`nq`), и современные термины строятся из основ второго слоя по
  тем же правилам словообразования.

Два языка из четырёх требуют подтверждения слова внешним словарём, и для них
проверка сделана скриптом. Скрипты и дампы лежат в `glm/scripts/` у автора батча и
в Git не входят намеренно: дампы — чужие данные, а не часть сборки.

| тег | дамп | размер | что в нём подтверждается |
| --- | --- | --- | --- |
| `tlh` | `ek_dictionary.md` из `De7vID/klingon-assistant-data` (<https://github.com/De7vID/klingon-assistant-data>) | 378 805 Б | корень, глагольная приставка, суффикс с номером типа, либо форма целиком из словарного примера |
| `qya` | `eldamo-data.xml` из `pfstrack/eldamo` — Eldamo, Пол Строек, <https://eldamo.org>, CC BY 4.0 | 30 325 949 Б | лемма Neo-Quenya, attested-форма Толкина, глагольная основа, аффикс |

```bash
python glm/scripts/l10n_check_klingon.py --dict glm/scripts/data/ek_dictionary.md \
    --catalog app/locales/tlh.json --keys-from-meta-ready \
    --allow GitHub,Desktop,Git,Copilot,Beta,com,Enterprise
python glm/scripts/l10n_check_quenya.py --xml glm/scripts/data/eldamo-data.xml \
    --catalog app/locales/qya.json --keys-from-meta-ready \
    --allow GitHub,Desktop,Git,Copilot,Beta,com,Enterprise
```

Мерка 16.10.2026 после правок батча. Клингонский: 218 слов в проверке, 0 не
подтверждается словарём, 0 подтверждено только примером. Квэнья: 52 вхождения
(30 уникальных форм), 0 не подтверждается; по уровням 22 леммы Neo-Quenya, 28
attested-форм, 2 глагольные основы, 0 «основа плюс суффикс». По уникальным формам
это 13 лемм, 15 attested и 2 основы.

Оба скрипта — гейт, а не переводчик: они подтверждают, что слово существует и
собирается по правилам, но не что фраза смысловерна. Это и есть потолок справки.

### Мера, о которой надо писать отдельно

И гейт, и дамп у одного написания имеют несколько записей, и первая из них — не
«главное значение», а просто первая в файле. Таблица, построенная по первой
глоссе, трижды за батч выдавала ложный дефект там, где перевод был верен:

- клингонский `ngeq` первой записью значит «bump into, collide with», а
  «cache, store, hoard» — второй;
- `chen` — «build up, take form», `mI'` — «number», `poS` — «open», `QIn` —
  «message», `loS` — «wait (for)», `teq` — и «remove, take off», и «assume»,
  `lu'` — «yes, okay» вдобавок к «I will»;
- квенья `anta` — существительное «jaw», а «to give» записан отдельной основой
  `anta-`; у `harya` attested-форма даёт «left (hand)», а нужный батчу глагол
  «to have» — отдельная основа; `vinya` в записях-названиях даёт «The Noldo» и
  «Young, New Land», а «young, new» — та же форма в другой записи.

Поэтому ниже у формы печатаются ВСЕ её различные записи, а перестановки слов
одной и той же записи («data, information» / «information, data») свёрнуты: иначе
таблица раздувается вдвое и читается как перечень разных слов.

Глоссы аффиксов в клингонских цепочках не печатаются вовсе — у аффикса омографов
больше всего, и первая запись даёт чужой смысл: `-meH` первой записью «bridge (of a
ship)» вместо «in order to», `-bogh` — «be born» вместо «which», `-be'` — «female,
woman» вместо отрицания. Вместо глосс цепочка печатается членением
(`yIcha'be'qa'` = `yi + cha' + be' + qa'`), а читатель с словарём проверит суффиксы
сам.

Три формы подтверждаются и как целые токены из примеров дампа, и разбором. Для
`yI'ol` («but verify.») и `yIngu'` («What is your favorite month?») разбор смыслу
не противоречит: `'ol` — «check if (something) is true, verify», `ngu'` —
«identify». Для `Supaw'jaj` (`welcome.aria`, `welcome.title`) всё наоборот: пример
дампа даёт «Welcome!», а корневой разбор `su + paw' + jaj` — «you (plural)-none» +
«butt heads» + пожелительный `-jaj`, то есть совершенно другой смысл. Эта строка
держится на одном словарном примере, и при следующей сверке её править в первую
очередь.

### Корни клингонского, которые берёт батч

| форма | записи дампа (все, перестановки свёрнуты) |
| --- | --- |
| `'ach` | but, nevertheless, even so, however, whereas (conj) |
| `'e'` | that (previous topic) (n:pro) |
| `'ej` | and (joining sentences) (conj); star? (n) |
| `'em` | area behind, behind (n); vomit (v:t) |
| `'oH` | it (n:pro) |
| `bop` | be about, be concerned with (v:t_c) |
| `chab` | dumpling, pie, tart (n); innovation, invention (n) |
| `chaw'` | allow, permit (v:t_c); permit (n) |
| `chen` | build up, take form (v:i_c) |
| `chenmoH` | create, form, make (v:t_c) |
| `chu'` | activate, engage (a device) (v:t_c); be new (v:is); play (a musical instrument) (v:t_c) |
| `chut` | law (n) |
| `DaH` | array, bank (n); now (adv) |
| `De'` | data, information (n) |
| `De'wI'` | computer (n) |
| `Hal` | be porous (v:is); source (n) |
| `Hoch` | all, everyone, everything, each (n) |
| `HochDIch` | end, last item in a list (n:num) |
| `Hol` | language (n) |
| `jaj` | day (from dawn to dawn) (n) |
| `jonHa'` | release (v:t_c) |
| `lo'` | make use of, use (v:t_c); mode, use (n) |
| `lu'` | I will, yes, okay (excl) |
| `lup` | second (of time) (n); transport (v:t_c) |
| `mab` | account (for using a service) (n); agreement, treaty, contract, commitment (n) |
| `mev` | stop, cease (v:ambi) |
| `mI'` | dance, run in place, do calisthenics (v:t); number (n) |
| `mIw` | formula, procedure, process, step, stage (in a process), recipe (n) |
| `mugh` | translate (v:t_c) |
| `muj` | factually wrong, be factually wrong, be wrong, be incorrect (v:is); incorrect, be incorrect, be wrong, be factually wrong (v:is); wrong, be wrong, be incorrect, be factually wrong (v:is) |
| `ngeH` | send (v:t_c) |
| `ngo'` | be old (not new) (v:is) |
| `nIqHom` | software (n) |
| `pat` | system (n) |
| `pe'vIl` | by force, forcefully (adv) |
| `pegh` | keep something secret (v:t_c); be secret (v:is); secret (n) |
| `pItlh` | done (uttered at the completion of a task) (excl) |
| `poH` | period of time, session, shift (n); time (v:t_c) |
| `pong` | call, name (v:t_c); name (n) |
| `poS` | left (side) (n); open, be open, be opened (v:is) |
| `qay'` | blow one's top, lose one's temper (v:i); a hassle, be a hassle, be a problem (v:is); a problem, be a problem, be a hassle (v:is) |
| `QIn` | groan, moan (v:i); inject (v:t_c); message (n) |
| `rIn` | accomplished, be accomplished, be finished (v:is); finished, be finished, be accomplished (v:is) |
| `tlhab` | free, be free, be independent (v:is); freedom, independence (n); independent, be independent, be free (v:is) |
| `vabDot` | even, moreover, furthermore (adv) |
| `vep` | advertisement, proclamation, notification, announcement, and the like (n) |
| `wa'DIch` | first (n:num) |

### Формы клингонского, собранные словообразованием

| форма | из чего собрана |
| --- | --- |
| `bIchenmoHbogh` | bi + chenmoh + bogh |
| `bIghaj` | ghaj |
| `bIghajbogh` | bi + ghaj + bogh |
| `bIjonHa'DI'` | bi + jonha' + di' |
| `chaw'be'lu'` | chaw' + be' + lu' |
| `chenmoHDI'` | chenmoh + di' |
| `De'mey` | de' + mey |
| `De'vetlh` | de' + vetlh |
| `DubmeH` | dub + meh |
| `DuHmey` | duh + mey |
| `ghaqmeH` | ghaq + meh |
| `Hevbe'lu'` | hev + be' + lu' |
| `jInmolmey` | jinmol + mey |
| `jInmolmeyvaD` | jinmol + mey + vad |
| `jomlaH` | jom + lah |
| `mangeqtaH` | ma + ngeq + tah |
| `mIwvam` | miw + vam |
| `ngeqta'` | ngeq + ta' |
| `QInmey` | qin + mey |
| `QInvam` | qin + vam |
| `qotwI'` | qot + wi' |
| `Qutlhbe'` | qutlh + be' |
| `Qutlhbogh` | qutlh + bogh |
| `SeHwI'` | seh + wi' |
| `Supaw'jaj` | su + paw' + jaj (см. оговорку выше) |
| `taHchugh` | tah + chugh |
| `tu'laH` | tu' + lah |
| `wI'olta'` | wi + 'ol + ta' |
| `wI'oltaH` | wi + 'ol + tah |
| `wI'oltaHbogh` | wi + 'ol + tah + bogh |
| `wISovbe'` | wi + sov + be' |
| `wuqmeH` | wuq + meh |
| `yI'ol` | 'ol |
| `yI'olqa'` | yi + 'ol + qa' |
| `yIcha'be'qa'` | yi + cha' + be' + qa' |
| `yIchel` | chel |
| `yIghoj` | ghoj |
| `yIjom` | jom |
| `yIlegh` | legh |
| `yIleghlaH` | yi + legh + lah |
| `yIlo'` | lo' |
| `yIloS` | los |
| `yInej` | nej |
| `yIngaQHa'moH` | ngaqha'moh |
| `yIngeH` | ngeh |
| `yIngu'` | ngu' |
| `yIpol` | pol |
| `yIpolHa'` | polha' |
| `yIpoSmoH` | posmoh |
| `yIqIl` | qil |
| `yIQochbe'` | qochbe' |
| `yISeH` | seh |
| `yISoQmoH` | soqmoh |
| `yIteq` | teq |
| `yIwaHqa'` | yi + wah + qa' |

### Формы квенья по Eldamo

Уровень — где форма найдена; у одной формы уровней может быть несколько, тогда в
последней колонке перечислены все её различные записи. Отметки `[q]`/`[mq]`/`[nq]`
в записях — слои Eldamo (Толкин, его ранние версии, Neo-Quenya); среди записей
встречаются переводы цитат, а не только глосс слова.

| форма | уровень | записи Eldamo |
| --- | --- | --- |
| `alla` | attested | [q] hail Eärendil, brightest of stars; [q] welcome, hail; [mq] none, nothing; [q] never |
| `apanta` | лемма nq | apanta- (vb) — to open, reveal, show, display |
| `apta` | attested | [q] to refuse, deny, say nay; apta- — to refuse, deny, say nay |
| `aulerya` | лемма nq | aulerya- (vb) — to rid, free somebody of something |
| `aurë` | attested | [q] Behold, people of the Eldar and Fathers of Men, the day has come!; [q] day (as opposed to night), daylight, sunlight, morning; [q] Day shall come again!; [q] The day has come! |
| `cara` | attested | [q] to do, make; [q] thy will be done |
| `cilmë` | attested | [q] choice, choosing |
| `enquet` | основа q | enquet- — to repeat, say again |
| `essë` | attested | [q] name |
| `ferya` | лемма nq | ferya (adj) — quick, ready, prompt; ferya- — to make ready (promptly) |
| `haita` | лемма nq | haita- (vb) — to remove, (lit.) make distant |
| `harya` | attested | [mq] left (hand); harya- — to have |
| `holya` | attested | [q] ?to shut, close; holya- — ?to shut, close |
| `hritya` | лемма nq | hritya- (vb) — to achieve, accomplish |
| `larta` | лемма nq | larta- (vb) — to wait, stay, last, endure |
| `lerië` | лемма nq | lerië (n) — issue, release, edition |
| `leryalë` | лемма nq | leryalë (n) — release |
| `metta` | attested | [q] ending, end; [q] *with this the long tale ends and my extended long day is complete; [q] In this place will I abide, and my heirs, unto the ending of the world |
| `panwë` | лемма nq | panwë (n) — arrangement, plan |
| `quettar` | attested | [q] those who form words with voices; [q] word |
| `rehta` | основа q | rehta- — to rescue, save |
| `sina` | attested | [q] this; [q] This oath shall stand in memory of the glory of the Land of the Star |
| `tenca` | лемма nq | tenca (n) — letter (epistola) |
| `tira` | attested | [q] to watch (over), guard, heed |
| `tulca` | лемма nq | tulca- (vb) — to set up, establish, *found |
| `tulu` | attested | [q] to come |
| `tulya` | лемма nq | tulya (adj) — coming, approaching, future; [q] [and] lead us not into temptation; [q] to come; [q] *to lead |
| `vinya` | attested | [q] The Noldo; [mq] Young, New Land; [q] young, new; [mq] pale blue |
| `yanta` | лемма nq | yanta-¹ (vb) — to join; [nq] yoke; [q] wide, vast, huge; [q] bridge |
| `úvanima` | attested | [q] not fair, ugly |


Отдельно про имена, которые не переводятся. `GitHub`, `GitHub Desktop`, `Git`,
`Copilot`, `Beta` остаются своей записью. Для квенья это не мешает транскрипции
(`G`, `i`, `t`, `b` в таблицу входят — `Git` читается «кит»), для клингонского —
мешает: `G` и `g` вне алфавита, и `transliterate` на таком значении возвращает
`undefined`, то есть транскрипции нет, а русская подстрочница остаётся. Это
штатное поведение слоя, а не дефект батча: гард «латинская буква не из алфавита —
транскрипции нет» существует именно чтобы английскую копию не выдавать за
произношение.

В каталогах это поле — `meta.authors`: там кредит переводчика (`["BaHooo"]`), а не
это описание. Диалог «О программе» берёт его из активного каталога и печатает
строкой «Локализация: …» (`about.l10nCredit`). Сама справка по источнику терминов
живёт только здесь.
