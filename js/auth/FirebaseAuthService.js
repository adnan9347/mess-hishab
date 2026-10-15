import { AuthService, AuthError, AuthRules } from './AuthService.js';
import { FIREBASE_SDK_VERSION } from '../config.js';

const SDK = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;

/** Firebase Authentication: email/password + Google (popup on desktop, redirect on phones). */
export class FirebaseAuthService extends AuthService {
  static async create(firebaseApp, locale = 'bn') {
    const sdk = await import(`${SDK}/firebase-auth.js`);
    const auth = sdk.getAuth(firebaseApp);
    auth.languageCode = locale;
    return new FirebaseAuthService(sdk, auth);
  }

  constructor(sdk, auth) {
    super();
    this.sdk = sdk;
    this.auth = auth;
    sdk.getRedirectResult(auth).catch(() => {});
    sdk.onAuthStateChanged(auth, (u) => this.setUser(u ? toUser(u) : null));
  }

  setLanguage(locale) {
    this.auth.languageCode = locale;
  }

  async run(fn) {
    try {
      return await fn();
    } catch (err) {
      throw AuthError.fromFirebase(err);
    }
  }

  async signUp(name, email, password) {
    return this.run(async () => {
      const cred = await this.sdk.createUserWithEmailAndPassword(this.auth, AuthRules.normalizeEmail(email), password);
      await this.sdk.updateProfile(cred.user, { displayName: name.trim() });
      await this.sdk.sendEmailVerification(cred.user);
      this.setUser(toUser(cred.user));
      return this.user;
    });
  }

  async signIn(email, password) {
    return this.run(async () => {
      const cred = await this.sdk.signInWithEmailAndPassword(this.auth, AuthRules.normalizeEmail(email), password);
      return toUser(cred.user);
    });
  }

  async signInWithGoogle() {
    return this.run(async () => {
      const provider = new this.sdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      if (window.matchMedia('(pointer: coarse)').matches) {
        await this.sdk.signInWithRedirect(this.auth, provider);
        return null;
      }
      const cred = await this.sdk.signInWithPopup(this.auth, provider);
      return toUser(cred.user);
    });
  }

  async sendPasswordReset(email) {
    return this.run(() => this.sdk.sendPasswordResetEmail(this.auth, AuthRules.normalizeEmail(email)));
  }

  async resendVerification() {
    return this.run(async () => {
      if (!this.auth.currentUser) return;
      await this.auth.currentUser.reload();
      if (!this.auth.currentUser.emailVerified) await this.sdk.sendEmailVerification(this.auth.currentUser);
      this.setUser(toUser(this.auth.currentUser));
    });
  }

  async updateName(name) {
    return this.run(async () => {
      await this.sdk.updateProfile(this.auth.currentUser, { displayName: name.trim() });
      this.setUser(toUser(this.auth.currentUser));
    });
  }

  async signOut() {
    await this.sdk.signOut(this.auth);
  }

  async deleteAccount() {
    return this.run(() => this.sdk.deleteUser(this.auth.currentUser));
  }
}

function toUser(u) {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName ?? '',
    photoURL: u.photoURL ?? null,
    emailVerified: u.emailVerified,
    provider: u.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password'
  };
}
