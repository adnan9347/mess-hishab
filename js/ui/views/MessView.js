import { View } from '../View.js';
import { avatar, emptyState, moneyClass } from '../components.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { esc } from '../../core/util.js';

/**
 * Goal-Gradient: the fund bar shows deposits collected against the projected month cost.
 * Common Region + Similarity: one card per member, same owes/gets colours everywhere.
 */
export class MessView extends View {
  title() {
    return this.t('nav.mess');
  }

  render() {
    const { app } = this;
    const { mess, members, bazar } = app.state.data;
    const calc = app.calc;
    const monthId = mess.currentMonth;
    const today = DhakaDate.dateKey();
    const daysElapsed = today.slice(0, 7) === monthId ? Number(today.slice(8, 10)) : DhakaDate.daysInMonth(monthId);
    const goal = calc.projectedMonthCost(daysElapsed, DhakaDate.daysInMonth(monthId));
    const collected = calc.confirmedDeposits() + bazar.filter((b) => b.source === 'pocket').reduce((s, b) => s + Number(b.amount), 0);
    const pct = goal > 0 ? Math.min(100, Math.round((collected / goal) * 100)) : 0;
    const summaries = calc.summaries().filter((s) => members.find((m) => m.uid === s.uid)?.active !== false);

    return `
      <div class="page-grid">
        <section class="surface-card tw-p-5 page-grid__wide">
          <div class="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
            <div class="tw-min-w-0">
              <div class="eyebrow">${this.i18n.monthName(monthId)}</div>
              <h1 class="page-heading tw-mb-0 clamp-2">${esc(mess.name)}</h1>
            </div>
            <button type="button" class="chip" data-action="copy-code" aria-label="${esc(this.t('mess.copyCode'))}">
              <i class="bi bi-key"></i> ${esc(mess.inviteCode)} <i class="bi bi-copy tw-opacity-60"></i>
            </button>
          </div>

          <div class="fund tw-mt-5">
            <div class="tw-flex tw-items-end tw-justify-between tw-gap-3 tw-mb-2">
              <div>
                <div class="tw-text-sm tw-text-muted">${this.t('mess.fund')}</div>
                <div class="tw-text-2xl tw-font-bold">${this.i18n.money(collected)} <span class="tw-text-base tw-font-medium tw-text-muted">/ ${this.i18n.money(goal)}</span></div>
              </div>
              <span class="badge-soft">${this.i18n.num(pct)}%</span>
            </div>
            <div class="progress progress--fund" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${esc(this.t('mess.fund'))}">
              <div class="progress-bar" style="width:${pct}%"></div>
            </div>
            <p class="tw-text-xs tw-text-muted tw-mt-2 tw-mb-0">${this.t('mess.fundHint')}</p>
          </div>

          <div class="tw-grid tw-grid-cols-3 tw-gap-2 sm:tw-gap-3 tw-mt-5 stat-row-3">
            <div class="mini-stat"><span class="mini-stat__label">${this.t('hishab.mealRate')}</span><span class="mini-stat__value">${this.i18n.money(calc.mealRate, { decimals: 1 })}</span></div>
            <div class="mini-stat"><span class="mini-stat__label">${this.t('mess.totalMeals')}</span><span class="mini-stat__value">${this.i18n.meals(calc.totalMeals())}</span></div>
            <div class="mini-stat"><span class="mini-stat__label">${this.t('mess.totalBazar')}</span><span class="mini-stat__value">${this.i18n.money(calc.totalBazar())}</span></div>
          </div>
        </section>

        <section>
          <h2 class="section-title">${this.t('mess.members')} <span class="tw-text-muted tw-font-normal">· ${this.i18n.num(summaries.length)}</span></h2>
          <div class="tw-flex tw-flex-col tw-gap-2">
            ${summaries.map((s) => this.memberRow(s)).join('')}
          </div>
        </section>

        <section>
          <div class="tw-flex tw-items-center tw-justify-between">
            <h2 class="section-title">${this.t('mess.recentBazar')}</h2>
            ${app.isManager ? `<a href="#/bazar" class="link-brand tw-text-sm tw-font-semibold"><i class="bi bi-plus"></i> ${this.t('mess.addBazar')}</a>` : ''}
          </div>
          <div class="surface-card tw-px-4 tw-py-1">
            ${bazar.length ? bazar.slice(0, 8).map((b) => this.bazarRow(b)).join('') : emptyState('bi-basket', this.t('mess.noBazar'))}
          </div>
        </section>
      </div>`;
  }

  memberRow(s) {
    const { app } = this;
    const member = app.state.data.members.find((m) => m.uid === s.uid);
    const isManager = app.state.data.mess.managerUid === s.uid;
    const status = { owes: 'mess.owes', gets: 'mess.gets', settled: 'hishab.settled' }[s.status];
    return `
      <div class="member-card ${s.uid === app.uid ? 'is-me' : ''}">
        ${avatar(member, 40)}
        <div class="tw-flex-1 tw-min-w-0">
          <div class="tw-font-semibold tw-truncate">${esc(s.name)}${s.uid === app.uid ? ` <span class="tw-text-muted tw-font-normal">(${this.t('common.you')})</span>` : ''}</div>
          <div class="tw-text-xs tw-text-muted">${isManager ? `<span class="role-tag">${this.t('mess.manager')}</span> · ` : ''}${this.i18n.meals(s.meals)} ${this.t('common.meals')}</div>
        </div>
        <div class="tw-text-right">
          <div class="tw-font-bold ${moneyClass(s.balance)}">${this.i18n.money(Math.abs(s.balance))}</div>
          <div class="tw-text-xs tw-text-muted">${this.t(status)}</div>
        </div>
      </div>`;
  }

  bazarRow(b) {
    const shopper = this.app.memberName(b.shopperUid);
    return `
      <div class="list-row">
        <span class="list-row__icon"><i class="bi ${b.source === 'pocket' ? 'bi-person-check' : 'bi-basket2'}"></i></span>
        <div class="tw-flex-1 tw-min-w-0">
          <div class="tw-text-sm tw-font-medium tw-truncate">${esc(b.note || this.t('bazar.defaultNote'))}</div>
          <div class="tw-text-xs tw-text-muted tw-truncate">${esc(shopper)} · ${this.i18n.date(b.date)}${b.source === 'pocket' ? ` · ${this.t('bazar.pocketShort')}` : ''}</div>
        </div>
        <span class="tw-font-semibold">${this.i18n.money(b.amount)}</span>
      </div>`;
  }

  bind() {
    this.on('click', '[data-action=copy-code]', () => this.app.copyInviteCode());
  }
}
