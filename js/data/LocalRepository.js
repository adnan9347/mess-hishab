import { Repository, RepoError } from './Repository.js';
import { SafeStorage } from '../core/Storage.js';
import { uid as newId, inviteCode } from '../core/util.js';
import { DhakaDate } from '../core/DhakaDate.js';
import { MealEntry, DEFAULT_CUTOFFS, DEFAULT_WEIGHTS } from '../domain/MealEntry.js';
import { RetentionPolicy } from '../domain/RetentionPolicy.js';

const STORAGE_KEY = 'mh.db.v1';
const DATE_FIELDS = new Set(['createdAt', 'closedAt', 'expireAt', 'joinedAt', 'updatedAt']);

/** Demo-mode repository: the whole database lives in this browser's localStorage. */
export class LocalRepository extends Repository {
  constructor() {
    super();
    this.db = SafeStorage.get(STORAGE_KEY) ?? LocalRepository.emptyDb();
    this.listeners = new Map();
    // Keep several open tabs in sync.
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      this.db = SafeStorage.get(STORAGE_KEY) ?? LocalRepository.emptyDb();
      for (const messId of this.listeners.keys()) this.emit(messId);
    });
  }

  static emptyDb() {
    return { users: {}, inviteCodes: {}, messes: {} };
  }

  // ---------- internals ----------

  commit(messId = null) {
    SafeStorage.set(STORAGE_KEY, this.db);
    if (messId) queueMicrotask(() => this.emit(messId));
  }

  messNode(messId) {
    const node = this.db.messes[messId];
    if (!node) throw new RepoError('not-found');
    return node;
  }

  monthNode(messId, monthId) {
    const node = this.messNode(messId).months[monthId];
    if (!node) throw new RepoError('not-found');
    return node;
  }

  assertOpen(month) {
    if (month.status !== 'open') throw new RepoError('month-closed');
  }

  emit(messId) {
    const set = this.listeners.get(messId);
    if (!set?.size) return;
    const snapshot = this.readMess(messId);
    for (const cb of set) cb(snapshot);
  }

  readMess(messId) {
    const node = this.db.messes[messId];
    if (!node) return null;
    const month = node.months[node.mess.currentMonth];
    return revive({
      mess: node.mess,
      members: Object.values(node.members),
      month: month?.info ?? null,
      meals: Object.values(month?.meals ?? {}),
      bazar: sortByDateDesc(Object.values(month?.bazar ?? {})),
      fixedCosts: Object.values(month?.fixedCosts ?? {}),
      deposits: sortByCreatedDesc(Object.values(month?.deposits ?? {}))
    });
  }

  // ---------- profiles ----------

  async getProfile(uid) {
    return revive(this.db.users[uid] ?? null);
  }

  async saveProfile(uid, data) {
    this.db.users[uid] = { ...(this.db.users[uid] ?? { createdAt: iso(), messIds: [] }), ...serialize(data) };
    this.commit();
  }

  // ---------- membership ----------

  async createMess(uid, { name, displayName }) {
    const messId = newId('m_');
    let code = inviteCode();
    while (this.db.inviteCodes[code]) code = inviteCode();
    const monthId = DhakaDate.monthKey();
    this.db.inviteCodes[code] = { messId };
    this.db.messes[messId] = {
      mess: {
        id: messId,
        name,
        inviteCode: code,
        managerUid: uid,
        memberUids: [uid],
        currentMonth: monthId,
        mealCutoffs: { ...DEFAULT_CUTOFFS },
        mealWeights: { ...DEFAULT_WEIGHTS },
        retentionDays: RetentionPolicy.MIN_DAYS,
        createdAt: iso()
      },
      members: { [uid]: { uid, displayName, role: 'manager', active: true, joinedAt: iso() } },
      months: { [monthId]: emptyMonth(monthId, uid) },
      snapshots: {},
      results: {}
    };
    this.addMessToProfile(uid, messId);
    this.commit(messId);
    return messId;
  }

  async joinMess(uid, code, displayName) {
    const entry = this.db.inviteCodes[String(code).toUpperCase()];
    if (!entry) throw new RepoError('invalid-code');
    const node = this.messNode(entry.messId);
    if (!node.mess.memberUids.includes(uid)) {
      node.mess.memberUids.push(uid);
      node.members[uid] = { uid, displayName, role: 'member', active: true, joinedAt: iso() };
    }
    this.addMessToProfile(uid, entry.messId);
    this.commit(entry.messId);
    return entry.messId;
  }

  addMessToProfile(uid, messId) {
    const user = (this.db.users[uid] ??= { createdAt: iso(), messIds: [] });
    user.messIds = [messId, ...(user.messIds ?? []).filter((id) => id !== messId)];
  }

  async updateMess(messId, data) {
    const node = this.messNode(messId);
    if ('retentionDays' in data) new RetentionPolicy(data.retentionDays); // throws below 30
    node.mess = { ...node.mess, ...data };
    this.commit(messId);
  }

  async updateMember(messId, uid, data) {
    const node = this.messNode(messId);
    node.members[uid] = { ...node.members[uid], ...data };
    this.commit(messId);
  }

  async handoverManager(messId, newUid) {
    const node = this.messNode(messId);
    const old = node.mess.managerUid;
    if (!node.members[newUid]) throw new RepoError('not-found');
    node.members[old].role = 'member';
    node.members[newUid].role = 'manager';
    node.mess.managerUid = newUid;
    node.months[node.mess.currentMonth].info.managerUid = newUid;
    this.commit(messId);
  }

  async leaveMess(messId, uid) {
    const node = this.messNode(messId);
    if (node.mess.managerUid === uid && node.mess.memberUids.length > 1) throw new RepoError('manager-must-handover');
    node.mess.memberUids = node.mess.memberUids.filter((id) => id !== uid);
    if (node.members[uid]) node.members[uid].active = false;
    const user = this.db.users[uid];
    if (user) user.messIds = (user.messIds ?? []).filter((id) => id !== messId);
    this.commit(messId);
  }

  subscribeMess(messId, callback) {
    if (!this.listeners.has(messId)) this.listeners.set(messId, new Set());
    this.listeners.get(messId).add(callback);
    queueMicrotask(() => callback(this.readMess(messId)));
    return () => this.listeners.get(messId)?.delete(callback);
  }

  // ---------- month data ----------

  async setMeal(messId, monthId, entry) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    const meal = entry instanceof MealEntry ? entry : new MealEntry(entry);
    month.meals[meal.id] = { ...meal.toJSON(), updatedAt: iso() };
    this.commit(messId);
  }

  async addBazar(messId, monthId, data) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    const id = newId('b_');
    month.bazar[id] = { id, ...serialize(data), createdAt: iso() };
    this.commit(messId);
    return id;
  }

  async deleteBazar(messId, monthId, id) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    delete month.bazar[id];
    this.commit(messId);
  }

  async addFixedCost(messId, monthId, data) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    const id = newId('f_');
    month.fixedCosts[id] = { id, ...serialize(data) };
    this.commit(messId);
    return id;
  }

  async deleteFixedCost(messId, monthId, id) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    delete month.fixedCosts[id];
    this.commit(messId);
  }

  async addDeposit(messId, monthId, data) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    const id = newId('d_');
    month.deposits[id] = { id, status: 'pending', confirmedBy: null, ...serialize(data), createdAt: iso() };
    this.commit(messId);
    return id;
  }

  async setDepositStatus(messId, monthId, id, status, byUid) {
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    Object.assign(month.deposits[id], { status, confirmedBy: byUid });
    this.commit(messId);
  }

  // ---------- close + history ----------

  async closeMonth(messId, monthId, { results, settlement, stats, retentionDays, nextMonthId }) {
    const node = this.messNode(messId);
    const month = this.monthNode(messId, monthId);
    this.assertOpen(month.info);
    const policy = new RetentionPolicy(retentionDays);
    const closedAt = new Date();
    const expireAt = iso(policy.expireAt(closedAt));

    for (const r of results) {
      const id = `${monthId}_${r.uid}`;
      node.results[id] = { id, ...serialize(r), monthId, closedAt: iso(closedAt), expireAt };
    }
    for (const group of ['meals', 'bazar', 'fixedCosts', 'deposits']) {
      for (const doc of Object.values(month[group])) doc.expireAt = expireAt;
    }
    month.info = { ...month.info, status: 'closed', closedAt: iso(closedAt), expireAt, settlement, stats };
    node.months[nextMonthId] ??= emptyMonth(nextMonthId, node.mess.managerUid);
    node.mess.currentMonth = nextMonthId;
    this.commit(messId);
  }

  async getMonth(messId, monthId) {
    return revive(this.db.messes[messId]?.months[monthId]?.info ?? null);
  }

  async listMeals(messId, monthId, uid) {
    const meals = Object.values(this.db.messes[messId]?.months[monthId]?.meals ?? {});
    return revive(meals.filter((m) => !uid || m.memberUid === uid).sort((a, b) => a.date.localeCompare(b.date)));
  }

  async upsertSnapshot(messId, snapshot) {
    const node = this.messNode(messId);
    const id = `${snapshot.uid}_${snapshot.date}`;
    const existing = node.snapshots[id];
    const createdAt = existing?.createdAt ?? iso();
    const expireAt = iso(new RetentionPolicy(RetentionPolicy.MIN_DAYS).expireAt(new Date()));
    node.snapshots[id] = { ...serialize(snapshot), id, createdAt, expireAt };
    this.commit();
  }

  async listSnapshots(messId, uid, sinceDateKey) {
    const all = Object.values(this.db.messes[messId]?.snapshots ?? {});
    return revive(all.filter((s) => s.uid === uid && s.date >= sinceDateKey).sort((a, b) => a.date.localeCompare(b.date)));
  }

  async listResults(messId, uid) {
    const all = Object.values(this.db.messes[messId]?.results ?? {});
    return revive(all.filter((r) => !uid || r.uid === uid).sort((a, b) => b.monthId.localeCompare(a.monthId)));
  }

  /** App-side fallback for Firestore TTL: drop anything whose expireAt has passed. */
  async cleanupExpired(messId, now = new Date()) {
    const node = this.db.messes[messId];
    if (!node) return 0;
    let removed = 0;
    const expired = (doc) => RetentionPolicy.isExpired(doc.expireAt, now);
    for (const group of ['snapshots', 'results']) {
      for (const [id, doc] of Object.entries(node[group])) {
        if (expired(doc)) {
          delete node[group][id];
          removed += 1;
        }
      }
    }
    for (const [monthId, month] of Object.entries(node.months)) {
      if (month.info.status === 'closed' && expired(month.info)) {
        delete node.months[monthId];
        removed += 1;
      }
    }
    if (removed) this.commit(messId);
    return removed;
  }

  async deleteUserData(uid) {
    delete this.db.users[uid];
    this.commit();
  }

  hasMess(messId) {
    return Boolean(this.db.messes[messId]);
  }

  /** Writes the demo seeder's database, replacing only the demo mess and keeping everything else. */
  mergeSeed(seed) {
    for (const [uid, profile] of Object.entries(seed.users)) {
      const existing = this.db.users[uid] ?? {};
      this.db.users[uid] = {
        ...profile,
        ...existing,
        messIds: [...new Set([...(profile.messIds ?? []), ...(existing.messIds ?? [])])]
      };
    }
    Object.assign(this.db.inviteCodes, seed.inviteCodes);
    Object.assign(this.db.messes, seed.messes);
    this.commit(Object.keys(seed.messes)[0]);
  }
}

function emptyMonth(monthId, managerUid) {
  return { info: { id: monthId, status: 'open', managerUid }, meals: {}, bazar: {}, fixedCosts: {}, deposits: {} };
}

function iso(date = new Date()) {
  return new Date(date).toISOString();
}

function serialize(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

/** Deep-copy and turn ISO strings in known date fields back into Dates. */
function revive(value) {
  if (Array.isArray(value)) return value.map(revive);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = DATE_FIELDS.has(k) && typeof v === 'string' ? new Date(v) : revive(v);
    }
    return out;
  }
  return value;
}

function sortByDateDesc(list) {
  return list.sort((a, b) => (b.date + (b.createdAt ?? '')).localeCompare(a.date + (a.createdAt ?? '')));
}

function sortByCreatedDesc(list) {
  return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
