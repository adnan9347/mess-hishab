import { Repository, RepoError } from './Repository.js';
import { FIREBASE_SDK_VERSION } from '../config.js';
import { inviteCode } from '../core/util.js';
import { DhakaDate } from '../core/DhakaDate.js';
import { MealEntry, DEFAULT_CUTOFFS, DEFAULT_WEIGHTS } from '../domain/MealEntry.js';
import { RetentionPolicy } from '../domain/RetentionPolicy.js';

const SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
const BATCH_LIMIT = 400;

/**
 * Cloud Firestore repository (free Spark plan: no Cloud Functions needed).
 * Offline support comes from Firestore's persistent local cache.
 */
export class FirestoreRepository extends Repository {
  static async create(firebaseApp) {
    const fs = await import(`${SDK}/firebase-firestore.js`);
    let db;
    try {
      db = fs.initializeFirestore(firebaseApp, {
        localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
      });
    } catch {
      db = fs.getFirestore(firebaseApp);
    }
    return new FirestoreRepository(fs, db);
  }

  constructor(fs, db) {
    super();
    this.fs = fs;
    this.db = db;
  }

  // ---------- helpers ----------

  ref(...path) {
    return this.fs.doc(this.db, ...path);
  }

  col(...path) {
    return this.fs.collection(this.db, ...path);
  }

  monthPath(messId, monthId) {
    return ['messes', messId, 'months', monthId];
  }

  docs(snap) {
    return snap.docs.map((d) => fromFirestore({ id: d.id, ...d.data() }));
  }

  async commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = this.fs.writeBatch(this.db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch);
      await batch.commit();
    }
  }

  // ---------- profiles ----------

  async getProfile(uid) {
    const snap = await this.fs.getDoc(this.ref('users', uid));
    return snap.exists() ? fromFirestore(snap.data()) : null;
  }

  async saveProfile(uid, data) {
    const existing = await this.fs.getDoc(this.ref('users', uid));
    const base = existing.exists() ? {} : { createdAt: this.fs.serverTimestamp(), messIds: [] };
    await this.fs.setDoc(this.ref('users', uid), { ...base, ...data }, { merge: true });
  }

  // ---------- membership ----------

  async createMess(uid, { name, displayName }) {
    const { fs } = this;
    const messRef = fs.doc(this.col('messes'));
    let code = inviteCode();
    for (let i = 0; i < 5 && (await fs.getDoc(this.ref('inviteCodes', code))).exists(); i += 1) code = inviteCode();
    const monthId = DhakaDate.monthKey();
    const batch = fs.writeBatch(this.db);
    batch.set(messRef, {
      name,
      inviteCode: code,
      managerUid: uid,
      memberUids: [uid],
      currentMonth: monthId,
      mealCutoffs: { ...DEFAULT_CUTOFFS },
      mealWeights: { ...DEFAULT_WEIGHTS },
      retentionDays: RetentionPolicy.MIN_DAYS,
      createdAt: fs.serverTimestamp()
    });
    batch.set(this.ref('inviteCodes', code), { messId: messRef.id, createdBy: uid });
    batch.set(this.ref('messes', messRef.id, 'members', uid), {
      displayName,
      role: 'manager',
      active: true,
      joinedAt: fs.serverTimestamp()
    });
    batch.set(this.ref(...this.monthPath(messRef.id, monthId)), { status: 'open', managerUid: uid });
    batch.set(this.ref('users', uid), { messIds: fs.arrayUnion(messRef.id) }, { merge: true });
    await batch.commit();
    return messRef.id;
  }

  async joinMess(uid, code, displayName) {
    const { fs } = this;
    const normalized = String(code).toUpperCase();
    const codeSnap = await fs.getDoc(this.ref('inviteCodes', normalized));
    if (!codeSnap.exists()) throw new RepoError('invalid-code');
    const { messId } = codeSnap.data();
    // Security rules check that inviteCode on the member doc matches the mess.
    const batch = fs.writeBatch(this.db);
    batch.set(this.ref('messes', messId, 'members', uid), {
      displayName,
      role: 'member',
      active: true,
      inviteCode: normalized,
      joinedAt: fs.serverTimestamp()
    });
    batch.update(this.ref('messes', messId), { memberUids: fs.arrayUnion(uid) });
    batch.set(this.ref('users', uid), { messIds: fs.arrayUnion(messId) }, { merge: true });
    await batch.commit();
    return messId;
  }

  async updateMess(messId, data) {
    if ('retentionDays' in data) new RetentionPolicy(data.retentionDays);
    await this.fs.updateDoc(this.ref('messes', messId), data);
  }

  async updateMember(messId, uid, data) {
    await this.fs.updateDoc(this.ref('messes', messId, 'members', uid), data);
  }

  async handoverManager(messId, newUid) {
    const { fs } = this;
    const messSnap = await fs.getDoc(this.ref('messes', messId));
    const { managerUid, currentMonth } = messSnap.data();
    const batch = fs.writeBatch(this.db);
    batch.update(this.ref('messes', messId, 'members', managerUid), { role: 'member' });
    batch.update(this.ref('messes', messId, 'members', newUid), { role: 'manager' });
    batch.update(this.ref(...this.monthPath(messId, currentMonth)), { managerUid: newUid });
    batch.update(this.ref('messes', messId), { managerUid: newUid });
    await batch.commit();
  }

  async leaveMess(messId, uid) {
    const { fs } = this;
    const messSnap = await fs.getDoc(this.ref('messes', messId));
    const mess = messSnap.data();
    if (mess.managerUid === uid && mess.memberUids.length > 1) throw new RepoError('manager-must-handover');
    const batch = fs.writeBatch(this.db);
    batch.update(this.ref('messes', messId, 'members', uid), { active: false });
    batch.update(this.ref('messes', messId), { memberUids: fs.arrayRemove(uid) });
    batch.set(this.ref('users', uid), { messIds: fs.arrayRemove(messId) }, { merge: true });
    await batch.commit();
  }

  subscribeMess(messId, callback) {
    const { fs } = this;
    const state = { mess: null, members: [], month: null, meals: [], bazar: [], fixedCosts: [], deposits: [] };
    let monthUnsubs = [];
    let monthId = null;
    let scheduled = false;
    const emit = () => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (state.mess) callback({ ...state });
      });
    };
    const onError = (err) => console.error('[firestore]', err);

    const watchMonth = (id) => {
      monthUnsubs.forEach((u) => u());
      const path = this.monthPath(messId, id);
      monthUnsubs = [
        fs.onSnapshot(this.ref(...path), (s) => { state.month = s.exists() ? fromFirestore({ id: s.id, ...s.data() }) : null; emit(); }, onError),
        fs.onSnapshot(this.col(...path, 'meals'), (s) => { state.meals = this.docs(s); emit(); }, onError),
        fs.onSnapshot(fs.query(this.col(...path, 'bazar'), fs.orderBy('date', 'desc')), (s) => { state.bazar = this.docs(s); emit(); }, onError),
        fs.onSnapshot(this.col(...path, 'fixedCosts'), (s) => { state.fixedCosts = this.docs(s); emit(); }, onError),
        fs.onSnapshot(fs.query(this.col(...path, 'deposits'), fs.orderBy('createdAt', 'desc')), (s) => { state.deposits = this.docs(s); emit(); }, onError)
      ];
    };

    const unsubMess = fs.onSnapshot(this.ref('messes', messId), (s) => {
      if (!s.exists()) return;
      state.mess = fromFirestore({ id: s.id, ...s.data() });
      if (state.mess.currentMonth !== monthId) {
        monthId = state.mess.currentMonth;
        watchMonth(monthId);
      }
      emit();
    }, onError);
    const unsubMembers = fs.onSnapshot(this.col('messes', messId, 'members'), (s) => {
      state.members = s.docs.map((d) => fromFirestore({ uid: d.id, ...d.data() }));
      emit();
    }, onError);

    return () => {
      unsubMess();
      unsubMembers();
      monthUnsubs.forEach((u) => u());
    };
  }

  // ---------- month data ----------

  async setMeal(messId, monthId, entry) {
    const meal = entry instanceof MealEntry ? entry : new MealEntry(entry);
    await this.fs.setDoc(this.ref(...this.monthPath(messId, monthId), 'meals', meal.id), {
      ...meal.toJSON(),
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async addBazar(messId, monthId, data) {
    const ref = await this.fs.addDoc(this.col(...this.monthPath(messId, monthId), 'bazar'), {
      ...data,
      createdAt: this.fs.serverTimestamp()
    });
    return ref.id;
  }

  async deleteBazar(messId, monthId, id) {
    await this.fs.deleteDoc(this.ref(...this.monthPath(messId, monthId), 'bazar', id));
  }

  async addFixedCost(messId, monthId, data) {
    const ref = await this.fs.addDoc(this.col(...this.monthPath(messId, monthId), 'fixedCosts'), data);
    return ref.id;
  }

  async deleteFixedCost(messId, monthId, id) {
    await this.fs.deleteDoc(this.ref(...this.monthPath(messId, monthId), 'fixedCosts', id));
  }

  async addDeposit(messId, monthId, data) {
    const ref = await this.fs.addDoc(this.col(...this.monthPath(messId, monthId), 'deposits'), {
      status: 'pending',
      confirmedBy: null,
      ...data,
      createdAt: this.fs.serverTimestamp()
    });
    return ref.id;
  }

  async setDepositStatus(messId, monthId, id, status, byUid) {
    await this.fs.updateDoc(this.ref(...this.monthPath(messId, monthId), 'deposits', id), { status, confirmedBy: byUid });
  }

  // ---------- close + history ----------

  async closeMonth(messId, monthId, { results, settlement, stats, retentionDays, nextMonthId }) {
    const { fs } = this;
    const policy = new RetentionPolicy(retentionDays);
    const closedAt = new Date();
    const expireAt = fs.Timestamp.fromDate(policy.expireAt(closedAt));
    const path = this.monthPath(messId, monthId);

    // 1. Stamp expireAt on every raw document of the month (chunked: a month can exceed one batch).
    const ops = [];
    for (const group of ['meals', 'bazar', 'fixedCosts', 'deposits']) {
      const snap = await fs.getDocs(this.col(...path, group));
      for (const d of snap.docs) ops.push((b) => b.update(d.ref, { expireAt }));
    }
    await this.commitInChunks(ops);

    // 2. Results, the closed month, the next month and the mess pointer — atomically.
    const batch = fs.writeBatch(this.db);
    for (const r of results) {
      batch.set(this.ref('messes', messId, 'results', `${monthId}_${r.uid}`), {
        ...r,
        monthId,
        closedAt: fs.Timestamp.fromDate(closedAt),
        expireAt
      });
    }
    batch.update(this.ref(...path), {
      status: 'closed',
      closedAt: fs.Timestamp.fromDate(closedAt),
      expireAt,
      settlement,
      stats
    });
    const messSnap = await fs.getDoc(this.ref('messes', messId));
    batch.set(this.ref(...this.monthPath(messId, nextMonthId)), { status: 'open', managerUid: messSnap.data().managerUid }, { merge: true });
    batch.update(this.ref('messes', messId), { currentMonth: nextMonthId });
    await batch.commit();
  }

  async getMonth(messId, monthId) {
    const snap = await this.fs.getDoc(this.ref(...this.monthPath(messId, monthId)));
    return snap.exists() ? fromFirestore({ id: snap.id, ...snap.data() }) : null;
  }

  async listMeals(messId, monthId, uid) {
    const { fs } = this;
    const col = this.col(...this.monthPath(messId, monthId), 'meals');
    const snap = await fs.getDocs(uid ? fs.query(col, fs.where('memberUid', '==', uid)) : col);
    return this.docs(snap).sort((a, b) => a.date.localeCompare(b.date));
  }

  async upsertSnapshot(messId, snapshot) {
    const { fs } = this;
    const id = `${snapshot.uid}_${snapshot.date}`;
    const ref = this.ref('messes', messId, 'snapshots', id);
    const existing = await fs.getDoc(ref);
    const createdAt = existing.exists() ? existing.data().createdAt.toDate() : new Date();
    // expireAt slides forward on every write, so the latest numbers are always kept ≥ 30 days.
    await fs.setDoc(ref, {
      ...snapshot,
      createdAt: fs.Timestamp.fromDate(createdAt),
      expireAt: fs.Timestamp.fromDate(new RetentionPolicy().expireAt(new Date()))
    });
  }

  async listSnapshots(messId, uid, sinceDateKey) {
    const { fs } = this;
    const q = fs.query(
      this.col('messes', messId, 'snapshots'),
      fs.where('uid', '==', uid),
      fs.where('date', '>=', sinceDateKey),
      fs.orderBy('date')
    );
    return this.docs(await fs.getDocs(q));
  }

  async listResults(messId, uid) {
    const { fs } = this;
    const col = this.col('messes', messId, 'results');
    const q = uid ? fs.query(col, fs.where('uid', '==', uid)) : col;
    return this.docs(await fs.getDocs(q)).sort((a, b) => b.monthId.localeCompare(a.monthId));
  }

  /** Fallback for when the Firestore TTL policy is not switched on. Manager only. */
  async cleanupExpired(messId, now = new Date()) {
    const { fs } = this;
    const before = fs.Timestamp.fromDate(now);
    const ops = [];
    for (const group of ['snapshots', 'results']) {
      const snap = await fs.getDocs(fs.query(this.col('messes', messId, group), fs.where('expireAt', '<', before)));
      snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
    }
    const months = await fs.getDocs(fs.query(this.col('messes', messId, 'months'), fs.where('expireAt', '<', before)));
    for (const m of months.docs) {
      for (const group of ['meals', 'bazar', 'fixedCosts', 'deposits']) {
        const snap = await fs.getDocs(this.col('messes', messId, 'months', m.id, group));
        snap.docs.forEach((d) => ops.push((b) => b.delete(d.ref)));
      }
      ops.push((b) => b.delete(m.ref));
    }
    await this.commitInChunks(ops);
    return ops.length;
  }

  async deleteUserData(uid) {
    await this.fs.deleteDoc(this.ref('users', uid));
  }
}

/** Firestore Timestamps → Date, recursively. */
function fromFirestore(value) {
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate();
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = fromFirestore(v);
    return out;
  }
  return value;
}
