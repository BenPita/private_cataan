import {
  LOG_EN,
  RESOURCES,
  formatLog,
  type DevCardType,
  type LogItem,
  type ResMap,
  type Resource,
  type Terrain,
} from '@hex/engine';

export type Lang = 'he' | 'en';

const en = {
  appName: "Eden's Island",
  tagline: 'Build, trade and settle the islands with your friends.',
  nickname: 'Your nickname',
  nicknamePlaceholder: 'e.g. Roy',
  createGame: 'Create game',
  joinGame: 'Join game',
  humans: 'Human players',
  bots: 'AI bots',
  difficulty: 'Bot level',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  participants: '{n} participants',
  soloHint: 'Playing solo against bots — you can start right away.',
  victoryTarget: 'Points to win',
  board: 'Board',
  randomBoard: 'Random',
  beginnerBoard: 'Beginner',
  invite: 'Invite link',
  copied: 'Copied!',
  share: 'Share',
  sendWhatsapp: 'Send via WhatsApp',
  whatsappText: "Join my Eden's Island game! {link}",
  lobby: 'Lobby',
  playersTitle: 'Players · first to {n} points',
  ready: 'Ready',
  notReady: 'Not ready',
  imReady: "I'm ready",
  readyWaitHost: 'Ready — waiting for the host',
  start: 'Start game',
  waitingFor: 'Waiting for players…',
  emptySeat: 'Waiting for player…',
  host: 'Host',
  you: 'You',
  botName: 'Bot {n}',
  roll: 'Roll',
  endTurn: 'End turn',
  build: 'Build',
  trade: 'Trade',
  cards: 'Cards',
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
  back: 'Back',
  rematch: 'Rematch',
  home: 'Home',
  rules: 'How to play',
  settings: 'Settings',
  sound: 'Sound effects',
  volume: 'Sound volume',
  language: 'Language',
  rejoin: 'Rejoin link — use it to continue on another phone. Keep it private.',
  copyRejoin: 'Copy rejoin link',
  offline: 'Reconnecting…',
  disconnected: 'offline',
  loading: 'Loading…',
  gameLog: 'Game log',
  invitedBy: "{name} invited you to Eden's Island",
  gameClosed: 'This game is {state}. If you were playing on another phone, open your rejoin link from that phone’s settings.',
  stateFull: 'full',
  stateRunning: 'already running',
  // Turn hints
  hintGameOver: 'Game over',
  hintOrderRoll: 'Rolling for turn order…',
  hintPlacing: '{name} is placing…',
  hintTheirTurn: "{name}'s turn",
  hintWaitDiscards: 'Waiting for players to discard…',
  hintDiscard: 'Discard {n} cards',
  hintPlaceSettlement: 'Tap a spot to place a settlement',
  hintPlaceRoad: 'Place a road next to your settlement',
  hintRoll: 'Your turn — roll the dice',
  hintMoveRobber: 'Move the robber: tap a land',
  hintSteal: 'Choose who to steal from',
  hintFreeRoads: 'Place {n} free road(s)',
  hintBuildMode: 'Tap a highlighted spot',
  hintMain: 'Build, trade, or end your turn',
  hintWaitTrade: 'waiting for {name} to finish the trade',
  // Confirm bar
  confirmSetupSettlement: 'Place settlement here?',
  confirmSetupRoad: 'Place road here?',
  confirmRobber: 'Move the robber to this {terrain}?',
  confirmFreeRoad: 'Place a free road here?',
  confirmRoad: 'Build road for',
  confirmSettlement: 'Build settlement for',
  confirmCity: 'Upgrade to city for',
  cancelBuild: 'Cancel build',
  skipFreeRoads: 'Skip remaining free roads',
  robberHere: 'robber',
  // Build sheet
  road: 'Road',
  settlement: 'Settlement',
  city: 'City',
  devCard: 'Development card',
  left: '{n} left',
  inDeck: '{n} in deck',
  reasonNotTurn: 'Not your turn',
  reasonRollFirst: 'Roll the dice first',
  reasonNotNow: 'Not now',
  reasonNoPieces: 'No pieces left',
  reasonNoSpot: 'No legal spot',
  reasonDeckEmpty: 'Deck is empty',
  reasonNoRes: 'Not enough resources',
  buyDevConfirm: 'Buy a development card for',
  // Trade
  yourOffer: 'Your offer',
  youGive: 'You give',
  youGet: 'You get',
  youWant: 'You want',
  thinking: 'thinking…',
  declinedTag: 'declined',
  acceptDeal: 'Accept deal',
  counterLabel: 'Counter: you give {give} and get {get}',
  acceptCounter: 'Accept counter',
  withdraw: 'Withdraw offer',
  tabPlayers: 'Players',
  tabBank: 'Bank & harbors',
  tradeWhen: 'You can trade during your turn, after rolling.',
  give: 'Give',
  receive: 'Receive',
  chooseRes: 'Choose resources',
  bankTradeBtn: 'Trade {n} {give} → 1 {get}',
  sendTo: 'Send to',
  sendOffer: 'Send offer',
  offerFrom: 'Trade offer from {name}',
  cantAfford: "You don't have the cards they want.",
  decline: 'Decline',
  counter: 'Counter',
  accept: 'Accept',
  sendCounter: 'Send counteroffer',
  nothing: 'nothing',
  // Dev cards
  devCards: 'Development cards',
  noDevCards: 'You have no development cards. Buy one from the Build menu.',
  play: 'Play',
  devAuto: 'Counts automatically',
  devOnTurn: 'Play on your turn',
  devOnePerTurn: 'One card per turn',
  devBoughtNow: 'Bought this turn',
  monopolyPick: 'Choose the resource to collect from every opponent.',
  inventionPick: 'Choose 2 resources ({n}/2).',
  // Robber
  discardTitle: 'Discard {n} cards',
  discardText: 'A 7 was rolled and you hold more than 7 cards. Choose {n} to return to the supply.',
  discardBtn: 'Discard {k}/{n}',
  stealTitle: 'Steal a card from…',
  cardsCount: '{n} cards',
  // Opening roll
  whoFirst: 'Who goes first?',
  orderIntro: 'Everyone rolls — the highest roll starts, then the next highest, and so on.',
  orderTie: 'Tie! The tied players roll again.',
  orderSet: 'Turn order is set:',
  waiting: 'waiting…',
  waitingNames: 'Waiting for {names}…',
  startsGo: "{name} starts — let's go!",
  // Victory
  youWin: 'You win! 🎉',
  theyWin: '{name} wins!',
  pts: '{n} pts',
  vpCards: '({n} VP cards)',
  waitRematch: 'Waiting for the host to start a rematch…',
  // Player chip
  longestRoad: 'Longest Road',
  largestArmy: 'Largest Army',
  vp: 'Victory points',
  resCards: 'Resource cards',
  devCount: 'Development cards',
  knights: 'Knights played',
  // Leaving / closed games
  exitGame: 'Exit game',
  exitTitle: 'Exit this game?',
  exitText: 'The game will close for every player and be deleted. Nobody can come back to it.',
  exitConfirm: 'Exit and close the game',
  closedTitle: 'This game has ended',
  closedLeft: '{name} left, so the game was closed and deleted.',
  closedInactive: 'The game was closed because {name} was away for more than 10 minutes.',
  closedGone: 'This game no longer exists. It may have ended or been closed.',
  newGame: 'Start a new game',
  yourTurn: 'Your turn!',
  boardView: 'Board view',
  view3d: '3D',
  view2d: '2D',
  vibration: 'Vibration',
};

type Dict = typeof en;

const he: Dict = {
  appName: 'האי של עדן',
  tagline: 'בנו, סחרו והתיישבו באיים — עם החברים.',
  nickname: 'הכינוי שלך',
  nicknamePlaceholder: 'למשל: רועי',
  createGame: 'יצירת משחק',
  joinGame: 'הצטרפות למשחק',
  humans: 'שחקנים אנושיים',
  bots: 'בוטים',
  difficulty: 'רמת הבוטים',
  easy: 'קל',
  medium: 'בינוני',
  hard: 'קשה',
  participants: '{n} משתתפים',
  soloHint: 'משחק סולו נגד בוטים — אפשר להתחיל מיד.',
  victoryTarget: 'נקודות לניצחון',
  board: 'לוח',
  randomBoard: 'אקראי',
  beginnerBoard: 'למתחילים',
  invite: 'קישור הזמנה',
  copied: 'הועתק!',
  share: 'שיתוף',
  sendWhatsapp: 'שליחה בוואטסאפ',
  whatsappText: 'בואו לשחק איתי בהאי של עדן! {link}',
  lobby: 'חדר המתנה',
  playersTitle: 'שחקנים · הראשון ל-{n} נקודות',
  ready: 'מוכן/ה',
  notReady: 'עוד לא מוכן/ה',
  imReady: 'אני מוכן/ה',
  readyWaitHost: 'מוכן/ה — מחכים למארח',
  start: 'התחלת משחק',
  waitingFor: 'מחכים לשחקנים…',
  emptySeat: 'מחכים לשחקן…',
  host: 'מארח',
  you: 'את/ה',
  botName: 'בוט {n}',
  roll: 'הטלה',
  endTurn: 'סיום תור',
  build: 'בנייה',
  trade: 'מסחר',
  cards: 'קלפים',
  cancel: 'ביטול',
  confirm: 'אישור',
  close: 'סגירה',
  back: 'חזרה',
  rematch: 'משחק חוזר',
  home: 'מסך הבית',
  rules: 'איך משחקים',
  settings: 'הגדרות',
  sound: 'צלילים',
  volume: 'עוצמת קול',
  language: 'שפה',
  rejoin: 'קישור חזרה — להמשך המשחק מטלפון אחר. לא לשתף.',
  copyRejoin: 'העתקת קישור חזרה',
  offline: 'מתחבר מחדש…',
  disconnected: 'מנותק',
  loading: 'טוען…',
  gameLog: 'יומן המשחק',
  invitedBy: '{name} מזמין/ה אותך לשחק בהאי של עדן',
  gameClosed: 'המשחק הזה {state}. אם שיחקת מטלפון אחר, פתח/י את קישור החזרה מתפריט ההגדרות שם.',
  stateFull: 'מלא',
  stateRunning: 'כבר התחיל',
  hintGameOver: 'המשחק נגמר',
  hintOrderRoll: 'מטילים כדי לקבוע סדר…',
  hintPlacing: '{name} מציב/ה…',
  hintTheirTurn: 'התור של {name}',
  hintWaitDiscards: 'מחכים שכולם יזרקו קלפים…',
  hintDiscard: 'יש לזרוק {n} קלפים',
  hintPlaceSettlement: 'הקש/י על נקודה להנחת יישוב',
  hintPlaceRoad: 'הנח/י דרך ליד היישוב',
  hintRoll: 'תורך — הטל/י את הקוביות',
  hintMoveRobber: 'הזז/י את השודד: הקש/י על שטח',
  hintSteal: 'בחר/י ממי לגנוב',
  hintFreeRoads: 'הנח/י {n} דרכים בחינם',
  hintBuildMode: 'הקש/י על מקום מסומן',
  hintMain: 'בנייה, מסחר, או סיום תור',
  hintWaitTrade: 'מחכים ש{name} יסיים/תסיים את העסקה',
  confirmSetupSettlement: 'להניח כאן יישוב?',
  confirmSetupRoad: 'להניח כאן דרך?',
  confirmRobber: 'להזיז את השודד ל{terrain}?',
  confirmFreeRoad: 'להניח כאן דרך בחינם?',
  confirmRoad: 'לבנות דרך תמורת',
  confirmSettlement: 'לבנות יישוב תמורת',
  confirmCity: 'לשדרג לעיר תמורת',
  cancelBuild: 'ביטול בנייה',
  skipFreeRoads: 'דילוג על הדרכים שנשארו',
  robberHere: 'שודד',
  road: 'דרך',
  settlement: 'יישוב',
  city: 'עיר',
  devCard: 'קלף פיתוח',
  left: 'נשארו {n}',
  inDeck: '{n} בחפיסה',
  reasonNotTurn: 'לא התור שלך',
  reasonRollFirst: 'קודם מטילים קוביות',
  reasonNotNow: 'לא עכשיו',
  reasonNoPieces: 'לא נשארו חלקים',
  reasonNoSpot: 'אין מקום חוקי',
  reasonDeckEmpty: 'החפיסה ריקה',
  reasonNoRes: 'אין מספיק משאבים',
  buyDevConfirm: 'לקנות קלף פיתוח תמורת',
  yourOffer: 'ההצעה שלך',
  youGive: 'נותנים',
  youGet: 'מקבלים',
  youWant: 'רוצים',
  thinking: 'חושב/ת…',
  declinedTag: 'סירב/ה',
  acceptDeal: 'סגירת עסקה',
  counterLabel: 'הצעה נגדית: נותנים {give} ומקבלים {get}',
  acceptCounter: 'קבלת ההצעה הנגדית',
  withdraw: 'ביטול ההצעה',
  tabPlayers: 'שחקנים',
  tabBank: 'בנק ונמלים',
  tradeWhen: 'אפשר לסחור בתורך, אחרי ההטלה.',
  give: 'נותנים',
  receive: 'מקבלים',
  chooseRes: 'בחר/י משאבים',
  bankTradeBtn: 'החלפה: {n} {give} ← 1 {get}',
  sendTo: 'לשלוח אל',
  sendOffer: 'שליחת הצעה',
  offerFrom: 'הצעת מסחר מ{name}',
  cantAfford: 'אין לך את הקלפים שביקשו.',
  decline: 'סירוב',
  counter: 'הצעה נגדית',
  accept: 'קבלה',
  sendCounter: 'שליחת הצעה נגדית',
  nothing: 'כלום',
  devCards: 'קלפי פיתוח',
  noDevCards: 'אין לך קלפי פיתוח. אפשר לקנות בתפריט הבנייה.',
  play: 'שימוש',
  devAuto: 'נספר אוטומטית',
  devOnTurn: 'משתמשים בתורך',
  devOnePerTurn: 'קלף אחד בכל תור',
  devBoughtNow: 'נקנה בתור הזה',
  monopolyPick: 'בחר/י משאב — כל היריבים יתנו לך את כל הקלפים שלהם מסוג זה.',
  inventionPick: 'בחר/י 2 משאבים ({n}/2).',
  discardTitle: 'יש לזרוק {n} קלפים',
  discardText: 'יצא 7 ויש לך יותר מ-7 קלפים. בחר/י {n} קלפים להחזיר לבנק.',
  discardBtn: 'זריקה {k}/{n}',
  stealTitle: 'לגנוב קלף מ…',
  cardsCount: '{n} קלפים',
  whoFirst: 'מי מתחיל?',
  orderIntro: 'כולם מטילים — הגבוה ביותר מתחיל, אחריו השני, וכן הלאה.',
  orderTie: 'תיקו! השחקנים בתיקו מטילים שוב.',
  orderSet: 'סדר התורות נקבע:',
  waiting: 'מחכים…',
  waitingNames: 'מחכים ל{names}…',
  startsGo: '{name} מתחיל/ה — יאללה!',
  youWin: 'ניצחת! 🎉',
  theyWin: '{name} ניצח/ה!',
  pts: '{n} נק׳',
  vpCards: '({n} קלפי נקודה)',
  waitRematch: 'מחכים שהמארח יתחיל משחק חוזר…',
  longestRoad: 'הדרך הארוכה',
  largestArmy: 'הצבא הגדול',
  vp: 'נקודות ניצחון',
  resCards: 'קלפי משאבים',
  devCount: 'קלפי פיתוח',
  knights: 'אבירים ששוחקו',
  exitGame: 'יציאה מהמשחק',
  exitTitle: 'לצאת מהמשחק?',
  exitText: 'המשחק ייסגר לכל המשתתפים ויימחק. אי אפשר יהיה לחזור אליו.',
  exitConfirm: 'יציאה וסגירת המשחק',
  closedTitle: 'המשחק הסתיים',
  closedLeft: '{name} יצא/ה מהמשחק, ולכן המשחק נסגר ונמחק.',
  closedInactive: 'המשחק נסגר כי {name} לא היה/תה במשחק יותר מ-10 דקות.',
  closedGone: 'המשחק הזה כבר לא קיים — הוא הסתיים או נסגר.',
  newGame: 'משחק חדש',
  yourTurn: 'תורך!',
  boardView: 'תצוגת לוח',
  view3d: 'תלת-ממד',
  view2d: 'דו-ממד',
  vibration: 'רטט',
};

export type Key = keyof Dict;
const dicts: Record<Lang, Dict> = { en, he };

function readLang(): Lang {
  try {
    const v = localStorage.getItem('hex-lang');
    return v === 'en' ? 'en' : 'he';
  } catch {
    return 'he';
  }
}

let lang: Lang = readLang();

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang) {
  lang = next;
  try {
    localStorage.setItem('hex-lang', next);
  } catch {
    /* ignore */
  }
  applyDocumentLang();
}

export function applyDocumentLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
}

export function t(key: Key, params: Record<string, string | number> = {}): string {
  const template = dicts[lang][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''));
}

// --- Game vocabulary ---------------------------------------------------------

const RESOURCE_NAMES: Record<Lang, Record<Resource, string>> = {
  en: { lumber: 'Lumber', brick: 'Brick', wool: 'Wool', grain: 'Grain', ore: 'Ore' },
  he: { lumber: 'עץ', brick: 'לבנים', wool: 'צמר', grain: 'חיטה', ore: 'עפרה' },
};

const TERRAIN_NAMES: Record<Lang, Record<Terrain, string>> = {
  en: { forest: 'Forest', hills: 'Hills', pasture: 'Pasture', fields: 'Fields', mountains: 'Mountains', desert: 'Desert' },
  he: { forest: 'יער', hills: 'גבעות', pasture: 'מרעה', fields: 'שדות', mountains: 'הרים', desert: 'מדבר' },
};

const DEV: Record<Lang, Record<DevCardType, { name: string; text: string }>> = {
  en: {
    knight: { name: 'Knight', text: 'Move the robber to a new land and steal 1 random card from a player there. Counts toward Largest Army.' },
    victoryPoint: { name: 'Victory Point', text: 'Worth 1 hidden victory point. Revealed when you win.' },
    roadBuilding: { name: 'Road Building', text: 'Build 2 roads at no cost.' },
    yearOfPlenty: { name: 'Invention', text: 'Take any 2 resource cards from the supply.' },
    monopoly: { name: 'Monopoly', text: 'Name a resource. Every player gives you all their cards of that type.' },
  },
  he: {
    knight: { name: 'אביר', text: 'הזז/י את השודד לשטח חדש וגנוב/י קלף אקראי משחקן שם. נספר לצבא הגדול.' },
    victoryPoint: { name: 'נקודת ניצחון', text: 'שווה נקודת ניצחון סודית אחת. נחשף בניצחון.' },
    roadBuilding: { name: 'בניית דרכים', text: 'בנה/י 2 דרכים בחינם.' },
    yearOfPlenty: { name: 'המצאה', text: 'קח/י 2 קלפי משאבים כלשהם מהבנק.' },
    monopoly: { name: 'מונופול', text: 'הכרז/י על משאב. כל השחקנים נותנים לך את כל הקלפים שלהם מסוג זה.' },
  },
};

export const resourceName = (r: Resource) => RESOURCE_NAMES[lang][r];
export const terrainName = (tr: Terrain) => TERRAIN_NAMES[lang][tr];
export const devInfo = (d: DevCardType) => DEV[lang][d];
export const difficultyName = (d: 'easy' | 'medium' | 'hard') => t(d);

export function resourcesText(res: Partial<ResMap>): string {
  const parts = RESOURCES.filter((k) => (res[k] ?? 0) > 0).map((k) => `${res[k]} ${resourceName(k)}`);
  return parts.length ? parts.join(', ') : t('nothing');
}

/** Display name for a seat: bots get a translated, numbered name. */
export function displayName(name: string | null | undefined, kind?: 'human' | 'bot'): string {
  if (kind === 'bot' && name) {
    const m = name.match(/^Bot (\d+)$/);
    if (m) return t('botName', { n: m[1] });
  }
  return name ?? '';
}

// --- Log -----------------------------------------------------------------

const LOG_HE: Record<keyof typeof LOG_EN, string> = {
  start: 'כולם מטילים קוביות — הגבוה ביותר מתחיל.',
  orderRolled: '{p} הטיל/ה {n} לקביעת הסדר.',
  orderTie: '{players} בתיקו — מטילים שוב.',
  orderDone: 'סדר התורות: {order}. {p} מציב/ה ראשון/ה.',
  setupSettlement: '{p} הניח/ה יישוב.',
  setupSettlementRes: '{p} הניח/ה יישוב וקיבל/ה {res}.',
  setupDone: 'ההצבה הסתיימה. המשחק מתחיל!',
  rolled: '{p} הטיל/ה {n}.',
  received: '{p} קיבל/ה {res}.',
  discarded: '{p} זרק/ה {n} קלפים.',
  robberMoved: '{p} הזיז/ה את השודד.',
  steal: '{p} גנב/ה קלף מ{q}.',
  stealSecret: '{p} גנב/ה {r} אחד מ{q}.',
  stealNothing: 'ל{q} לא היה מה לגנוב.',
  builtRoad: '{p} בנה/תה דרך.',
  builtSettlement: '{p} בנה/תה יישוב.',
  builtCity: '{p} שדרג/ה יישוב לעיר.',
  boughtDev: '{p} קנה/תה קלף פיתוח.',
  playedKnight: '{p} שיחק/ה אביר.',
  playedRoadBuilding: '{p} שיחק/ה בניית דרכים.',
  placedFreeRoad: '{p} הניח/ה דרך בחינם.',
  playedYearOfPlenty: '{p} שיחק/ה המצאה ולקח/ה {res}.',
  playedMonopoly: '{p} שיחק/ה מונופול על {r} ולקח/ה {n}.',
  bankTrade: '{p} החליף/ה {n} {r} בבנק תמורת {r2} אחד.',
  offer: '{p} מציע/ה {give} תמורת {get}.',
  declined: '{p} סירב/ה לעסקה.',
  accepts: '{p} מסכים/ה לעסקה.',
  counters: '{p} מציע/ה בחזרה: {give} תמורת {get}.',
  withdrew: '{p} ביטל/ה את ההצעה.',
  traded: '{p} נתן/ה {give} ל{q} תמורת {get}.',
  longestRoad: '{p} לוקח/ת את הדרך הארוכה ({n}).',
  longestRoadLost: 'אף אחד לא מחזיק כרגע בדרך הארוכה.',
  largestArmy: '{p} לוקח/ת את הצבא הגדול ({n}).',
  win: '{p} ניצח/ה עם {n} נקודות!',
};

export function logText(item: LogItem, names: string[]): string {
  if (!item.key) return item.msg ?? '';
  const template = lang === 'he' ? LOG_HE[item.key] : LOG_EN[item.key];
  return formatLog(template, item.params ?? {}, {
    name: (p) => names[p] ?? '?',
    resource: resourceName,
    resources: resourcesText,
    and: (items) => (lang === 'he' ? items.join(' ו') : items.join(' and ')),
  }).replace(/ → /g, lang === 'he' ? ' ← ' : ' → ');
}

// --- Errors from the server/engine ----------------------------------------

const ERRORS_HE: Record<string, string> = {
  'It is not your turn': 'זה לא התור שלך',
  'Finish placing your free roads first': 'קודם צריך להניח את הדרכים החינמיות',
  'Unknown edge': 'מקום לא קיים',
  'That edge already has a road': 'כבר יש כאן דרך',
  'No roads left': 'לא נשארו דרכים',
  'Road must connect to your network': 'הדרך חייבת להתחבר לרשת שלך',
  'You already played a development card this turn': 'כבר שיחקת קלף פיתוח בתור הזה',
  'Cards cannot be played on the turn they were bought': 'אי אפשר לשחק קלף בתור שבו נקנה',
  'You do not have that card': 'אין לך את הקלף הזה',
  'Invalid trade': 'עסקה לא תקינה',
  'Both sides of a trade must include at least one card': 'כל צד בעסקה חייב לתת לפחות קלף אחד',
  'You cannot trade a resource for the same resource': 'אי אפשר להחליף משאב באותו משאב',
  'Invalid action': 'פעולה לא תקינה',
  'Unknown player': 'שחקן לא ידוע',
  'The game is over': 'המשחק נגמר',
  'You do not need to roll now': 'לא צריך להטיל עכשיו',
  'You already rolled': 'כבר הטלת',
  'Place your road first': 'קודם מניחים דרך',
  'Settlement must be on an empty spot at least two roads from others': 'יישוב חייב להיות במקום פנוי, לפחות שתי דרכים מיישובים אחרים',
  'Place your settlement first': 'קודם מניחים יישוב',
  'The road must touch the settlement you just placed': 'הדרך חייבת לגעת ביישוב שהנחת עכשיו',
  'You do not need to discard': 'לא צריך לזרוק קלפים',
  'Invalid discard': 'זריקה לא תקינה',
  'You do not have those cards': 'אין לך את הקלפים האלה',
  'Unknown hex': 'שטח לא קיים',
  'The robber must move to a different hex': 'השודד חייב לזוז לשטח אחר',
  'You cannot steal from that player': 'אי אפשר לגנוב מהשחקן הזה',
  'Not enough resources for a road': 'אין מספיק משאבים לדרך',
  'No settlements left': 'לא נשארו יישובים',
  'Unknown spot': 'מקום לא קיים',
  'Settlement must connect to one of your roads': 'היישוב חייב להתחבר לאחת הדרכים שלך',
  'A city must replace one of your settlements': 'עיר חייבת להחליף יישוב שלך',
  'No cities left': 'לא נשארו ערים',
  'The development deck is empty': 'חפיסת הפיתוח ריקה',
  'You have no free roads to place': 'אין לך דרכים חינמיות להניח',
  'You are not placing free roads': 'את/ה לא מניח/ה דרכים חינמיות',
  'Choose two resources': 'בחר/י שני משאבים',
  'The bank does not have those resources': 'אין לבנק את המשאבים האלה',
  'Choose a resource': 'בחר/י משאב',
  'Choose resources': 'בחר/י משאבים',
  'Choose two different resources': 'בחר/י שני משאבים שונים',
  'You do not have the resources you are offering': 'אין לך את המשאבים שהצעת',
  'Choose who to trade with': 'בחר/י עם מי לסחור',
  'That trade offer is no longer available': 'ההצעה כבר לא זמינה',
  'That offer was not sent to you': 'ההצעה לא נשלחה אליך',
  'Invalid response': 'תשובה לא תקינה',
  'You do not have the requested resources': 'אין לך את המשאבים שביקשו',
  'That player has not accepted the trade': 'השחקן עוד לא הסכים לעסקה',
  'There is no trade to cancel': 'אין עסקה לבטל',
  'Unknown action': 'פעולה לא ידועה',
  'Game not found': 'המשחק לא נמצא',
  'This game is full': 'המשחק מלא',
  'This game has already started': 'המשחק כבר התחיל',
  'Enter a nickname': 'יש להזין כינוי',
  'The game has already started': 'המשחק כבר התחיל',
  'Only the host can change settings': 'רק המארח יכול לשנות הגדרות',
  'Settings are locked once the game starts': 'אי אפשר לשנות הגדרות אחרי שהמשחק התחיל',
  'Players already joined those seats': 'שחקנים כבר הצטרפו למקומות האלה',
  'Only the host can start the game': 'רק המארח יכול להתחיל את המשחק',
  'Waiting for all players to join and be ready': 'מחכים שכל השחקנים יצטרפו ויהיו מוכנים',
  'Only the host can start a rematch': 'רק המארח יכול להתחיל משחק חוזר',
  'The game is not finished': 'המשחק עוד לא נגמר',
  'Missing request id': 'בקשה לא תקינה',
  'The game is not running': 'המשחק לא פעיל',
  'Your game was out of date — please try again': 'המשחק התעדכן בינתיים — נסה/י שוב',
  'Not a player in this game': 'את/ה לא שחקן/ית במשחק הזה',
  'Not in a game': 'את/ה לא במשחק',
  'Server error': 'שגיאת שרת',
  'No response from server': 'אין תשובה מהשרת',
  'Humans must be 1-4': 'מספר השחקנים חייב להיות 1–4',
  'Bots must be 0-3': 'מספר הבוטים חייב להיות 0–3',
  'A game needs 2-4 participants': 'משחק צריך 2–4 משתתפים',
  'Invalid difficulty': 'רמה לא תקינה',
  'Target must be 10 or 12': 'היעד חייב להיות 10 או 12',
  'Invalid board type': 'סוג לוח לא תקין',
};

export function errorText(msg: string): string {
  if (lang === 'en') return msg;
  if (ERRORS_HE[msg]) return ERRORS_HE[msg];
  let m = msg.match(/^You must discard exactly (\d+) cards$/);
  if (m) return `יש לזרוק בדיוק ${m[1]} קלפים`;
  m = msg.match(/^Not enough resources for (.+)$/);
  if (m) return 'אין מספיק משאבים';
  m = msg.match(/^Not allowed during (\w+)$/);
  if (m) return 'אי אפשר לעשות את זה עכשיו';
  m = msg.match(/^(.+) no longer has those resources$/);
  if (m) return `ל${m[1]} כבר אין את המשאבים האלה`;
  m = msg.match(/^The bank has no (\w+) left$/);
  if (m) return `לבנק נגמר ה${resourceName(m[1] as Resource)}`;
  return msg;
}
