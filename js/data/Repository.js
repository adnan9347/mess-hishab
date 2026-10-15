/**
 * Repository interface — the app talks to this, never to Firestore or localStorage directly.
 * LocalRepository (demo mode) and FirestoreRepository both extend it, so screens work the same in both.
 *
 * Shapes (dates are JS Date objects when read back):
 *   Mess     { id, name, inviteCode, managerUid, memberUids[], currentMonth, mealCutoffs, mealWeights, retentionDays, createdAt }
 *   Member   { uid, displayName, role: 'manager'|'member', active, joinedAt }
 *   Month    { id: 'yyyy-mm', status: 'open'|'closed', managerUid, closedAt?, expireAt?, settlement?[], stats? }
 *   Meal     { memberUid, date, breakfast, lunch, dinner, guests, updatedAt }
 *   Bazar    { id, shopperUid, amount, source: 'fund'|'pocket', note, date, createdBy, createdAt }
 *   Fixed    { id, label, amount }
 *   Deposit  { id, memberUid, amount, method: 'bkash'|'nagad'|'cash', trxId, status, confirmedBy, createdAt }
 *   Snapshot { id, uid, date, monthId, meals, mealRate, mealCost, fixedShare, paid, balance, createdAt, expireAt }
 *   Result   { id, uid, monthId, meals, mealRate, mealCost, fixedShare, paid, balance, settlementLines[], closedAt, expireAt }
 */
export class Repository {
  notImplemented(name) {
    throw new Error(`${this.constructor.name}.${name}() is not implemented`);
  }

  // Profiles
  async getProfile(uid) { this.notImplemented('getProfile'); }
  async saveProfile(uid, data) { this.notImplemented('saveProfile'); }

  // Mess membership
  async createMess(uid, { name, displayName }) { this.notImplemented('createMess'); }
  async joinMess(uid, code, displayName) { this.notImplemented('joinMess'); }
  async updateMess(messId, data) { this.notImplemented('updateMess'); }
  async updateMember(messId, uid, data) { this.notImplemented('updateMember'); }
  async handoverManager(messId, newUid) { this.notImplemented('handoverManager'); }
  async leaveMess(messId, uid) { this.notImplemented('leaveMess'); }

  /** Live view of a mess and its current month. Returns an unsubscribe function. */
  subscribeMess(messId, callback) { this.notImplemented('subscribeMess'); }

  // Current month data
  async setMeal(messId, monthId, entry) { this.notImplemented('setMeal'); }
  async addBazar(messId, monthId, data) { this.notImplemented('addBazar'); }
  async deleteBazar(messId, monthId, id) { this.notImplemented('deleteBazar'); }
  async addFixedCost(messId, monthId, data) { this.notImplemented('addFixedCost'); }
  async deleteFixedCost(messId, monthId, id) { this.notImplemented('deleteFixedCost'); }
  async addDeposit(messId, monthId, data) { this.notImplemented('addDeposit'); }
  async setDepositStatus(messId, monthId, id, status, byUid) { this.notImplemented('setDepositStatus'); }

  // Month close + history
  async closeMonth(messId, monthId, { results, settlement, stats, retentionDays, nextMonthId }) { this.notImplemented('closeMonth'); }
  async getMonth(messId, monthId) { this.notImplemented('getMonth'); }
  async listMeals(messId, monthId, uid) { this.notImplemented('listMeals'); }

  // Retention (≥ 30 days)
  async upsertSnapshot(messId, snapshot) { this.notImplemented('upsertSnapshot'); }
  async listSnapshots(messId, uid, sinceDateKey) { this.notImplemented('listSnapshots'); }
  async listResults(messId, uid) { this.notImplemented('listResults'); }
  async cleanupExpired(messId, now) { this.notImplemented('cleanupExpired'); }

  async deleteUserData(uid) { this.notImplemented('deleteUserData'); }
}

/** Errors the UI knows how to explain in Bangla and English. */
export class RepoError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}
