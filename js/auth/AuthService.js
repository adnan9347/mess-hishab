/**
 * Auth interface. DemoAuthService and FirebaseAuthService extend it.
 * A user is { uid, email, displayName, photoURL, emailVerified, provider }.
 */
export class AuthService extends EventTarget {
  constructor() {
    super();
    this.user = null;
    this.ready = false;
  }

  /** Calls back now (if ready) and on every change. Returns an unsubscribe function. */
  onChange(callback) {
    const handler = () => callback(this.user);
    this.addEventListener('change', handler);
    if (this.ready) queueMicrotask(handler);
    return () => this.removeEventListener('change', handler);
  }

  setUser(user) {
    this.user = user;
    this.ready = true;
    this.dispatchEvent(new Event('change'));
  }

  async signUp(name, email, password) { throw new Error('not implemented'); }
  async signIn(email, password) { throw new Error('not implemented'); }
  async signInWithGoogle() { throw new Error('not implemented'); }
  async sendPasswordReset(email) { throw new Error('not implemented'); }
  async resendVerification() { throw new Error('not implemented'); }
  async updateName(name) { throw new Error('not implemented'); }
  async signOut() { throw new Error('not implemented'); }
  async deleteAccount() { throw new Error('not implemented'); }
}

/** Normalised auth errors; `key` is the i18n key the UI shows. */
export class AuthError extends Error {
  static KEYS = {
    'invalid-credential': 'auth.err.invalid',
    'email-in-use': 'auth.err.emailInUse',
    'weak-password': 'auth.err.weakPassword',
    'invalid-email': 'auth.err.invalidEmail',
    network: 'auth.err.network',
    'too-many-requests': 'auth.err.tooMany',
    'requires-recent-login': 'auth.err.recentLogin',
    cancelled: 'auth.err.cancelled',
    unknown: 'auth.err.unknown'
  };

  constructor(code) {
    super(code);
    this.code = AuthError.KEYS[code] ? code : 'unknown';
  }

  get key() {
    return AuthError.KEYS[this.code];
  }

  /** Map Firebase's "auth/…" codes to ours. Never show raw codes to people. */
  static fromFirebase(err) {
    const map = {
      'auth/invalid-credential': 'invalid-credential',
      'auth/wrong-password': 'invalid-credential',
      'auth/user-not-found': 'invalid-credential',
      'auth/invalid-login-credentials': 'invalid-credential',
      'auth/email-already-in-use': 'email-in-use',
      'auth/weak-password': 'weak-password',
      'auth/invalid-email': 'invalid-email',
      'auth/network-request-failed': 'network',
      'auth/too-many-requests': 'too-many-requests',
      'auth/requires-recent-login': 'requires-recent-login',
      'auth/popup-closed-by-user': 'cancelled',
      'auth/cancelled-popup-request': 'cancelled'
    };
    return new AuthError(map[err?.code] ?? 'unknown');
  }
}

/** Shared validation so both services (and the forms) agree. */
export const AuthRules = {
  normalizeEmail: (email) => String(email ?? '').trim().toLowerCase(),
  isEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim()),
  MIN_PASSWORD: 6,
  /** 0–3: too short, weak, okay, strong */
  passwordStrength(pw = '') {
    if (pw.length < AuthRules.MIN_PASSWORD) return 0;
    let score = 1;
    if (pw.length >= 10) score += 1;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw) && /\d/.test(pw)) score += 1;
    else if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
    return Math.min(score, 3);
  }
};
