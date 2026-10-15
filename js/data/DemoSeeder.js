import { DhakaDate } from '../core/DhakaDate.js';
import { HishabCalculator } from '../domain/HishabCalculator.js';
import { MealEntry, DEFAULT_CUTOFFS, DEFAULT_WEIGHTS } from '../domain/MealEntry.js';
import { RetentionPolicy } from '../domain/RetentionPolicy.js';
import { FUND_ID } from '../domain/SettlementStrategy.js';

export const DEMO_MESS_ID = 'm_demo_greenhouse';
export const DEMO_UID = 'u_demo';

const MEMBERS = [
  { uid: DEMO_UID, displayName: 'Adnan Hossain', role: 'manager' },
  { uid: 'u_rafi', displayName: 'Rafi Ahmed', role: 'member' },
  { uid: 'u_sakib', displayName: 'Sakib Hasan', role: 'member' },
  { uid: 'u_tanvir', displayName: 'Tanvir Islam', role: 'member' },
  { uid: 'u_arif', displayName: 'Arif Chowdhury', role: 'member' },
  { uid: 'u_naim', displayName: 'Naim Rahman', role: 'member' },
  { uid: 'u_fahim', displayName: 'Fahim Uddin', role: 'member' },
  { uid: 'u_sajib', displayName: 'Sajib Karim', role: 'member' }
];

const BAZAR_NOTES = ['Rice, dal, oil', 'Fish & vegetables', 'Chicken, onion, potato', 'Eggs, bread, tea', 'Beef & spices', 'Vegetables, lentils', 'Gas cylinder top-up'];

/** Builds a realistic half-month of mess data plus a closed previous month, relative to today. */
export class DemoSeeder {
  constructor(now = new Date()) {
    this.now = now;
    this.rand = mulberry32(20261015);
    this.today = DhakaDate.dateKey(now);
    this.currentMonth = DhakaDate.monthKey(now);
    this.prevMonth = DhakaDate.prevMonthKey(this.currentMonth);
  }

  build() {
    const createdAt = new Date(this.now.getTime() - 120 * DhakaDate.DAY_MS).toISOString();
    const members = Object.fromEntries(
      MEMBERS.map((m) => [m.uid, { ...m, active: true, joinedAt: createdAt }])
    );
    const mess = {
      id: DEMO_MESS_ID,
      name: 'Green House Mess, Mohammadpur',
      inviteCode: 'GH7K2P',
      managerUid: DEMO_UID,
      memberUids: MEMBERS.map((m) => m.uid),
      currentMonth: this.currentMonth,
      mealCutoffs: { ...DEFAULT_CUTOFFS },
      mealWeights: { ...DEFAULT_WEIGHTS },
      retentionDays: 30,
      createdAt
    };

    const prevDays = DhakaDate.daysInMonth(this.prevMonth);
    const todayDay = Number(this.today.slice(8, 10));
    const prev = this.monthData(this.prevMonth, prevDays, prevDays);
    const curr = this.monthData(this.currentMonth, todayDay, DhakaDate.daysInMonth(this.currentMonth));

    // Close the previous month on the 1st of this month, 10 AM Dhaka.
    const closedAt = new Date(`${this.currentMonth}-01T04:00:00Z`);
    const expireAt = new RetentionPolicy(30).expireAt(closedAt).toISOString();
    const prevCalc = this.calculator(prev, Object.values(members));
    const settlement = prevCalc.settle(undefined, DEMO_UID);
    const results = {};
    for (const s of prevCalc.summaries()) {
      const id = `${this.prevMonth}_${s.uid}`;
      results[id] = {
        id,
        ...s.toJSON(),
        monthId: this.prevMonth,
        settlementLines: settlement.filter((t) => t.from === s.uid || t.to === s.uid),
        closedAt: closedAt.toISOString(),
        expireAt
      };
    }
    for (const group of ['meals', 'bazar', 'fixedCosts', 'deposits']) {
      for (const doc of Object.values(prev[group])) doc.expireAt = expireAt;
    }

    const months = {
      [this.prevMonth]: {
        info: {
          id: this.prevMonth,
          status: 'closed',
          managerUid: DEMO_UID,
          closedAt: closedAt.toISOString(),
          expireAt,
          settlement,
          stats: statsOf(prevCalc)
        },
        ...prev
      },
      [this.currentMonth]: { info: { id: this.currentMonth, status: 'open', managerUid: DEMO_UID }, ...curr }
    };

    const snapshots = this.snapshots({ [this.prevMonth]: prev, [this.currentMonth]: curr }, Object.values(members));

    return {
      users: {
        [DEMO_UID]: {
          displayName: 'Adnan Hossain',
          email: 'demo@messhishab.app',
          photoURL: null,
          locale: null,
          theme: null,
          messIds: [DEMO_MESS_ID],
          createdAt
        }
      },
      inviteCodes: { [mess.inviteCode]: { messId: DEMO_MESS_ID } },
      messes: { [DEMO_MESS_ID]: { mess, members, months, snapshots, results } }
    };
  }

  monthData(monthId, lastDay, daysInMonth) {
    const meals = {};
    const bazar = {};
    const deposits = {};
    const isCurrent = monthId === this.currentMonth;

    for (let day = 1; day <= lastDay; day += 1) {
      const date = `${monthId}-${String(day).padStart(2, '0')}`;
      for (const m of MEMBERS) {
        // Leave today's meals for the demo user to tap.
        if (isCurrent && date === this.today && m.uid === DEMO_UID) continue;
        const entry = new MealEntry({
          memberUid: m.uid,
          date,
          breakfast: this.rand() < 0.7,
          lunch: this.rand() < 0.85,
          dinner: this.rand() < 0.92,
          guests: this.rand() < 0.04 ? 1 : 0
        });
        if (entry.count() > 0) meals[entry.id] = { ...entry.toJSON(), updatedAt: `${date}T03:00:00Z` };
      }
      if (day % 2 === 1 || day === lastDay) {
        const shopper = MEMBERS[(day + monthId.charCodeAt(6)) % MEMBERS.length];
        const id = `b_${monthId}_${day}`;
        bazar[id] = {
          id,
          shopperUid: shopper.uid,
          amount: Math.round((900 + this.rand() * 1400) / 10) * 10,
          source: this.rand() < 0.75 ? 'fund' : 'pocket',
          note: BAZAR_NOTES[day % BAZAR_NOTES.length],
          date,
          createdBy: DEMO_UID,
          createdAt: `${date}T12:00:00Z`
        };
      }
    }

    const fixedCosts = {
      [`f_${monthId}_bua`]: { id: `f_${monthId}_bua`, label: 'Bua (cook)', amount: 4000 },
      [`f_${monthId}_gas`]: { id: `f_${monthId}_gas`, label: 'Gas', amount: 1080 },
      [`f_${monthId}_wifi`]: { id: `f_${monthId}_wifi`, label: 'Wi-Fi', amount: 1200 },
      [`f_${monthId}_current`]: { id: `f_${monthId}_current`, label: 'Electricity', amount: 1650 }
    };

    MEMBERS.forEach((m, i) => {
      const id = `d_${monthId}_${m.uid}`;
      const amount = [3000, 2500, 3000, 2000, 3500, 2500, 3000, 2000][i];
      const method = ['bkash', 'nagad', 'bkash', 'cash', 'bkash', 'nagad', 'cash', 'bkash'][i];
      const pending = isCurrent && (m.uid === 'u_sakib' || m.uid === 'u_naim');
      deposits[id] = {
        id,
        memberUid: m.uid,
        amount: isCurrent && m.uid === 'u_tanvir' ? 1500 : amount,
        method,
        trxId: method === 'cash' ? '' : `9K${(i + 3) * 7}F${monthId.slice(5)}X${i}`,
        status: pending ? 'pending' : 'confirmed',
        confirmedBy: pending ? null : DEMO_UID,
        createdAt: `${monthId}-0${(i % 5) + 1}T10:${10 + i}:00Z`
      };
    });
    // A late second deposit in last month keeps the numbers believable.
    if (!isCurrent) {
      for (const m of MEMBERS.slice(0, 4)) {
        const id = `d_${monthId}_${m.uid}_2`;
        deposits[id] = {
          id,
          memberUid: m.uid,
          amount: 1500,
          method: 'bkash',
          trxId: `7Q${m.uid.length}L${monthId.slice(5)}Z`,
          status: 'confirmed',
          confirmedBy: DEMO_UID,
          createdAt: `${monthId}-18T09:00:00Z`
        };
      }
    }

    return { meals, bazar, fixedCosts, deposits };
  }

  calculator(data, members, upToDate = null) {
    const keep = (d) => !upToDate || d.date <= upToDate;
    const keepCreated = (d) => !upToDate || String(d.createdAt).slice(0, 10) <= upToDate;
    return new HishabCalculator({
      members,
      meals: Object.values(data.meals).filter(keep),
      bazar: Object.values(data.bazar).filter(keep),
      fixedCosts: Object.values(data.fixedCosts),
      deposits: Object.values(data.deposits).filter(keepCreated)
    });
  }

  /** 30 days of daily snapshots for the demo user, computed from the data itself. */
  snapshots(monthsData, members) {
    const out = {};
    for (let i = 29; i >= 0; i -= 1) {
      const date = DhakaDate.addDays(this.today, -i);
      const monthId = date.slice(0, 7);
      const data = monthsData[monthId];
      if (!data) continue;
      const s = this.calculator(data, members, date).summaryFor(DEMO_UID);
      const id = `${DEMO_UID}_${date}`;
      const createdAt = new Date(`${date}T14:00:00Z`);
      out[id] = {
        id,
        uid: DEMO_UID,
        date,
        monthId,
        meals: s.meals,
        mealRate: s.mealRate,
        mealCost: s.mealCost,
        fixedShare: s.fixedShare,
        paid: s.paid,
        balance: s.balance,
        createdAt: createdAt.toISOString(),
        expireAt: new RetentionPolicy(30).expireAt(createdAt).toISOString()
      };
    }
    return out;
  }
}

export function statsOf(calc) {
  return {
    mealRate: Math.round(calc.mealRate * 100) / 100,
    totalMeals: calc.totalMeals(),
    totalBazar: calc.totalBazar(),
    totalFixed: calc.totalFixed(),
    fundCash: Math.round(calc.fundCash())
  };
}

export { FUND_ID };

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
