import { View } from '../View.js';
import { AuthRules, AuthError } from '../../auth/AuthService.js';
import { esc } from '../../core/util.js';
import { MODE, DEMO_ACCOUNT } from '../../config.js';

/** Shared chrome for the signed-out screens: language + theme in the corner, centred card on desktop. */
class AuthView extends View {
  static layout = 'bare';
  static live = false;

  topBar(back = null) {
    return `
      <div class="auth-top">
        ${back ? `<a href="#/${back}" class="icon-btn" aria-label="${esc(this.t('common.back'))}"><i class="bi bi-arrow-left"></i></a>` : '<span></span>'}
        <div class="tw-flex tw-items-center tw-gap-2">
          ${this.app.localeSwitch()}
          ${this.app.themeButton()}
        </div>
      </div>`;
  }

  googleButton() {
    return `
      <button type="button" class="btn btn-google btn-xl w-100" data-action="google">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        <span>${this.t('auth.google')}</span>
      </button>
      <div class="divider-text"><span>${this.t('auth.or')}</span></div>`;
  }

  errorBox() {
    return `<div class="alert alert-danger tw-text-sm tw-rounded-xl d-none" role="alert" data-error></div>`;
  }

  showError(err) {
    const box = this.$('[data-error]');
    const key = err instanceof AuthError ? err.key : 'auth.err.unknown';
    if (err instanceof AuthError && err.code === 'cancelled') return;
    box.textContent = this.t(key);
    box.classList.remove('d-none');
  }

  clearError() {
    this.$('[data-error]')?.classList.add('d-none');
  }

  async busy(button, fn) {
    const label = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>`;
    try {
      await fn();
    } catch (err) {
      this.showError(err);
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.innerHTML = label;
      }
    }
  }

  /** Inline validation on blur, not on every keystroke. */
  validateField(input) {
    const value = input.value;
    let error = '';
    if (input.name === 'name' && value.trim().length < 2) error = this.t('auth.v.name');
    if (input.name === 'email' && !AuthRules.isEmail(value)) error = this.t('auth.v.email');
    if (input.name === 'password' && input.dataset.rule === 'new' && value.length < AuthRules.MIN_PASSWORD)
      error = this.t('auth.v.password', { n: this.i18n.num(AuthRules.MIN_PASSWORD) });
    if (input.name === 'password' && input.dataset.rule !== 'new' && !value) error = this.t('auth.v.required');
    input.classList.toggle('is-invalid', Boolean(error));
    const fb = input.closest('.field')?.querySelector('.invalid-feedback');
    if (fb) fb.textContent = error;
    return !error;
  }

  bindForm(onSubmit) {
    this.on('focusout', 'input', (e, el) => el.value && this.validateField(el));
    this.on('input', 'input.is-invalid', (e, el) => this.validateField(el));
    this.on('click', '[data-action=toggle-password]', (e, el) => {
      const input = el.closest('.field').querySelector('input');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      el.innerHTML = `<i class="bi ${show ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
      el.setAttribute('aria-label', this.t(show ? 'auth.hidePassword' : 'auth.showPassword'));
    });
    this.on('click', '[data-action=google]', (e, el) => {
      this.clearError();
      this.busy(el, () => this.app.auth.signInWithGoogle());
    });
    this.on('submit', 'form', (e) => {
      e.preventDefault();
      this.clearError();
      const inputs = this.$$('form input[name]');
      const ok = inputs.map((i) => this.validateField(i)).every(Boolean);
      if (!ok) return inputs.find((i) => i.classList.contains('is-invalid'))?.focus();
      const data = Object.fromEntries(new FormData(e.target));
      this.busy(this.$('form [type=submit]'), () => onSubmit(data));
    });
  }

  field({ name, type = 'text', label, autocomplete, rule = '', value = '' }) {
    const isPw = type === 'password';
    return `
      <div class="field">
        <label class="form-label" for="f-${name}">${esc(label)}</label>
        <div class="tw-relative">
          <input id="f-${name}" class="form-control form-control-lg ${isPw ? 'tw-pr-12' : ''}" name="${name}" type="${type}"
            autocomplete="${autocomplete}" ${rule ? `data-rule="${rule}"` : ''} value="${esc(value)}"
            ${type === 'email' ? 'inputmode="email" autocapitalize="off" spellcheck="false"' : ''} required>
          ${isPw ? `<button type="button" class="pw-toggle" data-action="toggle-password" aria-label="${esc(this.t('auth.showPassword'))}"><i class="bi bi-eye"></i></button>` : ''}
          <div class="invalid-feedback"></div>
        </div>
      </div>`;
  }
}

export class WelcomeView extends AuthView {
  render() {
    return `
      <div class="auth-page auth-page--welcome">
        ${this.topBar()}
        <div class="welcome">
          <div class="welcome__art" aria-hidden="true">${this.heroMock()}</div>
          <div class="welcome__copy">
            <div class="brand-mark tw-mb-4"><span class="brand-mark__logo"><i class="bi bi-journal-check"></i></span><span>${this.t('app.name')}</span></div>
            <h1 class="display-title">${this.t('welcome.title')}</h1>
            <p class="tw-text-muted tw-text-lg tw-mb-0">${this.t('welcome.subtitle')}</p>
          </div>
          <div class="welcome__actions">
            <a href="#/signup" class="btn btn-primary btn-xl w-100">${this.t('welcome.create')}</a>
            <a href="#/login" class="btn btn-ghost btn-xl w-100">${this.t('welcome.login')}</a>
            ${MODE === 'demo' ? `<button type="button" class="btn btn-link tw-text-sm tw-text-muted w-100" data-action="demo"><i class="bi bi-play-circle"></i> ${this.t('welcome.demo')}</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  heroMock() {
    const i = this.i18n;
    const pill = (icon, label, on) =>
      `<span class="mock-pill ${on ? 'is-on' : ''}"><i class="bi ${icon}"></i>${label}${on ? '<i class="bi bi-check-lg tw-ml-auto"></i>' : ''}</span>`;
    return `
      <div class="hero-mock">
        <div class="hero-mock__card hero-mock__card--back">
          <div class="eyebrow">${this.t('hishab.title')}</div>
          <div class="tw-flex tw-items-center tw-gap-3 tw-mt-2">
            <svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" stroke-opacity=".15" stroke-width="6"/><circle cx="22" cy="22" r="18" fill="none" stroke="rgb(var(--c-brand))" stroke-width="6" stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="30" transform="rotate(-90 22 22)"/></svg>
            <div><div class="tw-text-xs tw-text-muted">${this.t('hishab.youGet')}</div><div class="tw-font-bold tw-text-xl money-pos">${i.money(320)}</div></div>
          </div>
        </div>
        <div class="hero-mock__card hero-mock__card--front">
          <div class="eyebrow">${this.t('today.title')}</div>
          <div class="tw-flex tw-flex-col tw-gap-2 tw-mt-2">
            ${pill('bi-cup-hot', this.t('meal.breakfast'), true)}
            ${pill('bi-sun', this.t('meal.lunch'), true)}
            ${pill('bi-moon-stars', this.t('meal.dinner'), false)}
          </div>
        </div>
        <div class="hero-mock__chip"><i class="bi bi-calculator"></i> ${this.t('welcome.chip', { rate: i.money(58.4, { decimals: 1 }) })}</div>
      </div>`;
  }

  bind() {
    this.on('click', '[data-action=demo]', async (e, el) => {
      el.disabled = true;
      try {
        await this.app.auth.signIn(DEMO_ACCOUNT.email, DEMO_ACCOUNT.password);
      } catch {
        el.disabled = false;
      }
    });
  }
}

export class SignUpView extends AuthView {
  render() {
    return `
      <div class="auth-page">
        ${this.topBar('welcome')}
        <div class="auth-card">
          <h1 class="page-heading">${this.t('signup.title')}</h1>
          <p class="tw-text-muted tw-mb-6">${this.t('signup.subtitle')}</p>
          ${this.googleButton()}
          ${this.errorBox()}
          <form novalidate class="tw-flex tw-flex-col tw-gap-4">
            ${this.field({ name: 'name', label: this.t('auth.name'), autocomplete: 'name' })}
            ${this.field({ name: 'email', type: 'email', label: this.t('auth.email'), autocomplete: 'email' })}
            ${this.field({ name: 'password', type: 'password', label: this.t('auth.password'), autocomplete: 'new-password', rule: 'new' })}
            <div class="strength" data-strength="0" aria-live="polite">
              <span></span><span></span><span></span>
              <small class="tw-text-muted" data-strength-label>${this.t('auth.strength.0', { n: this.i18n.num(AuthRules.MIN_PASSWORD) })}</small>
            </div>
            <button type="submit" class="btn btn-primary btn-xl w-100 tw-mt-2">${this.t('signup.submit')}</button>
          </form>
          <p class="tw-text-center tw-text-sm tw-text-muted tw-mt-6 tw-mb-0">${this.t('signup.haveAccount')} <a href="#/login" class="link-brand">${this.t('welcome.login')}</a></p>
        </div>
      </div>`;
  }

  bind() {
    this.bindForm(({ name, email, password }) => this.app.auth.signUp(name, email, password));
    this.on('input', 'input[name=password]', (e, el) => {
      const s = AuthRules.passwordStrength(el.value);
      this.$('.strength').dataset.strength = String(s);
      this.$('[data-strength-label]').textContent = this.t(`auth.strength.${s}`, { n: this.i18n.num(AuthRules.MIN_PASSWORD) });
    });
  }
}

export class LoginView extends AuthView {
  render() {
    return `
      <div class="auth-page">
        ${this.topBar('welcome')}
        <div class="auth-card">
          <h1 class="page-heading">${this.t('login.title')}</h1>
          <p class="tw-text-muted tw-mb-6">${this.t('login.subtitle')}</p>
          ${this.googleButton()}
          ${this.errorBox()}
          <form novalidate class="tw-flex tw-flex-col tw-gap-4">
            ${this.field({ name: 'email', type: 'email', label: this.t('auth.email'), autocomplete: 'email' })}
            <div>
              ${this.field({ name: 'password', type: 'password', label: this.t('auth.password'), autocomplete: 'current-password' })}
              <div class="tw-text-right tw-mt-2"><a href="#/forgot" class="link-brand tw-text-sm">${this.t('login.forgot')}</a></div>
            </div>
            <button type="submit" class="btn btn-primary btn-xl w-100 tw-mt-2">${this.t('login.submit')}</button>
          </form>
          ${MODE === 'demo' ? `<p class="demo-hint"><i class="bi bi-info-circle"></i> ${this.t('login.demoHint', { email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password })}</p>` : ''}
          <p class="tw-text-center tw-text-sm tw-text-muted tw-mt-6 tw-mb-0">${this.t('login.noAccount')} <a href="#/signup" class="link-brand">${this.t('welcome.create')}</a></p>
        </div>
      </div>`;
  }

  bind() {
    this.bindForm(({ email, password }) => this.app.auth.signIn(email, password));
  }
}

export class ForgotView extends AuthView {
  render() {
    return `
      <div class="auth-page">
        ${this.topBar('login')}
        <div class="auth-card" data-state="form">
          <div data-panel="form">
            <h1 class="page-heading">${this.t('forgot.title')}</h1>
            <p class="tw-text-muted tw-mb-6">${this.t('forgot.subtitle')}</p>
            ${this.errorBox()}
            <form novalidate class="tw-flex tw-flex-col tw-gap-4">
              ${this.field({ name: 'email', type: 'email', label: this.t('auth.email'), autocomplete: 'email' })}
              <button type="submit" class="btn btn-primary btn-xl w-100">${this.t('forgot.submit')}</button>
            </form>
          </div>
          <div data-panel="sent" class="d-none tw-text-center">
            <div class="success-badge tw-mx-auto tw-mb-4"><i class="bi bi-envelope-check"></i></div>
            <h1 class="page-heading">${this.t('forgot.sentTitle')}</h1>
            <p class="tw-text-muted" data-sent-body></p>
            <a href="#/login" class="btn btn-primary btn-xl w-100 tw-mt-4">${this.t('forgot.back')}</a>
          </div>
        </div>
      </div>`;
  }

  bind() {
    this.bindForm(async ({ email }) => {
      await this.app.auth.sendPasswordReset(email);
      this.$('[data-panel=form]').classList.add('d-none');
      this.$('[data-panel=sent]').classList.remove('d-none');
      this.$('[data-sent-body]').textContent = this.t('forgot.sentBody', { email: AuthRules.normalizeEmail(email) });
    });
  }
}
