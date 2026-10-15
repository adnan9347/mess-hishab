import { AuthService, AuthError, AuthRules } from './AuthService.js';
import { SafeStorage } from '../core/Storage.js';
import { uid as newId } from '../core/util.js';
import { DEMO_ACCOUNT } from '../config.js';
import { DEMO_UID } from '../data/DemoSeeder.js';

const STORAGE_KEY = 'mh.auth.v1';
const GOOGLE_DEMO = { email: 'google.demo@gmail.com', displayName: 'Nusrat Jahan' };

/**
 * Demo-mode auth: accounts live in this browser only and passwords are stored as SHA-256 hashes.
 * It behaves like Firebase Auth (same errors, verification flow) so the UI can be tested end-to-end.
 */
export class DemoAuthService extends AuthService {
  constructor() {
    super();
    this.store = SafeStorage.get(STORAGE_KEY) ?? { accounts: {}, session: null };
    queueMicrotask(() => this.restore());
  }

  async restore() {
    await this.ensureDemoAccount();
    const account = Object.values(this.store.accounts).find((a) => a.uid === this.store.session);
    this.setUser(account ? publicUser(account) : null);
  }

  async ensureDemoAccount() {
    if (this.store.accounts[DEMO_ACCOUNT.email]) return;
    this.store.accounts[DEMO_ACCOUNT.email] = {
      uid: DEMO_UID,
      email: DEMO_ACCOUNT.email,
      displayName: 'Adnan Hossain',
      passwordHash: await hash(DEMO_ACCOUNT.password),
      emailVerified: true,
      provider: 'password'
    };
    this.save();
  }

  save() {
    SafeStorage.set(STORAGE_KEY, this.store);
  }

  login(account) {
    this.store.session = account.uid;
    this.save();
    this.setUser(publicUser(account));
    return this.user;
  }

  async signUp(name, email, password) {
    const key = AuthRules.normalizeEmail(email);
    if (!AuthRules.isEmail(key)) throw new AuthError('invalid-email');
    if (password.length < AuthRules.MIN_PASSWORD) throw new AuthError('weak-password');
    if (this.store.accounts[key]) throw new AuthError('email-in-use');
    const account = {
      uid: newId('u_'),
      email: key,
      displayName: name.trim(),
      passwordHash: await hash(password),
      emailVerified: false,
      provider: 'password'
    };
    this.store.accounts[key] = account;
    return this.login(account);
  }

  async signIn(email, password) {
    const account = this.store.accounts[AuthRules.normalizeEmail(email)];
    if (!account || account.passwordHash !== (await hash(password))) throw new AuthError('invalid-credential');
    return this.login(account);
  }

  async signInWithGoogle() {
    let account = this.store.accounts[GOOGLE_DEMO.email];
    if (!account) {
      account = { uid: newId('u_'), ...GOOGLE_DEMO, passwordHash: null, emailVerified: true, provider: 'google' };
      this.store.accounts[GOOGLE_DEMO.email] = account;
    }
    return this.login(account);
  }

  async sendPasswordReset(email) {
    if (!AuthRules.isEmail(email)) throw new AuthError('invalid-email');
    // Like Firebase, never reveal whether the account exists.
  }

  /** Demo shortcut: "sending" the verification email verifies the account straight away. */
  async resendVerification() {
    const account = this.current();
    if (!account) return;
    account.emailVerified = true;
    this.save();
    this.setUser(publicUser(account));
  }

  async updateName(name) {
    const account = this.current();
    if (!account) return;
    account.displayName = name.trim();
    this.save();
    this.setUser(publicUser(account));
  }

  async signOut() {
    this.store.session = null;
    this.save();
    this.setUser(null);
  }

  async deleteAccount() {
    const account = this.current();
    if (!account) return;
    delete this.store.accounts[account.email];
    await this.signOut();
  }

  current() {
    return Object.values(this.store.accounts).find((a) => a.uid === this.store.session) ?? null;
  }
}

function publicUser(a) {
  return {
    uid: a.uid,
    email: a.email,
    displayName: a.displayName,
    photoURL: null,
    emailVerified: a.emailVerified,
    provider: a.provider
  };
}

async function hash(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mess-hishab:${text}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
