import { View } from '../View.js';
import { AmountKeypad, avatar, backButton, segmented } from '../components.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { esc, haptic } from '../../core/util.js';

/** Tesler's Law: sensible defaults (today, you as shopper, paid from fund) — usually only the amount is typed. */
export class BazarView extends View {
  static live = false;
  static ownHeading = true;

  constructor(app, params) {
    super(app, params);
    this.shopper = app.uid;
    this.source = 'fund';
    this.amount = 0;
  }

  title() {
    return this.t('bazar.title');
  }

  render() {
    const { app } = this;
    const members = app.state.data.members.filter((m) => m.active !== false);
    const monthId = app.monthId;
    const today = DhakaDate.dateKey();
    const max = today.slice(0, 7) === monthId ? today : `${monthId}-${DhakaDate.daysInMonth(monthId)}`;
    const suggestions = this.t('bazar.suggestions').split('|');

    return `
      <div class="narrow-page">
        <div class="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          ${backButton(this.t('common.back'), 'mess')}
          <h1 class="page-heading tw-mb-0">${this.t('bazar.title')}</h1>
        </div>

        <div class="surface-card tw-p-4 sm:tw-p-6">
          <div data-keypad></div>
        </div>

        <div class="tw-mt-5">
          <div class="eyebrow tw-mb-2">${this.t('bazar.shopper')}</div>
          <div class="shopper-scroll" role="radiogroup" aria-label="${esc(this.t('bazar.shopper'))}">
            ${members.map((m) => `
              <button type="button" class="shopper ${m.uid === this.shopper ? 'is-active' : ''}" role="radio" aria-checked="${m.uid === this.shopper}" data-shopper="${m.uid}">
                ${avatar(m, 44)}
                <span class="shopper__name">${esc(m.uid === app.uid ? this.t('common.you') : m.displayName.split(' ')[0])}</span>
              </button>`).join('')}
          </div>
        </div>

        <div class="tw-mt-5">
          <div class="eyebrow tw-mb-2">${this.t('bazar.paidFrom')}</div>
          ${segmented('source', [
            { value: 'fund', label: this.t('bazar.fromFund'), icon: 'bi-safe' },
            { value: 'pocket', label: this.t('bazar.fromPocket'), icon: 'bi-person' }
          ], this.source, { label: this.t('bazar.paidFrom'), size: 'seg--block' })}
          <p class="tw-text-xs tw-text-muted tw-mt-2 tw-mb-0" data-source-hint>${this.t(`bazar.${this.source}Hint`)}</p>
        </div>

        <div class="tw-grid sm:tw-grid-cols-2 tw-gap-4 tw-mt-5">
          <div class="field">
            <label class="form-label" for="b-note">${this.t('bazar.note')} <span class="tw-text-muted tw-font-normal">(${this.t('common.optional')})</span></label>
            <input id="b-note" class="form-control form-control-lg" maxlength="80" placeholder="${esc(suggestions[0])}">
          </div>
          <div class="field">
            <label class="form-label" for="b-date">${this.t('bazar.date')}</label>
            <input id="b-date" type="date" class="form-control form-control-lg" value="${max}" min="${monthId}-01" max="${max}">
          </div>
        </div>
        <div class="tw-flex tw-flex-wrap tw-gap-2 tw-mt-3">
          ${suggestions.map((s) => `<button type="button" class="chip chip--sm" data-note="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>

        <button type="button" class="btn btn-primary btn-xl w-100 tw-mt-6 sticky-cta" data-action="save" disabled>${this.t('bazar.save')}</button>
      </div>`;
  }

  bind() {
    this.keypad = new AmountKeypad(this.$('[data-keypad]'), {
      locale: this.i18n.locale,
      label: this.t('bazar.amount'),
      onChange: (amount) => {
        this.amount = amount;
        const btn = this.$('[data-action=save]');
        btn.disabled = !(amount > 0);
        btn.textContent = amount > 0 ? this.t('bazar.saveAmount', { amount: this.i18n.money(amount) }) : this.t('bazar.save');
      }
    });
    this.addCleanup(() => this.keypad.destroy());

    this.on('click', '[data-shopper]', (e, el) => {
      this.shopper = el.dataset.shopper;
      this.$$('[data-shopper]').forEach((b) => {
        b.classList.toggle('is-active', b === el);
        b.setAttribute('aria-checked', String(b === el));
      });
    });
    this.on('click', '[data-seg=source] .seg__btn', (e, el) => {
      this.source = el.dataset.value;
      this.$$('[data-seg=source] .seg__btn').forEach((b) => {
        b.classList.toggle('is-active', b === el);
        b.setAttribute('aria-checked', String(b === el));
      });
      this.$('[data-source-hint]').textContent = this.t(`bazar.${this.source}Hint`);
    });
    this.on('click', '[data-note]', (e, el) => {
      this.$('#b-note').value = el.dataset.note;
    });
    this.on('click', '[data-action=save]', (e, el) => this.save(el));
  }

  async save(btn) {
    if (!(this.amount > 0)) return;
    btn.disabled = true;
    const { app } = this;
    try {
      await app.repo.addBazar(app.messId, app.monthId, {
        shopperUid: this.shopper,
        amount: this.amount,
        source: this.source,
        note: this.$('#b-note').value.trim(),
        date: this.$('#b-date').value || DhakaDate.dateKey(),
        createdBy: app.uid
      });
      haptic(15);
      app.toast(this.t('bazar.saved', { amount: this.i18n.money(this.amount) }), 'success');
      app.router.go('mess');
    } catch (err) {
      console.error(err);
      app.toast(this.t('common.error'), 'danger');
      btn.disabled = false;
    }
  }
}
