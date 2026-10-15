/**
 * Cyrillic transcription of a catalog value written in a Latin alphabet.
 *
 * Klingon and Quenya entries keep the language's own orthography in the catalog
 * (`tlhIngan Hol`, `Quenya`), because that is how a reader of the language sees
 * it. A reader who only hears it needs the same text in letters they can sound
 * out, and that rendering is derived, never stored: a table here turns the value
 * into syllables a Russian speaker reads correctly. The tables live in
 * `docs/fork-localization-progress.md` and each rule below cites the source the
 * row comes from, so the two stay verifiable against each other.
 */
export type TranslitScheme = 'tlh' | 'qya'

type Rule = { readonly from: string; readonly to: string }

/**
 * Klingon, straight from the correspondence table of the Russian Wikipedia
 * article «Клингонский язык». The alphabet is case sensitive — `I`, `D`, `H`,
 * `Q`, `S` and the digraph `tlh` are separate letters, not capitals of letters
 * that already exist — so matching on these keys never folds case, and Klingon
 * text is written the same way: without sentence capitals.
 *
 * Two rows of the source table are ranges rather than single answers:
 *
 * - `w` is given as «уа / ва». Which of the two it is depends on what follows,
 *   so the rule below picks «в» before a Klingon vowel and «у» anywhere else,
 *   which is what `waS` («one», «вас») and `nw` («ну») require.
 * - `'` (the glottal stop) is given as «апостроф», that is, kept as written, so
 *   there is no rule for it and it passes through as punctuation.
 */
const KlingonRules: ReadonlyArray<Rule> = [
  { from: 'tlh', to: 'тль' },
  { from: 'ch', to: 'ч' },
  { from: 'gh', to: 'г' },
  { from: 'ng', to: 'нг' },
  { from: 'a', to: 'а' },
  { from: 'b', to: 'б' },
  { from: 'D', to: 'д' },
  { from: 'e', to: 'э' },
  { from: 'H', to: 'х' },
  { from: 'I', to: 'ы' },
  { from: 'j', to: 'дж' },
  { from: 'l', to: 'л' },
  { from: 'm', to: 'м' },
  { from: 'n', to: 'н' },
  { from: 'o', to: 'о' },
  { from: 'p', to: 'п' },
  { from: 'q', to: 'к' },
  { from: 'Q', to: 'кх' },
  { from: 'r', to: 'р' },
  { from: 'S', to: 'ш' },
  { from: 't', to: 'т' },
  { from: 'u', to: 'у' },
  { from: 'v', to: 'в' },
  { from: 'w', to: 'в' },
  { from: 'y', to: 'й' },
]

/**
 * Quenya. The source articles name a sound for every row and give no Cyrillic
 * table of their own, so the right-hand column here is our closest Russian
 * approximation to that sound. `ty` and `ny` follow the Russian grammar
 * (<http://www.tolkien.ru/drauger/quenya.htm>, «Фонология»), which writes them
 * as [тьй] and [ньй] — palatalized stops, not affricates — so the table hands
 * them over as `ть`/`нь` and `refineQuenya` lets Russian orthography spell what
 * follows a palatal: «tyalië» reads as «тьале».
 *
 * The rows the article leaves to the obvious correspondence (`f h l m n p r s t`
 * and the plain vowels) are still listed, because the set of keys is also what
 * says which letters belong to the language; see the note on `s` below it.
 *
 * Unlike Klingon this alphabet has no contrastive capitals — Latin text is
 * written in sentence case, `Quenya` and `Eärendil` included — so matching
 * folds case and the answer is capitalized back.
 */
const QuenyaRules: ReadonlyArray<Rule> = [
  { from: 'qu', to: 'кв' },
  { from: 'nw', to: 'нв' },
  { from: 'ty', to: 'ть' },
  { from: 'ny', to: 'нь' },
  { from: 'hy', to: 'хь' },
  { from: 'ng', to: 'нг' },
  { from: 'ai', to: 'ай' },
  { from: 'au', to: 'ау' },
  { from: 'oi', to: 'ой' },
  { from: 'ui', to: 'уй' },
  { from: 'eu', to: 'эу' },
  { from: 'iu', to: 'йу' },
  { from: 'ei', to: 'ей' },
  { from: 'á', to: 'а:' },
  { from: 'é', to: 'э:' },
  { from: 'í', to: 'и:' },
  { from: 'ó', to: 'о:' },
  { from: 'ú', to: 'у:' },
  { from: 'ë', to: 'э' },
  { from: 'ä', to: 'а' },
  { from: 'a', to: 'а' },
  { from: 'b', to: 'б' },
  { from: 'c', to: 'к' },
  { from: 'd', to: 'д' },
  { from: 'e', to: 'э' },
  { from: 'f', to: 'ф' },
  { from: 'g', to: 'г' },
  { from: 'h', to: 'х' },
  { from: 'i', to: 'и' },
  { from: 'k', to: 'к' },
  { from: 'l', to: 'л' },
  { from: 'm', to: 'м' },
  { from: 'n', to: 'н' },
  { from: 'o', to: 'о' },
  { from: 'p', to: 'п' },
  { from: 'r', to: 'р' },
  { from: 's', to: 'с' },
  { from: 't', to: 'т' },
  { from: 'u', to: 'у' },
  { from: 'v', to: 'в' },
  { from: 'w', to: 'в' },
  { from: 'x', to: 'кс' },
  { from: 'y', to: 'й' },
]

const schemes: Record<TranslitScheme, ReadonlyMap<string, string>> = {
  tlh: new Map(KlingonRules.map(rule => [rule.from, rule.to])),
  qya: new Map(QuenyaRules.map(rule => [rule.from, rule.to])),
}

/** The longest key of a scheme, which bounds the number of probes per letter. */
const lengths: Record<TranslitScheme, number> = {
  tlh: 3,
  qya: 2,
}

const KlingonVowels = new Set(['a', 'e', 'I', 'o', 'u'])

export function isTranslitScheme(value: unknown): value is TranslitScheme {
  return value === 'tlh' || value === 'qya'
}

/**
 * A placeholder or a markup frame — `{count}`, `<link>`, `</link>` — is not
 * language text: the first is substituted from the caller, the second becomes an
 * element. Both go through the transcription untouched.
 */
const Protected = /\{[a-zA-Z0-9_.-]+\}|<\/?[a-zA-Z/][^<>]*>/g

/**
 * Russian spelling of the Quenya letters the table transcribes one by one.
 *
 * The table maps a letter to a sound, and a sound to the Cyrillic letter that
 * names it — but Cyrillic then spells the combination by its own rules, and a
 * reader sounds out the spelling, not the letters. `ny` is [ɲ] and the row says
 * «нь», yet «ньа» is not a Russian sequence: the language writes «ня», and
 * `Quenya` comes out «Квэньа» without this step instead of the name everybody
 * uses in Russian, «Квенья». The same two conventions cover the rest: a `y` [j]
 * after a consonant is a soft sign rather than a separate «й» (`cirya` is
 * «кирья»), and `e` [ɛ] after a consonant is written «е» while it stays «э» at
 * the start of a word (`Eärendil` keeps its «Э»).
 *
 * Klingon needs none of this: its `I` is written «ы» precisely so that the
 * consonant before it stays hard.
 */
const Consonant = 'бвгджзклмнпрстфхцчшщ'

const Yotated: Record<string, string> = {
  а: 'я',
  о: 'ё',
  у: 'ю',
  э: 'е',
  е: 'е',
  и: 'и',
  ы: 'и',
}

function yotate(vowel: string, capital: boolean = false): string {
  const lower = vowel.toLowerCase()
  const yotated = Yotated[lower]
  return yotated === undefined
    ? vowel
    : capital || /[А-ЯЁ]/.test(vowel)
    ? upperFirst(yotated)
    : yotated
}

function refineQuenya(text: string): string {
  return (
    text
      // A palatal approximant after a consonant softens it instead of standing
      // as its own syllable.
      .replace(
        new RegExp(`([${Consonant}])й([аоуэыи])`, 'gi'),
        (_, consonant, vowel) => `${consonant}ь${yotate(vowel)}`
      )
      // [ɛ] after a consonant reads as «е»; «э» would harden it.
      .replace(new RegExp(`([${Consonant}])э`, 'g'), '$1е')
      // At the start of a word the same approximant only softens the vowel it
      // carries, which is how the source spells `Yavana` as «Явана».
      .replace(
        /(^|[\s(«.,!?:;-])(й)([аоуэыи])/gi,
        (_, before, glide, vowel) =>
          `${before}${yotate(vowel, /[А-Я]/.test(glide))}`
      )
      // Whatever the table produced as «нь» or «хь» then carries the vowel the
      // soft sign asks for.
      .replace(/ь([аоуэы])/g, (_, vowel) => `ь${yotate(vowel)}`)
      // `l` stays half soft everywhere but before a vowel - «Eldar» reads as
      // «Эльдар», `Eärendil` as «Эарендиль».
      .replace(/л(?![аеёиоуыэюьй])/g, 'ль')
  )
}

/**
 * The text as it reads in Cyrillic, or `undefined` when a letter of it belongs
 * to no letter of the language.
 *
 * That second answer is what keeps an untranslated row from being dressed up:
 * the catalogs are scaffolded from English, and spelling English with a Klingon
 * table would print a plausible looking word out of a foreign one. A Latin
 * letter the scheme has no rule for therefore ends the transcription instead of
 * passing through — `nuqneH` reads as «нукнэх», `Cancel` has no answer. The row
 * that is a byte for byte English copy is caught earlier, in
 * `LocalizationManager.getTranscription`, where the reference text is known.
 */
export function transliterate(
  text: string,
  scheme: TranslitScheme
): string | undefined {
  let out = ''
  let index = 0

  // Split on the protected spans, transcribe the text between them, and put the
  // spans back exactly as they were.
  const spans = [...text.matchAll(new RegExp(Protected.source, 'g'))]

  for (const span of spans) {
    const chunk = transcribeChunk(text.slice(index, span.index), scheme)
    if (chunk === undefined) {
      return undefined
    }
    out += chunk + span[0]
    index = span.index + span[0].length
  }

  const tail = transcribeChunk(text.slice(index), scheme)

  if (tail === undefined) {
    return undefined
  }

  return scheme === 'qya' ? refineQuenya(out + tail) : out + tail
}

type Match = { readonly consumed: number; readonly text: string }

function transcribeChunk(
  text: string,
  scheme: TranslitScheme
): string | undefined {
  const table = schemes[scheme]

  let out = ''
  let index = 0

  while (index < text.length) {
    const match = matchAt(text, index, table, lengths[scheme], scheme)

    if (match === undefined) {
      const character = text[index]

      // Everything that is not a Latin letter carries no pronunciation of its
      // own: digits, spaces, `&` mnemonic markers, the Klingon glottal stop,
      // `…`. A Latin letter that is not a letter of the language, on the other
      // hand, means the text is not in that language, and that is the one case
      // the answer to is `undefined`.
      if (/[a-zA-Z\u00c0-\u017f]/.test(character)) {
        return undefined
      }

      out += character
      index++
      continue
    }

    out += match.text
    index += match.consumed
  }

  return out
}

/**
 * The table entry for the text at `index`, trying the longest key first so
 * `tlh` wins over `t` + `l` + `h`. Case folded for Quenya, exact for Klingon,
 * where a capital is a different letter.
 */
function matchAt(
  text: string,
  index: number,
  table: ReadonlyMap<string, string>,
  longest: number,
  scheme: TranslitScheme
): Match | undefined {
  for (let consumed = longest; consumed >= 1; consumed--) {
    const source = text.slice(index, index + consumed)
    if (source.length < consumed) {
      continue
    }

    const key = scheme === 'qya' ? source.toLowerCase() : source
    const found = table.get(key)

    if (found === undefined) {
      continue
    }

    // `w` is the one Klingon row whose answer depends on what comes next: «в»
    // before a vowel, «у» otherwise (see the table's «уа / ва»).
    if (scheme === 'tlh' && key === 'w') {
      const next = text[index + 1]
      return {
        consumed,
        text: next !== undefined && KlingonVowels.has(next) ? 'в' : 'у',
      }
    }

    // Only Latin Quenya is written in sentence case, so only there does the
    // capital of the source carry over. A Klingon capital is a letter of its
    // own (`I` is /ɪ/, `H` is /x/), not the same letter shouted, and raising
    // the Cyrillic with it would mark a stress the language does not have.
    //
    // The set is spelled out because the vowels of Quenya carry marks of their
    // own: `ú` and `ë` are long and full, not capitals, and a range covering
    // `À` to `ŷ` would raise them with the rest.
    const capitalize = scheme === 'qya' && /^[A-ZÁÉÍÓÚÄË]/.test(source)

    return {
      consumed,
      text: capitalize ? upperFirst(found) : found,
    }
  }

  return undefined
}

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
