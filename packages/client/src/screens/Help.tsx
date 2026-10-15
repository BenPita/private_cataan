import { getLang } from '../i18n';

export function HelpContent() {
  return getLang() === 'he' ? <HelpHe /> : <HelpEn />;
}

function HelpHe() {
  return (
    <div className="help">
      <h3>המטרה</h3>
      <p>להיות הראשון שמגיע ל-10 נקודות ניצחון בתור שלו.</p>
      <ul>
        <li>יישוב: נקודה 1 · עיר: 2 נקודות</li>
        <li>הדרך הארוכה (5 דרכים רצופות לפחות): 2 נקודות</li>
        <li>הצבא הגדול (3 אבירים לפחות): 2 נקודות</li>
        <li>קלף נקודת ניצחון: נקודה סודית אחת</li>
      </ul>
      <h3>תחילת המשחק</h3>
      <p>כולם מטילים קוביות — הגבוה ביותר מתחיל, אחריו השני וכן הלאה (בתיקו מטילים שוב).</p>
      <p>
        כל שחקן מניח יישוב ודרך לפי הסדר, ואז שוב בסדר הפוך. היישוב השני נותן קלף אחד מכל שטח שנוגע בו. אף אחד לא מתחיל עם קלפים
        אחרים.
      </p>
      <h3>התור שלך</h3>
      <ol>
        <li>(אפשר לשחק קלף פיתוח לפני ההטלה.)</li>
        <li>מטילים שתי קוביות. כל שטח עם המספר שיצא מייצר — לכל השחקנים: יישוב צמוד מקבל 1, עיר מקבלת 2.</li>
        <li>סוחרים עם שחקנים או עם הבנק (4:1, או 3:1 / 2:1 בנמלים).</li>
        <li>בונים וקונים קלפי פיתוח, ומסיימים את התור.</li>
      </ol>
      <h3>עלויות</h3>
      <ul>
        <li>דרך: עץ + לבנים</li>
        <li>יישוב: עץ + לבנים + צמר + חיטה</li>
        <li>עיר: 2 חיטה + 3 עפרה</li>
        <li>קלף פיתוח: צמר + חיטה + עפרה</li>
      </ul>
      <h3>כשיוצא 7</h3>
      <p>
        אף שטח לא מייצר. מי שמחזיק יותר מ-7 קלפים זורק חצי (מעוגל למטה). אחר כך מי שהטיל מזיז את השודד לשטח אחר — השטח לא מייצר
        כל עוד השודד עליו — וגונב קלף אקראי משחקן שיש לו מבנה ליד השטח.
      </p>
      <h3>כללי בנייה</h3>
      <ul>
        <li>בין כל שני יישובים/ערים חייבות להיות לפחות שתי צלעות.</li>
        <li>דרכים ויישובים חדשים חייבים להתחבר לדרכים שלך.</li>
        <li>אי אפשר להמשיך דרך דרך יישוב של יריב.</li>
        <li>אי אפשר להחליף משאב באותו משאב (למשל 3 עפרה תמורת עפרה).</li>
      </ul>
      <h3>קלפי פיתוח</h3>
      <p>קלף אחד בכל תור, לא בתור שבו נקנה. קלפי נקודת ניצחון נספרים אוטומטית.</p>
      <h3>טיפים</h3>
      <p>צביטה לזום, גרירה להזזה, הקשה כפולה לאיפוס. הקשה על שטח מראה מה הוא.</p>
    </div>
  );
}

function HelpEn() {
  return (
    <div className="help">
      <h3>Goal</h3>
      <p>Be the first to reach 10 victory points on your own turn.</p>
      <ul>
        <li>Settlement: 1 point · City: 2 points</li>
        <li>Longest Road (5+ connected roads): 2 points</li>
        <li>Largest Army (3+ knights): 2 points</li>
        <li>Victory Point card: 1 hidden point</li>
      </ul>
      <h3>Starting the game</h3>
      <p>Everyone rolls the dice — the highest roll starts, then the next highest, and so on (ties roll again).</p>
      <p>
        Each player places a settlement and a road in order, then again in reverse order. Your second settlement gives you one card
        from each neighbouring land. Nobody starts with any other cards.
      </p>
      <h3>Your turn</h3>
      <ol>
        <li>(You may play a development card before rolling.)</li>
        <li>Roll the dice. Every land with that number produces for all players: settlements get 1, cities get 2.</li>
        <li>Trade with players or the bank (4:1, or 3:1 / 2:1 at harbors).</li>
        <li>Build and buy development cards, then end your turn.</li>
      </ol>
      <h3>Costs</h3>
      <ul>
        <li>Road: lumber + brick</li>
        <li>Settlement: lumber + brick + wool + grain</li>
        <li>City: 2 grain + 3 ore</li>
        <li>Development card: wool + grain + ore</li>
      </ul>
      <h3>Rolling a 7</h3>
      <p>
        Nobody produces. Anyone holding more than 7 cards discards half (rounded down). Then the roller moves the robber to a new land —
        it blocks production there — and steals a random card from a player with a building next to it.
      </p>
      <h3>Placement rules</h3>
      <ul>
        <li>Settlements need at least two road-lengths of space from every other building.</li>
        <li>New roads and settlements must connect to your own roads.</li>
        <li>You cannot build a road through an opponent's settlement.</li>
        <li>You cannot trade a resource for the same resource.</li>
      </ul>
      <h3>Development cards</h3>
      <p>Play at most one per turn, never on the turn you bought it. Victory Point cards count automatically.</p>
      <h3>Tips</h3>
      <p>Pinch to zoom, drag to pan, double-tap to reset. Tap a land to see what it is.</p>
    </div>
  );
}
