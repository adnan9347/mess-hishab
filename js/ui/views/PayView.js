import { View } from '../View.js';
import { AmountKeypad, backButton } from '../components.js';
import { esc, haptic } from '../../core/util.js';

const METHODS = [
  { id: 'bkash', label: 'bKash', icon: 'bi-phone' },
  { id: 'nagad', label: 'Nagad', icon: 'bi-phone-flip' },
  { id: 'cash', labelKey: 'pay.cash', icon: 'bi-cash-coin' }
];
const QUICK = [500, 1000, 2000, 3000];

/** Jakob's Law: looks and behaves like the bKash / Nagad send-money screen people already know. */
export class PayView extends View {
  static live = false;
  static ownHeading = true;

  constructor(app, params) {
    super(app, params);
    this.method = 'bkash';
    this.amount = 0;
  }

  title() {
    return this.t('pay.title');
  }

  render() {
    return `
      <div class="narrow-page">
        <div class="tw-flex tw-items-center tw-gap-3 tw-mb-2">
          ${backButton(this.t('common.back'), 'hishab')}
          <h1 class="page-heading tw-mb-0">${this.t('pay.title')}</h1>
        </div>
        <div data-panel="form">
          <p class="tw-text-muted tw-text-sm">${this.t(this.app.isManager ? 'pay.subtitleManager' : 'pay.subtitle')}</p>
          <div class="surface-card tw-p-4 sm:tw-p-6">
            <div data-keypad></div>
            <div class="quick-amounts tw-mt-3">
              ${QUICK.map((a) => `<button type="button" class="chip" data-quick="${a}">${this.i18n.money(a)}</button>`).join('')}
            </div>
          </div>

          <div class="tw-mt-5">
            <div class="eyebrow tw-mb-2">${this.t('pay.method')}</div>
            <div class="method-grid" role="radiogroup" aria-label="${esc(this.t('pay.method'))}">
              ${METHODS.map((m) => `
                <button type="button" class="method method--${m.id} ${m.id === this.method ? 'is-active' : ''}" role="radio"
                  aria-checked="${m.id === this.method}" data-method="${m.id}">
                  <span class="method__dot"><i class="bi ${m.icon}"></i></span>
                  <span>${m.label ?? this.t(m.labelKey)}</span>
                </button>`).join('')}
            </div>
          </div>

          <div class="field tw-mt-4" data-trx>
            <label class="form-label" for="trx">${this.t('pay.trx')} <span class="tw-text-muted tw-font-normal">(${this.t('common.optional')})</span></label>
            <input id="trx" class="form-control form-control-lg tw-uppercase" maxlength="20" autocomplete="off" spellcheck="false" placeholder="9K4F7XQ2">
          </div>

          <button type="button" class="btn btn-primary btn-xl w-100 tw-mt-6 sticky-cta" data-action="submit" disabled>
            ${this.t('pay.submit')}
          </button>
        </div>
        <div data-panel="done" class="d-none tw-text-center tw-pt-8">
          <div class="success-badge tw-mx-auto tw-mb-4 pop-in"><i class="bi bi-check-lg"></i></div>
          <h2 class="page-heading" data-done-title></h2>
          <p class="tw-text-muted" data-done-body></p>
          <a href="#/hishab" class="btn btn-primary btn-xl w-100 tw-mt-4">${this.t('pay.backToHishab')}</a>
        </div>
      </div>`;
  }

  bind() {
    this.keypad = new AmountKeypad(this.$('[data-keypad]'), {
      locale: this.i18n.locale,
      label: this.t('pay.amount'),
      onChange: (amount) => {
        this.amount = amount;
        const btn = this.$('[data-action=submit]');
        btn.disabled = !(amount > 0);
        btn.innerHTML = amount > 0 ? this.t('pay.submitAmount', { amount: this.i18n.money(amount) }) : this.t('pay.submit');
      }
    });
    this.addCleanup(() => this.keypad.destroy());

    this.on('click', '[data-quick]', (e, el) => {
      haptic(6);
      this.keypad.set(el.dataset.quick);
    });
    this.on('click', '[data-method]', (e, el) => {
      this.method = el.dataset.method;
      this.$$('[data-method]').forEach((b) => {
        b.classList.toggle('is-active', b === el);
        b.setAttribute('aria-checked', String(b === el));
      });
      this.$('[data-trx]').classList.toggle('d-none', this.method === 'cash');
    });
    this.on('click', '[data-action=submit]', (e, el) => this.submit(el));
  }

  async submit(btn) {
    if (!(this.amount > 0)) return;
    btn.disabled = true;
    const { app } = this;
    const trxId = this.method === 'cash' ? '' : this.$('#trx').value.trim().toUpperCase();
    try {
      const id = await app.repo.addDeposit(app.messId, app.monthId, {
        memberUid: app.uid,
        amount: this.amount,
        method: this.method,
        trxId
      });
      // The manager holds the fund, so their own deposit needs no second confirmation.
      if (app.isManager) await app.repo.setDepositStatus(app.messId, app.monthId, id, 'confirmed', app.uid);
      haptic(15);
      this.$('[data-panel=form]').classList.add('d-none');
      this.$('[data-panel=done]').classList.remove('d-none');
      this.$('[data-done-title]').textContent = this.t(app.isManager ? 'pay.doneTitleManager' : 'pay.doneTitle', {
        amount: this.i18n.money(this.amount)
      });
      this.$('[data-done-body]').textContent = this.t(app.isManager ? 'pay.doneBodyManager' : 'pay.doneBody');
      this.keypad.destroy();
    } catch (err) {
      console.error(err);
      app.toast(this.t('common.error'), 'danger');
      btn.disabled = false;
    }
  }
}
