import { View } from '../View.js';
import { segmented, avatar, moneyClass } from '../components.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { MEAL_SLOTS } from '../../domain/MealEntry.js';
import { esc, haptic } from '../../core/util.js';

const ICONS = { breakfast: 'bi-cup-hot', lunch: 'bi-sun', dinner: 'bi-moon-stars' };

/**
 * Hick's Law: three toggles and a guest stepper — no other decisions on this screen.
 * Fitts's Law: full-width 64px targets, pushed into the bottom thumb zone on phones.
 * Doherty Threshold: the tap flips instantly; the write happens in the background.
 */
export class TodayView extends View {
  constructor(app, params) {
    super(app, params);
    this.day = 'today';
  }

  title() {
    return this.t('nav.today');
  }

  get dateKey() {
    const today = DhakaDate.dateKey();
    return this.day === 'today' ? today : DhakaDate.addDays(today, 1);
  }

  tomorrowAvailable() {
    const tomorrow = DhakaDate.addDays(DhakaDate.dateKey(), 1);
    return tomorrow.slice(0, 7) === this.app.state.data?.mess?.currentMonth;
  }

  greeting() {
    const h = Math.floor(DhakaDate.minutesNow() / 60);
    if (h < 12) return 'today.morning';
    if (h < 17) return 'today.afternoon';
    return 'today.evening';
  }

  render() {
    const { app } = this;
    const firstName = esc(app.displayName().split(' ')[0]);
    const me = app.mySummary();
    const monthId = app.state.data.mess.currentMonth;
    // The manager closed this month early: jump to tomorrow if it belongs to the new month.
    if (this.day === 'today' && this.dateKey.slice(0, 7) !== monthId && this.tomorrowAvailable()) this.day = 'tomorrow';
    const outOfMonth = this.dateKey.slice(0, 7) !== monthId;
    const dayOptions = [{ value: 'today', label: this.t('today.today') }];
    if (this.tomorrowAvailable()) dayOptions.push({ value: 'tomorrow', label: this.t('today.tomorrow') });

    return `
      <div class="today">
        <div class="today__main">
          <section class="today__head">
            <div class="eyebrow">${this.i18n.date(this.dateKey, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <h1 class="page-heading tw-mt-1">${this.t(this.greeting(), { name: firstName })}</h1>
            <div class="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-mt-4">
              ${segmented('day', dayOptions, this.day, { label: this.t('today.whichDay') })}
            </div>
            <div class="tw-grid tw-grid-cols-2 tw-gap-3 tw-mt-5">
              <div class="mini-stat">
                <span class="mini-stat__label">${this.t('today.messTotal')}</span>
                <span class="mini-stat__value" data-mess-total>${this.i18n.meals(app.calc.mealsOn(this.dateKey))}</span>
              </div>
              <a href="#/hishab" class="mini-stat mini-stat--link">
                <span class="mini-stat__label">${this.t('today.myBalance')} <i class="bi bi-arrow-up-right"></i></span>
                <span class="mini-stat__value ${moneyClass(me.balance)}" data-my-balance>${this.i18n.money(me.balance, { sign: true })}</span>
              </a>
            </div>
          </section>

          <section class="today__meals" aria-label="${esc(this.t('today.mealsLabel'))}">
            ${outOfMonth
              ? `<div class="surface-card tw-p-5 tw-flex tw-gap-3 tw-items-start">
                   <i class="bi bi-calendar2-check tw-text-2xl tw-text-brand"></i>
                   <p class="tw-mb-0">${this.t('today.monthNotStarted', { month: this.i18n.monthName(monthId, { month: 'long' }) })}</p>
                 </div>`
              : `<p class="tw-text-sm tw-text-muted tw-mb-3" data-meal-hint>${this.t('today.tapHint')}</p>
                 <div class="tw-flex tw-flex-col tw-gap-3">${MEAL_SLOTS.map((slot) => this.toggle(slot)).join('')}</div>
                 ${this.guestRow()}`}
          </section>
        </div>

        <aside class="today__side d-none d-lg-block">
          <div class="surface-card tw-p-5">
            <div class="tw-flex tw-items-center tw-justify-between tw-mb-4">
              <h2 class="section-title tw-mb-0">${this.t('today.whoEats')}</h2>
              <span class="badge-soft">${this.i18n.meals(app.calc.mealsOn(this.dateKey))} ${this.t('common.meals')}</span>
            </div>
            <div data-who>${this.whoEats()}</div>
          </div>
        </aside>
      </div>`;
  }

  toggle(slot) {
    const entry = this.app.mealFor(this.app.uid, this.dateKey);
    const on = entry[slot];
    const locked = this.app.cutoffs.isLocked(slot, this.dateKey);
    const canEdit = !locked || this.app.isManager;
    const cutoff = this.app.state.data.mess.mealCutoffs?.[slot];
    const hint = locked
      ? this.app.isManager ? this.t('today.lockedManager') : this.t('today.locked')
      : this.day === 'today' ? this.t('today.until', { time: this.i18n.time(cutoff) }) : this.t('today.forTomorrow');
    return `
      <button type="button" class="meal-toggle ${on ? 'is-on' : ''} ${locked ? 'is-locked' : ''}" data-slot="${slot}"
        aria-pressed="${on}" ${canEdit ? '' : 'disabled'}>
        <span class="meal-toggle__icon"><i class="bi ${ICONS[slot]}"></i></span>
        <span class="meal-toggle__text">
          <span class="meal-toggle__label">${this.t(`meal.${slot}`)}</span>
          <span class="meal-toggle__hint">${locked ? '<i class="bi bi-lock-fill"></i> ' : ''}${hint}</span>
        </span>
        <span class="meal-toggle__check" aria-hidden="true"><i class="bi bi-check-lg"></i></span>
      </button>`;
  }

  guestRow() {
    const entry = this.app.mealFor(this.app.uid, this.dateKey);
    const locked = this.app.cutoffs.guestsLocked(this.dateKey) && !this.app.isManager;
    return `
      <div class="guest-row">
        <div>
          <div class="tw-font-semibold">${this.t('today.guests')}</div>
          <div class="tw-text-xs tw-text-muted">${this.t('today.guestsHint')}</div>
        </div>
        <div class="stepper" role="group" aria-label="${esc(this.t('today.guests'))}">
          <button type="button" class="stepper__btn" data-guest="-1" aria-label="−" ${locked || entry.guests === 0 ? 'disabled' : ''}><i class="bi bi-dash-lg"></i></button>
          <output class="stepper__value" aria-live="polite">${this.i18n.num(entry.guests)}</output>
          <button type="button" class="stepper__btn" data-guest="1" aria-label="+" ${locked || entry.guests >= 9 ? 'disabled' : ''}><i class="bi bi-plus-lg"></i></button>
        </div>
      </div>`;
  }

  whoEats() {
    const { app } = this;
    return app.state.data.members
      .filter((m) => m.active !== false)
      .map((m) => {
        const e = app.mealFor(m.uid, this.dateKey);
        const dots = MEAL_SLOTS.map((s) => `<span class="meal-dot ${e[s] ? 'is-on' : ''}" title="${esc(this.t(`meal.${s}`))}"></span>`).join('');
        return `
          <div class="list-row">
            ${avatar(m, 32)}
            <span class="tw-flex-1 tw-truncate tw-text-sm">${esc(m.displayName)}${m.uid === app.uid ? ` <span class="tw-text-muted">(${this.t('common.you')})</span>` : ''}</span>
            <span class="tw-flex tw-gap-1">${dots}</span>
            ${e.guests ? `<span class="badge-soft">+${this.i18n.num(e.guests)}</span>` : ''}
          </div>`;
      })
      .join('');
  }

  bind() {
    this.on('click', '[data-seg=day] .seg__btn', (e, el) => {
      this.day = el.dataset.value;
      this.update();
    });
    this.on('click', '.meal-toggle', (e, el) => {
      const slot = el.dataset.slot;
      const entry = this.app.mealFor(this.app.uid, this.dateKey).toggled(slot);
      // Optimistic UI: flip the button now, persist in the background.
      el.classList.toggle('is-on', entry[slot]);
      el.setAttribute('aria-pressed', String(entry[slot]));
      el.classList.remove('just-toggled');
      void el.offsetWidth;
      el.classList.add('just-toggled');
      haptic(entry[slot] ? 12 : 6);
      this.app.saveMeal(entry);
    });
    this.on('click', '[data-guest]', (e, el) => {
      const current = this.app.mealFor(this.app.uid, this.dateKey);
      const next = Math.max(0, Math.min(9, current.guests + Number(el.dataset.guest)));
      haptic(6);
      this.app.saveMeal(current.withGuests(next));
    });
  }

  /** Patch numbers in place instead of re-rendering, so toggle animations are never cut off. */
  onDataChange() {
    if (!this.root) return;
    const { app } = this;
    for (const el of this.$$('.meal-toggle')) {
      const on = app.mealFor(app.uid, this.dateKey)[el.dataset.slot];
      el.classList.toggle('is-on', on);
      el.setAttribute('aria-pressed', String(on));
    }
    const total = this.$('[data-mess-total]');
    if (total) total.textContent = this.i18n.meals(app.calc.mealsOn(this.dateKey));
    const bal = this.$('[data-my-balance]');
    if (bal) {
      const b = app.mySummary().balance;
      bal.textContent = this.i18n.money(b, { sign: true });
      bal.className = `mini-stat__value ${moneyClass(b)}`;
    }
    const guestRow = this.$('.guest-row');
    if (guestRow) guestRow.outerHTML = this.guestRow();
    const who = this.$('[data-who]');
    if (who) who.innerHTML = this.whoEats();
  }
}
