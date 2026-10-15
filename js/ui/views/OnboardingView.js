import { View } from '../View.js';
import { esc } from '../../core/util.js';
import { RepoError } from '../../data/Repository.js';

/** Create or join a mess in three steps (Goal-Gradient: the step dots show how close you are). */
export class OnboardingView extends View {
  static layout = 'bare';
  static live = false;

  constructor(app, params) {
    super(app, params);
    this.step = 'choose';
  }

  stepIndex() {
    return { choose: 1, create: 2, join: 2, done: 3 }[this.step];
  }

  render() {
    const n = this.stepIndex();
    return `
      <div class="auth-page">
        <div class="auth-top">
          ${this.step === 'create' || this.step === 'join'
            ? `<button type="button" class="icon-btn" data-action="back" aria-label="${esc(this.t('common.back'))}"><i class="bi bi-arrow-left"></i></button>`
            : '<span></span>'}
          <div class="step-dots" aria-label="${esc(this.t('onboarding.step', { n: this.i18n.num(n), total: this.i18n.num(3) }))}">
            ${[1, 2, 3].map((i) => `<span class="${i <= n ? 'is-done' : ''} ${i === n ? 'is-current' : ''}"></span>`).join('')}
          </div>
          <div class="tw-flex tw-items-center tw-gap-2">${this.app.localeSwitch()}${this.app.themeButton()}</div>
        </div>
        <div class="auth-card">${this[`${this.step}Panel`]()}</div>
      </div>`;
  }

  choosePanel() {
    const name = this.app.state.user?.displayName?.split(' ')[0] ?? '';
    return `
      <h1 class="page-heading">${this.t('onboarding.hello', { name: esc(name) })}</h1>
      <p class="tw-text-muted tw-mb-6">${this.t('onboarding.subtitle')}</p>
      <div class="tw-flex tw-flex-col tw-gap-3">
        <button type="button" class="choice-card" data-action="go" data-step="create">
          <span class="choice-card__icon"><i class="bi bi-house-add"></i></span>
          <span class="tw-text-left"><span class="tw-block tw-font-semibold">${this.t('onboarding.create')}</span><span class="tw-block tw-text-sm tw-text-muted">${this.t('onboarding.createHint')}</span></span>
          <i class="bi bi-chevron-right tw-ml-auto tw-text-muted"></i>
        </button>
        <button type="button" class="choice-card" data-action="go" data-step="join">
          <span class="choice-card__icon"><i class="bi bi-key"></i></span>
          <span class="tw-text-left"><span class="tw-block tw-font-semibold">${this.t('onboarding.join')}</span><span class="tw-block tw-text-sm tw-text-muted">${this.t('onboarding.joinHint')}</span></span>
          <i class="bi bi-chevron-right tw-ml-auto tw-text-muted"></i>
        </button>
      </div>
      <button type="button" class="btn btn-link tw-text-muted tw-text-sm w-100 tw-mt-6" data-action="logout">${this.t('settings.logout')}</button>`;
  }

  createPanel() {
    return `
      <h1 class="page-heading">${this.t('onboarding.createTitle')}</h1>
      <p class="tw-text-muted tw-mb-6">${this.t('onboarding.createSubtitle')}</p>
      <form novalidate class="tw-flex tw-flex-col tw-gap-4" data-form="create">
        <div class="field">
          <label class="form-label" for="mess-name">${this.t('onboarding.messName')}</label>
          <input id="mess-name" name="name" class="form-control form-control-lg" maxlength="60" autocomplete="off"
            placeholder="${esc(this.t('onboarding.messNamePlaceholder'))}" required>
          <div class="invalid-feedback">${this.t('onboarding.messNameRequired')}</div>
        </div>
        <div class="alert alert-danger d-none tw-text-sm" data-error role="alert"></div>
        <button type="submit" class="btn btn-primary btn-xl w-100">${this.t('onboarding.createSubmit')}</button>
      </form>`;
  }

  joinPanel() {
    return `
      <h1 class="page-heading">${this.t('onboarding.joinTitle')}</h1>
      <p class="tw-text-muted tw-mb-6">${this.t('onboarding.joinSubtitle')}</p>
      <form novalidate data-form="join">
        <div class="code-boxes" role="group" aria-label="${esc(this.t('onboarding.codeLabel'))}">
          ${Array.from({ length: 6 }, (_, i) => `<input class="code-box" maxlength="1" inputmode="text" autocapitalize="characters" autocomplete="one-time-code" aria-label="${i + 1}" data-i="${i}">`).join('')}
        </div>
        <div class="alert alert-danger d-none tw-text-sm tw-mt-4" data-error role="alert"></div>
        <button type="submit" class="btn btn-primary btn-xl w-100 tw-mt-6" disabled>${this.t('onboarding.joinSubmit')}</button>
      </form>`;
  }

  donePanel() {
    const mess = this.app.state.data?.mess;
    const created = this.created;
    return `
      <div class="tw-text-center">
        <div class="success-badge tw-mx-auto tw-mb-4 pop-in"><i class="bi bi-check-lg"></i></div>
        <h1 class="page-heading">${created ? this.t('onboarding.createdTitle') : this.t('onboarding.joinedTitle', { mess: esc(mess?.name ?? '') })}</h1>
        <p class="tw-text-muted">${created ? this.t('onboarding.createdBody') : this.t('onboarding.joinedBody')}</p>
      </div>
      ${created && mess ? `
        <div class="invite-code tw-my-6">
          <div class="eyebrow tw-mb-2">${this.t('onboarding.inviteCode')}</div>
          <div class="invite-code__value">${esc(mess.inviteCode)}</div>
        </div>
        <div class="tw-grid tw-grid-cols-2 tw-gap-3 tw-mb-3">
          <button type="button" class="btn btn-ghost btn-lg" data-action="copy-code"><i class="bi bi-copy"></i> ${this.t('common.copy')}</button>
          <a class="btn btn-whatsapp btn-lg" target="_blank" rel="noopener" href="${this.app.whatsappInviteLink()}"><i class="bi bi-whatsapp"></i> WhatsApp</a>
        </div>` : ''}
      <button type="button" class="btn btn-primary btn-xl w-100 tw-mt-3" data-action="finish">${this.t('onboarding.start')}</button>`;
  }

  setStep(step) {
    this.step = step;
    this.update();
    this.$('input')?.focus();
  }

  bind() {
    this.on('click', '[data-action=go]', (e, el) => this.setStep(el.dataset.step));
    this.on('click', '[data-action=back]', () => this.setStep('choose'));
    this.on('click', '[data-action=logout]', () => this.app.auth.signOut());
    this.on('click', '[data-action=finish]', () => this.app.router.go('today'));
    this.on('click', '[data-action=copy-code]', () => this.app.copyInviteCode());

    this.on('submit', '[data-form=create]', async (e) => {
      e.preventDefault();
      const input = this.$('#mess-name');
      if (input.value.trim().length < 2) return input.classList.add('is-invalid');
      await this.withBusy(async () => {
        const messId = await this.app.repo.createMess(this.app.state.user.uid, {
          name: input.value.trim(),
          displayName: this.app.displayName()
        });
        await this.app.selectMess(messId);
        this.created = true;
      });
    });

    if (this.step === 'join') this.bindCodeBoxes();
    this.on('submit', '[data-form=join]', async (e) => {
      e.preventDefault();
      const code = this.$$('.code-box').map((b) => b.value).join('');
      if (code.length !== 6) return;
      await this.withBusy(async () => {
        const messId = await this.app.repo.joinMess(this.app.state.user.uid, code, this.app.displayName());
        await this.app.selectMess(messId);
        this.created = false;
      });
    });
  }

  async withBusy(fn) {
    const btn = this.$('[type=submit]');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    try {
      await fn();
      this.setStep('done');
    } catch (err) {
      const box = this.$('[data-error]');
      box.textContent = this.t(err instanceof RepoError && err.code === 'invalid-code' ? 'onboarding.invalidCode' : 'common.error');
      box.classList.remove('d-none');
      btn.disabled = false;
      btn.innerHTML = label;
      this.$$('.code-box').forEach((b) => b.classList.add('is-invalid'));
    }
  }

  /** Six boxes with auto-advance, backspace-to-previous and paste of the whole code. */
  bindCodeBoxes() {
    const boxes = this.$$('.code-box');
    const submit = this.$('[data-form=join] [type=submit]');
    const sync = () => {
      submit.disabled = boxes.some((b) => !b.value);
      boxes.forEach((b) => b.classList.remove('is-invalid'));
      this.$('[data-error]').classList.add('d-none');
    };
    const fill = (text, from = 0) => {
      const chars = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6 - from).split('');
      chars.forEach((ch, k) => (boxes[from + k].value = ch));
      boxes[Math.min(from + chars.length, 5)].focus();
      sync();
      if (boxes.every((b) => b.value)) this.$('[data-form=join]').requestSubmit();
    };
    boxes.forEach((box, i) => {
      box.addEventListener('input', () => {
        const v = box.value;
        box.value = '';
        if (v) fill(v, i);
        else sync();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && i > 0) {
          boxes[i - 1].value = '';
          boxes[i - 1].focus();
          sync();
          e.preventDefault();
        }
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        fill(e.clipboardData.getData('text'), i);
      });
    });
    boxes[0].focus();
  }
}
