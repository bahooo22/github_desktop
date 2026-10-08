# OAuth-клиент этого форка и алерт `js/build-artifact-leak`

Code Scanning держит четыре открытых алерта «Storage of sensitive information in
build artifact» (High) с одним и тем же потоком:
`process.env.DESKTOP_OAUTH_CLIENT_ID` / `DESKTOP_OAUTH_CLIENT_SECRET`
(`app/app-info.ts:24-27`) → `export const replacements = getReplacements()`
(`app/webpack.common.ts:10`) → объект опций `new webpack.DefinePlugin(...)`
(указывает на `app/webpack.common.ts:176`, конфиг `target: 'webworker'`).
Документ фиксирует, что поток реален, почему он не утечка реквизитов и что именно
было измерено, а не выведено.

## Что за значения и что из них попадает в сборку форка

`app/app-info.ts:10-11` — `devClientId` и `devClientSecret` лежат в репозитории
открытым текстом. Это не заглушки вида `xxx`: формат 20 hex + 40 hex — старый
формат реквизитов GitHub OAuth App, и в апстриме (`desktop/desktop`,
`app/app-info.ts`, SHA файла `382bb720b1`) те же две строки байт в байт. Апстрим же
и объявляет их тестовыми: `docs/technical/oauth.md:7-13` — «For external
contributors, we have bundled a developer OAuth application…» и «**DO NOT TRUST
THIS CLIENT ID AND SECRET! THIS IS ONLY FOR TESTING PURPOSES!!**», с оговоркой, что
с ними не работает GitHub Enterprise.

Подстановка выбора значения — `app/app-info.ts:24-27`
(`process.env.DESKTOP_OAUTH_* || dev*`). В этом форке эти переменные не задаёт ни
один workflow: `grep` по `.github/` находит их только в `ci.yml:34-38`, а это
reusable-workflow (`on: workflow_call`), который в форке никем не вызывается
(`grep -rn "workflows/ci.yml" .github/workflows` — пусто).
`release-fork.yml:25` задаёт только `RELEASE_CHANNEL: production`. Поэтому в
опубликованные ассеты форка по этому источнику едут публичные тестовые значения, а
не секрет.

`__DEV_SECRETS__` (`app/app-info.ts:34`) — не «dev-сборка против prod»: его
единственный читатель, `app/src/main-process/main.ts:121-125`, выбирает из двух
кастомных схем — `x-github-desktop-dev-auth` или `x-github-desktop-auth`. Флаг
отвечает на вопрос «какие реквизиты вшиты, под какую из них зарегистрирован
protocol handler»; введён апстрим-коммитом `97ae932f8e` «Use Dev protocol when
using Dev secrets» (28.02.2025). В сборках форка он `true` и при
`RELEASE_CHANNEL=production`, потому что секрета в окружении нет.

## Кто читает их в рантайме

Значения живут в двух модулях, и оба — часть графа рендерера:

| Место | Что делает |
| --- | --- |
| `app/src/lib/api.ts:133-134` | держит `ClientID`/`ClientSecret` |
| `app/src/lib/oauth-token.ts:4-5` | те же значения для обмена и ротации |
| `app/src/lib/api.ts:2416` | `/login/oauth/authorize?client_id=…&scope=…&state=…` |
| `app/src/lib/oauth-token.ts:146-158` | POST `login/oauth/access_token` телом `{client_id, client_secret, …}` |
| `app/src/lib/api.ts:2258-2265` | отзыв токена: `Authorization: Basic base64(client_id:client_secret)` на `DELETE applications/{client_id}/token` |

`code_challenge` в `app/src` не встречается (`grep` находит только `grant_type` в
`oauth-token.ts:122`), то есть это web application flow без PKCE, а возврат кода
идёт через кастомную схему (`main.ts:120-131`), а не loopback. Публичность
значений проверялась и в тестах: `app/test/globals.mts:12` задаёт
`__DEV_SECRETS__: false`, а обе пары констант обнуляются по `process.env.TEST_ENV`.

Итого: установленная программа сама отправляет `client_secret` на сервер GitHub, то
есть приложение делает client authentication, оставаясь native-приложением.

## Тип клиента по RFC

- RFC 6749 §2.1: public client — «Clients incapable of maintaining the
  confidentiality of their credentials (e.g., clients executing on the device used
  by the resource owner…)».
- RFC 8252 §8.4: «native apps are classified as public clients, as defined by
  Section 2.1 of OAuth 2.0; they MUST be registered with the authorization server
  as such».
- RFC 8252 §8.5: «Secrets that are statically included as part of an app
  distributed to multiple users should not be treated as confidential secrets, as
  one user may inspect their copy and learn the secret», и сервер, который всё
  же требует такой секрет, «MUST treat the client as a public client…, and not
  accept the secret as proof of the client's identity».

Поэтому классификация алерта — **верный сигнал, принятый риск**, а не ложное
срабатывание: поток CodeQL описывает правильно. Называть это утечкой реквизитов
нельзя по §8.5, а «спрятать» значение нечем — извлечение из бандла тривиально.

## Что замерено на артефактах

Мерка 08.10.2026 в контейнере `gdlab`: `grep -oF | wc -l` по готовым бандлам из
`/work/out` (сборка 06-07.10, минифицированная; `DESKTOP_OAUTH_CLIENT_SECRET` в
окружении не задан — то есть значения те же, что и в прогоне `release-fork.yml`).
Счётчики снимала по уже собранному `out/`, нового прогона webpack не делала.

| Бандл | Вхождений `22c34d87…9d54` |
| --- | --- |
| `out/renderer.js` | 2 |
| `out/main.js` | 0 |
| `out/crash.js` | 0 |
| `out/cli.js` | 0 |
| `out/highlighter.js` | 0 |

Ноль в `main.js` — не «модуль не попал»: `main-process/main.ts:44` тянет
`lib/api` через `authenticated-image-filter.ts:1`, и литералы этого модуля в
`main.js` есть (`enterprise/avatars` — 1). Не попали неиспользуемые экспорты:
`login/oauth/authorize` и `applications/` в `main.js` — по 0 вхождений, то есть
`getOAuthAuthorizationURL` и `deleteToken` вырезаны tree-shaking'ом вместе с
константами, на которые они ссылались. В `renderer.js` те же две строки кода
доживают до артефакта (`login/oauth/authorize` — 1 вхождение), и там литералы
видны как `const Lr="3a723b10ac5575cc5bb9",Or="22c34d87…"` (api.ts) и внутри тела
запроса `JSON.stringify({client_id: …, client_secret: …})` (oauth-token.ts) — отсюда
и «2».

`*.js.map` тех же бандлов литералов не содержат (0 вхождений во всех трёх
проверенных): source map переносит исходный код, где стоит идентификатор
`__OAUTH_SECRET__`, а не подставленное значение.

Отсюда два вывода, важных для разбора алерта. Sink указан на конфиг
`target: 'webworker'` (`webpack.common.ts:176`), но `DefinePlugin` в `common`
один (`webpack.common.ts:10`) и кладётся во все пять конфигов
(`:59-63`, `:96-100`, `:117-121`, `:129-133`, `:175-179`), а CodeQL моделирует его
объект опций как запись в артефакт и не проверяет граф модулей: в
`out/highlighter.js` значений нет. И наоборот — в `renderer.js` они есть, и это
необходимое условие работы входа в аккаунт.

## Почему код не меняется

- Дробить `replacements` по бандлам или выносить OAuth из webpack не имеет смысла
  по результату замера: значение нужно ровно там, где оно уже есть (renderer), и
  уже отсутствует там, где его быть не должно. Алерты это не снимает — поток
  остаётся в конфигу renderer'а.
- Запрос `js/build-artifact-leak` не отключается в
  `.github/codeql/codeql-config.yml` (там только `paths-ignore: vendor`) и не
  подавляется `lgtm`-комментарием: вместе с этими четырьмя ушли бы и будущие
  настоящие утечки через соседние определения того же `getReplacements()` —
  `__UPDATES_URL__`, `__ERROR_REPORTING_ENDPOINT__`.
- Инлайн-обоснование оставлено только там, где оно и решает: комментарий над
  `devClientId`/`devClientSecret` в `app/app-info.ts`.

Действие по самим алертам — Dismiss в интерфейсе (`state=dismissed`,
`dismissed_reason="won't fix"`), с формулировкой: public native client по
RFC 8252 §8.4/§8.5; в сборки форка ни один workflow не передаёт
`DESKTOP_OAUTH_CLIENT_SECRET`, поэтому в артефакты попадает только публичный
тестовый client id; отказ от вшитого секрета ломает обмен кода
(`oauth-token.ts:146-158`) и отзыв токена (`api.ts:2258-2265`).

## Границы мерки

`out/` в `gdlab` — минифицированная сборка 06-07.10, а не артефакт из
`release-fork.yml`: они могут отличаться каналом (`RELEASE_CHANNEL`) и наличием
`DESKTOP_OAUTH_*` в окружении прогона. Что в замеренной сборке литералы именно
тестовые, следует из самого замера — значение из переменной не подставилось. На
вывод «литералы в `renderer.js`, их нет в `highlighter.js`/`main.js`/`crash.js`/
`cli.js`» это не влияет: он определяется графом модулей и вырезанием
неиспользуемых экспортов, а не каналом сборки. Проверить утверждение на релизном
артефакте можно, распаковав `app.asar` из опубликованного portable-архива и сняв те
же счётчики.
