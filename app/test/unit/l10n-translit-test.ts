import { describe, it } from 'node:test'
import assert from 'node:assert'
import { transliterate } from '../../src/lib/l10n/translit'

// The two tables of `docs/fork-localization-progress.md` are the only place a
// Cyrillic reading of these languages is defined, and the file is prose, so the
// rows are pinned here as code: a letter changing its answer, or a digraph
// starting to lose to the single letters inside it, fails a check instead of
// turning the hint into noise.
describe('Klingon transcription', () => {
  it('reads the digraphs before the letters inside them', () => {
    // `tlh` is one letter of the language; matching it as `t` + `l` + `h` would
    // produce «тлх», which the source table explicitly is not.
    assert.equal(transliterate('tlhIngan Hol', 'tlh'), 'тльынган хол')
    assert.equal(transliterate("chang'egh", 'tlh'), "чанг'эг")
  })

  it('keeps the case-sensitive letters apart', () => {
    // `q`, `Q`, `S`, `I`, `D`, `H` are separate letters, not capitals, so folding
    // case would merge two Klingon words into one reading.
    assert.equal(transliterate('qap', 'tlh'), 'кап')
    assert.equal(transliterate('DoS', 'tlh'), 'дош')
    assert.equal(transliterate('QoS', 'tlh'), 'кхош')
    assert.equal(transliterate('jIH', 'tlh'), 'джых')
  })

  it('chooses the w by what follows it', () => {
    // The table gives `w` as «уа / ва», which is one letter with two readings:
    // «в» before a vowel (`waS` is «one», read «вас»), «у» when nothing does.
    assert.equal(transliterate('waQ', 'tlh'), 'вакх')
    assert.equal(transliterate('naw', 'tlh'), 'нау')
  })

  it('leaves the glottal stop and punctuation as written', () => {
    assert.equal(transliterate("'oy'", 'tlh'), "'ой'")
    assert.equal(transliterate('HoS!', 'tlh'), 'хош!')
  })

  it('refuses text that is not Klingon', () => {
    // A lower-case `c`, `d`, `h`, `s`, `i` belongs to no Klingon letter, so an
    // English row cannot be given a Klingon reading.
    assert.equal(transliterate('Cancel', 'tlh'), undefined)
    assert.equal(transliterate('Invalid date', 'tlh'), undefined)
  })
})

describe('Quenya transcription', () => {
  it('reads the palatals and the labiovelar', () => {
    // «Квенья» is the name the Russian article uses, and it only comes out of
    // the table together with the spelling rules of `refineQuenya`.
    assert.equal(transliterate('Quenya', 'qya'), 'Квенья')
    assert.equal(transliterate('hyarmen', 'qya'), 'хьярмен')
    assert.equal(transliterate('tyalië', 'qya'), 'тьялиэ')
    assert.equal(transliterate('nwa', 'qya'), 'нва')
  })

  it('follows the Russian transcription the source spells out', () => {
    // Every one of these is a reading the article gives in Cyrillic itself
    // (<http://www.tolkien.ru/drauger/quenya.htm> and the pronunciation overview
    // it agrees with), so the table plus `refineQuenya` has to land on them.
    assert.equal(transliterate('Yavana', 'qya'), 'Явана')
    assert.equal(transliterate('Eldar', 'qya'), 'Эльдар')
    assert.equal(transliterate('Eldalië', 'qya'), 'Эльдалиэ')
    assert.equal(transliterate('Uinen', 'qya'), 'Уйнен')
  })

  it('reads c as k, and x as ks', () => {
    // «буква c всегда произносится как [k]», and `x` stands for the pair [ks].
    assert.equal(transliterate('cirya', 'qya'), 'кирья')
    assert.equal(transliterate('anaxa', 'qya'), 'анакса')
  })

  it('softens l only where no vowel follows it', () => {
    // Russian writes an `l` before a consonant or at the end of a word as «ль» —
    // that is how the source itself spells «Эльдар» — and keeps it hard before a
    // vowel, so both halves belong in one check.
    assert.equal(transliterate('helmat', 'qya'), 'хельмат')
    assert.equal(transliterate('lanta', 'qya'), 'ланта')
  })

  it('writes length with a colon and drops the trema', () => {
    assert.equal(transliterate('lúva', 'qya'), 'лу:ва')
    assert.equal(transliterate('ánar', 'qya'), 'а:нар')
    assert.equal(transliterate('Eärendil', 'qya'), 'Эарендиль')
  })

  it('reads the diphthongs as one syllable', () => {
    assert.equal(transliterate('nai', 'qya'), 'най')
    assert.equal(transliterate('auar', 'qya'), 'ауар')
    assert.equal(transliterate('oi', 'qya'), 'ой')
    assert.equal(transliterate('uinen', 'qya'), 'уйнен')
    // `iu` writes as the yotated vowel at the start of a word, which is how
    // Russian spells the same [j] before [u] anyway.
    assert.equal(transliterate('iu', 'qya'), 'ю')
  })

  it('keeps the capital of the word it transcribes', () => {
    // Latin Quenya is written in sentence case, so the first letter of the
    // result has to follow the source rather than the table.
    assert.equal(transliterate('Amanyar', 'qya'), 'Аманьяр')
  })

  it('refuses letters Quenya does not have', () => {
    assert.equal(transliterate('jar', 'qya'), undefined)
    assert.equal(transliterate('zip', 'qya'), undefined)
  })
})

describe('transcription and the text around it', () => {
  it('leaves placeholders and markup out of the table', () => {
    // `{count}` is filled by the caller and `<link>` becomes an element; a
    // transcription that spelled them out would break both the substitution and
    // the markup.
    assert.equal(transliterate('{name} tlhIngan', 'tlh'), '{name} тльынган')
    assert.equal(
      transliterate('<link>Quenya</link>', 'qya'),
      '<link>Квенья</link>'
    )
  })

  it('passes mnemonics and digits through', () => {
    // `&` marks an access key in the label itself; the reading is printed as
    // text, so the marker is the menu's business, not the table's.
    assert.equal(transliterate('&HoS', 'tlh'), '&хош')
    assert.equal(transliterate('2 tlhIngan', 'tlh'), '2 тльынган')
  })
})
