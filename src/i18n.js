/**
 * Every user-facing string in English and Turkish. `translate` fills
 * `{name}` placeholders; the rules and controls are lists of strings.
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

const EN = {
  docTitle: "Dokuz Taş · Nine men's morris",
  title: 'Dokuz Taş',
  newGame: 'New game',
  langToggle: 'TR',
  langToggleLabel: 'TR – switch to Turkish',
  undo: 'Undo',
  rules: 'Rules',
  boardLabel: 'Dokuz Taş board',
  modeLabel: 'Mode',
  modeAi: 'vs Computer',
  modeTwo: '2 players',
  levelLabel: 'Level',
  levelEasy: 'Easy',
  levelMedium: 'Medium',
  levelHard: 'Hard',
  colorLabel: 'You play',
  white: 'White',
  black: 'Black',
  pieceWhite: 'white',
  pieceBlack: 'black',
  you: 'You',
  computer: 'Computer',
  inHand: 'In hand',
  onBoard: 'On board',
  phasePlacing: 'Placing',
  phaseMoving: 'Moving',
  phaseFlying: 'Flying',
  phaseOver: 'Game over',
  actPlace: 'Place a piece',
  actMove: 'Move a piece',
  actFly: 'Fly a piece anywhere',
  actChoose: 'Pick a highlighted point',
  actRemove: 'Mill! Remove a {piece} piece',
  actThinking: 'Thinking…',
  winYou: 'You win!',
  winComputer: 'The computer wins',
  winWhite: 'White wins',
  winBlack: 'Black wins',
  draw: 'Draw',
  reasonPieces: '{loser} has fewer than three pieces left.',
  reasonBlocked: '{loser} has no legal move.',
  reasonRepetition: 'The same position came up three times.',
  reasonFifty: '50 moves in a row without a mill.',
  playAgain: 'Play again',
  hintProtected: 'Pieces in a mill are protected. Pick a highlighted one.',
  hintRemove: 'Tap a highlighted piece to remove it.',
  hintStuck: 'That piece has nowhere to go.',
  hintPickOwn: 'Pick one of your pieces first.',
  hintOccupied: 'That point is taken.',
  hintWait: 'Wait for the computer to move.',
  pointEmpty: '{name}, empty',
  pointWhite: '{name}, white piece',
  pointBlack: '{name}, black piece',
  labelTarget: 'possible move',
  labelMovable: 'can move',
  labelSelected: 'selected',
  labelRemovable: 'can be removed',
  keysHelp: 'Keyboard: arrow keys move around the board, Enter or Space picks, Esc cancels, U undoes, N starts a new game.',
  rulesTitle: 'How to play',
  rulesList: [
    'Each player has nine pieces. White starts and the players take turns.',
    'Placing: put one of your pieces on any empty point of the 24.',
    'Moving: once all pieces are placed, slide one of yours along a line to the next empty point.',
    'Flying: a player down to three pieces may move one to any empty point.',
    'A mill is three of your pieces on one line. Every new mill lets you remove an opponent piece, but not one standing in a mill unless all of their pieces are in mills.',
    'You lose with fewer than three pieces or when you cannot move.',
    'The game is drawn when the same position comes up three times, or after 50 moves in a row without a mill in the moving phase.',
  ],
  controlsTitle: 'Controls',
  controlsList: [
    'Tap or click an empty point to place a piece.',
    'To move, tap one of your pieces and then a highlighted point, or drag the piece there.',
    'After a mill, tap one of the highlighted opponent pieces to remove it.',
    'Keyboard: arrow keys, Enter or Space, Esc; U undoes, N starts a new game.',
  ],
  close: 'Close',
  footerSource: 'Source on GitHub',
};

const TR = {
  docTitle: 'Dokuz Taş · Tarayıcıda strateji oyunu',
  title: 'Dokuz Taş',
  newGame: 'Yeni oyun',
  langToggle: 'EN',
  langToggleLabel: 'EN – İngilizceye geç',
  undo: 'Geri al',
  rules: 'Kurallar',
  boardLabel: 'Dokuz Taş tahtası',
  modeLabel: 'Mod',
  modeAi: 'Bilgisayara karşı',
  modeTwo: 'İki oyuncu',
  levelLabel: 'Seviye',
  levelEasy: 'Kolay',
  levelMedium: 'Orta',
  levelHard: 'Zor',
  colorLabel: 'Taşların',
  white: 'Beyaz',
  black: 'Siyah',
  pieceWhite: 'beyaz',
  pieceBlack: 'siyah',
  you: 'Sen',
  computer: 'Bilgisayar',
  inHand: 'Elde',
  onBoard: 'Tahtada',
  phasePlacing: 'Yerleştirme',
  phaseMoving: 'Oynama',
  phaseFlying: 'Uçma',
  phaseOver: 'Oyun bitti',
  actPlace: 'Bir taş koy',
  actMove: 'Bir taş oynat',
  actFly: 'Bir taşı istediğin yere uçur',
  actChoose: 'İşaretli bir nokta seç',
  actRemove: 'Değirmen! Bir {piece} taş al',
  actThinking: 'Düşünüyor…',
  winYou: 'Kazandın!',
  winComputer: 'Bilgisayar kazandı',
  winWhite: 'Beyaz kazandı',
  winBlack: 'Siyah kazandı',
  draw: 'Berabere',
  reasonPieces: '{loser} için üçten az taş kaldı.',
  reasonBlocked: '{loser} hamle yapamıyor.',
  reasonRepetition: 'Aynı konum üç kez oluştu.',
  reasonFifty: 'Üst üste 50 hamle boyunca değirmen kurulmadı.',
  playAgain: 'Tekrar oyna',
  hintProtected: 'Değirmendeki taşlar korunur. İşaretli bir taş seç.',
  hintRemove: 'Almak için işaretli bir taşa dokun.',
  hintStuck: 'Bu taşın gidecek yeri yok.',
  hintPickOwn: 'Önce kendi taşlarından birini seç.',
  hintOccupied: 'Bu nokta dolu.',
  hintWait: 'Bilgisayarın hamlesini bekle.',
  pointEmpty: '{name}, boş',
  pointWhite: '{name}, beyaz taş',
  pointBlack: '{name}, siyah taş',
  labelTarget: 'oynanabilir',
  labelMovable: 'hareket edebilir',
  labelSelected: 'seçili',
  labelRemovable: 'alınabilir',
  keysHelp: 'Klavye: oklarla tahtada gezin, Enter ya da Boşluk ile seç, Esc ile vazgeç, U ile geri al, N ile yeni oyun başlat.',
  rulesTitle: 'Nasıl oynanır',
  rulesList: [
    'Her oyuncunun dokuz taşı vardır. Beyaz başlar, oyuncular sırayla oynar.',
    'Yerleştirme: 24 noktadan boş olan birine bir taşını koy.',
    'Oynama: Bütün taşlar konunca taşlarından birini çizgi boyunca yandaki boş noktaya kaydır.',
    'Uçma: Üç taşı kalan oyuncu bir taşını istediği boş noktaya götürebilir.',
    'Değirmen, aynı çizgi üzerindeki üç taşındır. Her yeni değirmende rakibin bir taşını alırsın; değirmendeki taşlar alınamaz, ancak rakibin bütün taşları değirmendeyse alınabilir.',
    'Taşı üçten aza düşen ya da hamle yapamayan oyuncu kaybeder.',
    'Aynı konum üç kez oluşursa ya da oynama evresinde üst üste 50 hamle boyunca değirmen kurulmazsa oyun berabere biter.',
  ],
  controlsTitle: 'Kontroller',
  controlsList: [
    'Taş koymak için boş bir noktaya dokun ya da tıkla.',
    'Taş oynatmak için önce taşına, sonra işaretli bir noktaya dokun ya da taşı oraya sürükle.',
    'Değirmen kurunca rakibin işaretli taşlarından birine dokunarak onu al.',
    'Klavye: oklar, Enter ya da Boşluk, Esc; U geri alır, N yeni oyun başlatır.',
  ],
  close: 'Kapat',
  footerSource: 'Kaynak kod GitHub’da',
};

/** All strings by language. */
export const STRINGS = Object.freeze({ en: Object.freeze(EN), tr: Object.freeze(TR) });

/**
 * Looks up a string and fills its `{placeholders}`.
 * @param {string} lang 'en' or 'tr'; anything else reads English
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string} the key itself when no such string exists, so a gap shows but never breaks the page
 */
export function translate(lang, key, params = {}) {
  const text = table(lang)[key];
  if (typeof text !== 'string') return key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Looks up a list of strings, such as the rules.
 * @param {string} lang
 * @param {string} key
 * @returns {string[]} a copy; empty when no such list exists
 */
export function translateList(lang, key) {
  const list = table(lang)[key];
  return Array.isArray(list) ? list.slice() : [];
}

/**
 * Turns a stored or requested value into a supported language.
 * @param {unknown} value
 * @returns {'en'|'tr'}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : LANGUAGES[0];
}

/**
 * @param {string} lang
 * @returns {'en'|'tr'} the language the toggle switches to
 */
export function otherLanguage(lang) {
  return normalizeLanguage(lang) === 'en' ? 'tr' : 'en';
}

function table(lang) {
  return STRINGS[normalizeLanguage(lang)];
}
