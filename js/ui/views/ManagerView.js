import { View } from '../View.js';
import { avatar, emptyState } from '../components.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { MEAL_SLOTS } from '../../domain/MealEntry.js';
import { Money } from '../../domain/Money.js';
import { FUND_ID } from '../../domain/SettlementStrategy.js';
import { esc, haptic } from '../../core/util.js';

/**
 * Serial Position Effect: the most urgent thing (pending payments) comes first,
 * the most consequential (closing the month) comes last.
 * Von Restorff: pending confirmations are the only highlighted block.
 */
export class ManagerView extends View {
  constructor(app, params) {
    super(app, params);
    this.editUid = app.uid;
    this.editDate = DhakaDate.dateKey().slice(0, 7) === app.monthId ? DhakaDate.dateKey() : `${app.monthId}-01`;
  }

  title() {
    return this.t('nav.manager');
  }

  render() {
    return `
      <div class="page-grid">
        <section class="page-grid__wide" data-section="pending">${this.pendingSection()}</section>
        <section>
          <h2 class="section-title">${this.t('manager.fixedCosts')}</h2>
          <div class="surface-card tw-p-4">
            <div data-section="fixed-list">${this.fixedList()}</div>
            <form class="fixed-form tw-mt-3" data-form="fixed" novalidate>
              <input class="form-control" name="label" maxlength="40" placeholder="${esc(this.t('manager.fixedLabel'))}" aria-label="${esc(this.t('manager.fixedLabel'))}" required>
              <input class="form-control" name="amount" inputmode="decimal" placeholder="${esc(this.t('manager.fixedAmount'))}" aria-label="${esc(this.t('manager.fixedAmount'))}" required>
              <button class="btn btn-primary" type="submit" aria-label="${esc(this.t('common.add'))}"><i class="bi bi-plus-lg"></i></button>
            </form>
            <div class="tw-flex tw-flex-wrap tw-gap-2 tw-mt-3">
              ${this.t('manager.fixedSuggestions').split('|').map((s) => `<button type="button" class="chip chip--sm" data-fixed-label="${esc(s)}">${esc(s)}</button>`).join('')}
            </div>
          </div>
        </section>
        <section>
          <h2 class="section-title">${this.t('manager.editMeals')}</h2>
          <div class="surface-card tw-p-4">
            <div class="tw-grid tw-grid-cols-2 tw-gap-3">
              <select class="form-select" data-edit="uid" aria-label="${esc(this.t('manager.member'))}">
                ${this.app.state.data.members.filter((m) => m.active !== false).map((m) => `<option value="${m.uid}" ${m.uid === this.editUid ? 'selected' : ''}>${esc(m.displayName)}</option>`).join('')}
              </select>
              <input type="date" class="form-control" data-edit="date" value="${this.editDate}" min="${this.app.monthId}-01"
                max="${this.app.monthId}-${DhakaDate.daysInMonth(this.app.monthId)}" aria-label="${esc(this.t('bazar.date'))}">
            </div>
            <div class="tw-mt-3" data-section="meal-edit">${this.mealEditor()}</div>
            <p class="tw-text-xs tw-text-muted tw-mt-3 tw-mb-0"><i class="bi bi-info-circle"></i> ${this.t('manager.editHint')}</p>
          </div>
        </section>
        <section class="page-grid__wide" data-section="close">${this.closeSection()}</section>
      </div>`;
  }

  pendingSection() {
    const pending = this.app.state.data.deposits.filter((d) => d.status === 'pending');
    const title = `<h2 class="section-title">${this.t('manager.pending')} ${pending.length ? `<span class="count-badge">${this.i18n.num(pending.length)}</span>` : ''}</h2>`;
    if (!pending.length) return `${title}<div class="surface-card">${emptyState('bi-check2-all', this.t('manager.noPending'))}</div>`;
    return `${title}
      <div class="attention-card">
        ${pending.map((d) => {
          const member = this.app.state.data.members.find((m) => m.uid === d.memberUid);
          return `
            <div class="pending-row">
              ${avatar(member, 40)}
              <div class="tw-flex-1 tw-min-w-0">
                <div class="tw-text-sm tw-font-medium tw-truncate">${esc(member?.displayName ?? '?')}</div>
                <div class="tw-text-lg tw-font-bold tw-leading-tight">${this.i18n.money(d.amount)}</div>
                <div class="tw-text-xs tw-text-muted tw-truncate">
                  <span class="method-tag method-tag--${d.method}">${d.method === 'cash' ? this.t('pay.cash') : d.method === 'bkash' ? 'bKash' : 'Nagad'}</span>
                  ${d.trxId ? ` · <span class="tw-font-mono">${esc(d.trxId)}</span>` : ''}
                </div>
              </div>
              <div class="tw-flex tw-gap-2">
                <button type="button" class="btn btn-icon btn-ghost" data-deposit="${d.id}" data-status="rejected" aria-label="${esc(this.t('manager.reject'))}"><i class="bi bi-x-lg"></i></button>
                <button type="button" class="btn btn-icon btn-primary" data-deposit="${d.id}" data-status="confirmed" aria-label="${esc(this.t('manager.confirm'))}"><i class="bi bi-check-lg"></i></button>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  fixedList() {
    const costs = this.app.state.data.fixedCosts;
    if (!costs.length) return `<p class="tw-text-sm tw-text-muted tw-mb-0">${this.t('manager.noFixed')}</p>`;
    const total = costs.reduce((s, f) => s + Number(f.amount), 0);
    return `
      ${costs.map((f) => `
        <div class="list-row">
          <span class="tw-flex-1 tw-text-sm">${esc(f.label)}</span>
          <span class="tw-font-semibold tw-text-sm">${this.i18n.money(f.amount)}</span>
          <button type="button" class="icon-btn icon-btn--sm" data-delete-fixed="${f.id}" aria-label="${esc(this.t('common.delete'))}"><i class="bi bi-trash3"></i></button>
        </div>`).join('')}
      <div class="list-row tw-font-semibold">
        <span class="tw-flex-1 tw-text-sm">${this.t('manager.perHead', { n: this.i18n.num(this.app.calc.activeMembers.length) })}</span>
        <span class="tw-text-sm">${this.i18n.money(total)} → ${this.i18n.money(this.app.calc.fixedShare)}</span>
        <span style="width:32px"></span>
      </div>`;
  }

  mealEditor() {
    const entry = this.app.mealFor(this.editUid, this.editDate);
    return `
      <div class="tw-grid tw-grid-cols-4 tw-gap-2">
        ${MEAL_SLOTS.map((slot) => `
          <button type="button" class="mini-toggle ${entry[slot] ? 'is-on' : ''}" data-edit-slot="${slot}" aria-pressed="${entry[slot]}">
            <span class="tw-text-xs">${this.t(`meal.${slot}`)}</span><i class="bi ${entry[slot] ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
          </button>`).join('')}
        <div class="mini-toggle mini-toggle--static">
          <span class="tw-text-xs">${this.t('today.guests')}</span>
          <span class="tw-flex tw-items-center tw-gap-2">
            <button type="button" class="icon-btn icon-btn--sm" data-edit-guest="-1" aria-label="−"><i class="bi bi-dash"></i></button>
            <span class="tw-font-semibold">${this.i18n.num(entry.guests)}</span>
            <button type="button" class="icon-btn icon-btn--sm" data-edit-guest="1" aria-label="+"><i class="bi bi-plus"></i></button>
          </span>
        </div>
      </div>`;
  }

  closeSection() {
    const calc = this.app.calc;
    const transfers = calc.settle(undefined, this.app.state.data.mess.managerUid);
    return `
      <h2 class="section-title">${this.t('manager.closeTitle')}</h2>
      <div class="surface-card tw-p-5">
        <div class="tw-flex tw-flex-col sm:tw-flex-row sm:tw-items-center tw-gap-4">
          <div class="tw-flex-1">
            <p class="tw-mb-1 tw-font-semibold">${this.t('manager.closeBody', { month: this.i18n.monthName(this.app.monthId) })}</p>
            <p class="tw-text-sm tw-text-muted tw-mb-0">${this.t('manager.closePreview', {
              rate: this.i18n.money(calc.mealRate, { decimals: 2 }),
              n: this.i18n.num(transfers.length),
              days: this.i18n.num(this.app.retention.days)
            })}</p>
          </div>
          <button type="button" class="btn btn-outline-danger btn-lg" data-action="close-month"><i class="bi bi-lock"></i> ${this.t('manager.closeButton')}</button>
        </div>
      </div>`;
  }

  bind() {
    this.on('click', '[data-deposit]', async (e, el) => {
      el.disabled = true;
      haptic(10);
      const { app } = this;
      await app.repo.setDepositStatus(app.messId, app.monthId, el.dataset.deposit, el.dataset.status, app.uid);
      app.toast(this.t(el.dataset.status === 'confirmed' ? 'manager.confirmed' : 'manager.rejected'), el.dataset.status === 'confirmed' ? 'success' : 'secondary');
    });

    this.on('click', '[data-fixed-label]', (e, el) => {
      const input = this.$('[data-form=fixed] [name=label]');
      input.value = el.dataset.fixedLabel;
      this.$('[data-form=fixed] [name=amount]').focus();
    });
    this.on('submit', '[data-form=fixed]', async (e) => {
      e.preventDefault();
      const form = e.target;
      const label = form.label.value.trim();
      const amount = Money.parse(form.amount.value);
      form.label.classList.toggle('is-invalid', !label);
      form.amount.classList.toggle('is-invalid', !(amount >= 0));
      if (!label || !(amount >= 0)) return;
      await this.app.repo.addFixedCost(this.app.messId, this.app.monthId, { label, amount });
      form.reset();
      form.label.focus();
    });
    this.on('click', '[data-delete-fixed]', async (e, el) => {
      const ok = await this.app.confirm({ title: this.t('manager.deleteFixed'), confirmText: this.t('common.delete'), danger: true });
      if (ok) await this.app.repo.deleteFixedCost(this.app.messId, this.app.monthId, el.dataset.deleteFixed);
    });

    this.on('change', '[data-edit]', (e, el) => {
      if (el.dataset.edit === 'uid') this.editUid = el.value;
      if (el.dataset.edit === 'date' && el.value) this.editDate = el.value;
      this.$('[data-section=meal-edit]').innerHTML = this.mealEditor();
    });
    this.on('click', '[data-edit-slot]', (e, el) => {
      haptic(8);
      this.app.saveMeal(this.app.mealFor(this.editUid, this.editDate).toggled(el.dataset.editSlot));
    });
    this.on('click', '[data-edit-guest]', (e, el) => {
      const entry = this.app.mealFor(this.editUid, this.editDate);
      this.app.saveMeal(entry.withGuests(Math.max(0, Math.min(9, entry.guests + Number(el.dataset.editGuest)))));
    });

    this.on('click', '[data-action=close-month]', () => this.closeMonth());
  }

  async closeMonth() {
    const { app } = this;
    const transfers = app.calc.settle(undefined, app.state.data.mess.managerUid);
    const name = (id) => (id === FUND_ID ? this.t('settle.fund') : app.memberName(id));
    const preview = transfers.length
      ? `<ul class="tw-list-none tw-p-0 tw-m-0 tw-flex tw-flex-col tw-gap-2">${transfers.map((t) => `<li class="tw-flex tw-justify-between tw-gap-3"><span>${esc(name(t.from))} → ${esc(name(t.to))}</span><strong>${this.i18n.money(t.amount)}</strong></li>`).join('')}</ul>`
      : `<p class="tw-mb-0">${this.t('settle.nothing')}</p>`;
    const ok = await app.confirm({
      title: this.t('manager.closeConfirmTitle', { month: this.i18n.monthName(app.monthId) }),
      body: `<p class="tw-text-sm tw-text-muted">${this.t('manager.closeConfirmBody', { days: this.i18n.num(app.retention.days) })}</p>${preview}`,
      confirmText: this.t('manager.closeButton'),
      danger: true
    });
    if (!ok) return;
    try {
      const monthId = await app.closeMonth();
      app.router.go('settlement', monthId);
    } catch (err) {
      console.error(err);
      app.toast(this.t('common.error'), 'danger');
    }
  }

  /** Keep half-typed fixed-cost input: patch the live sections only. */
  onDataChange() {
    if (!this.root) return;
    if (!this.app.isManager) return this.app.router.go('today');
    this.$('[data-section=pending]').innerHTML = this.pendingSection();
    this.$('[data-section=fixed-list]').innerHTML = this.fixedList();
    this.$('[data-section=meal-edit]').innerHTML = this.mealEditor();
    this.$('[data-section=close]').innerHTML = this.closeSection();
  }
}
