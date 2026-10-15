import { View } from '../View.js';
import { avatar, backButton, emptyState, moneyClass } from '../components.js';
import { StatementExporter } from '../StatementExporter.js';
import { RetentionPolicy } from '../../domain/RetentionPolicy.js';
import { FUND_ID } from '../../domain/SettlementStrategy.js';
import { esc } from '../../core/util.js';

/**
 * Peak-End Rule: the month ends on a calm, clear, shareable card —
 * one list of who pays whom, instead of an argument over a notebook.
 */
export class SettlementView extends View {
  static live = false;
  static ownHeading = true;

  constructor(app, params) {
    super(app, params);
    this.monthId = params.id;
    this.month = undefined;
    this.result = null;
    this.exporter = new StatementExporter(app.i18n);
  }

  title() {
    return this.t('settle.title');
  }

  render() {
    if (this.month === undefined) {
      return `<div class="narrow-page placeholder-glow"><span class="placeholder col-12 tw-rounded-3xl" style="height:420px"></span></div>`;
    }
    if (!this.month || this.month.status !== 'closed') {
      return `<div class="narrow-page">${backButton(this.t('common.back'), 'hishab')}${emptyState('bi-archive', this.t('settle.notFound'), this.t('settle.notFoundHint'))}</div>`;
    }
    const { app } = this;
    const m = this.month;
    const stats = m.stats ?? {};
    const r = this.result;
    const justClosed = this.params.id && app.state.justClosed === this.monthId;
    const name = (id) => (id === FUND_ID ? this.t('settle.fund') : app.memberName(id));
    const short = (id) => (id === FUND_ID ? this.t('settle.fund') : app.memberName(id).split(' ')[0]);
    const member = (id) => app.state.data.members.find((x) => x.uid === id) ?? { uid: id, displayName: name(id) };
    const days = RetentionPolicy.daysLeft(m.expireAt);
    const soon = RetentionPolicy.isExpiringSoon(m.expireAt);

    return `
      <div class="narrow-page">
        <div class="tw-flex tw-items-center tw-gap-3 tw-mb-4">
          ${backButton(this.t('common.back'), 'hishab')}
          <h1 class="page-heading tw-mb-0">${this.t('settle.title')}</h1>
        </div>

        ${soon ? `<div class="alert alert-warning tw-rounded-2xl tw-text-sm"><i class="bi bi-exclamation-triangle"></i> ${this.t('retention.warn', { n: this.i18n.num(days) })}</div>` : ''}

        <article class="settle-card" data-capture>
          <header class="settle-card__head">
            <div class="settle-card__check ${justClosed ? 'pop-in' : ''}"><i class="bi bi-check-lg"></i></div>
            <div class="tw-text-sm tw-opacity-80">${esc(app.state.data.mess.name)}</div>
            <div class="tw-text-2xl tw-font-bold">${this.t('settle.closed', { month: this.i18n.monthName(this.monthId) })}</div>
          </header>
          <div class="settle-card__stats">
            <div><span>${this.t('hishab.mealRate')}</span><strong>${this.i18n.money(stats.mealRate ?? 0, { decimals: 2 })}</strong></div>
            <div><span>${this.t('mess.totalMeals')}</span><strong>${this.i18n.meals(stats.totalMeals ?? 0)}</strong></div>
            <div><span>${this.t('mess.totalBazar')}</span><strong>${this.i18n.money(stats.totalBazar ?? 0)}</strong></div>
          </div>
          ${r ? `
            <div class="settle-card__mine">
              <span>${this.t('settle.yourResult')}</span>
              <strong class="${moneyClass(r.balance)}">${this.i18n.money(r.balance, { sign: true })}</strong>
            </div>` : ''}
          <div class="settle-card__body">
            <div class="eyebrow tw-mb-3">${this.t('settle.transfers')}</div>
            ${(m.settlement ?? []).length
              ? (m.settlement).map((t) => {
                  const mine = t.from === app.uid || t.to === app.uid;
                  return `
                    <div class="transfer ${mine ? 'is-mine' : ''}">
                      ${avatar(member(t.from), 32)}
                      <span class="transfer__names"><span class="tw-truncate" title="${esc(name(t.from))}">${esc(short(t.from))}</span><i class="bi bi-arrow-right"></i><span class="tw-truncate" title="${esc(name(t.to))}">${esc(short(t.to))}</span></span>
                      <strong>${this.i18n.money(t.amount)}</strong>
                    </div>`;
                }).join('')
              : `<p class="tw-text-sm tw-text-muted tw-mb-0">${this.t('settle.nothing')}</p>`}
          </div>
          <footer class="settle-card__foot">
            <i class="bi bi-shield-check"></i>
            ${this.t('settle.saved', { n: this.i18n.num(days), date: this.i18n.date(m.expireAt, { day: 'numeric', month: 'long' }) })}
          </footer>
        </article>

        <div class="tw-grid tw-grid-cols-3 tw-gap-3 tw-mt-5">
          <button type="button" class="btn btn-ghost btn-lg export-btn" data-export="png"><i class="bi bi-share"></i><span>${this.t('settle.share')}</span></button>
          <button type="button" class="btn btn-ghost btn-lg export-btn" data-export="pdf"><i class="bi bi-file-earmark-pdf"></i><span>PDF</span></button>
          <button type="button" class="btn btn-ghost btn-lg export-btn" data-export="csv" ${r ? '' : 'disabled'}><i class="bi bi-filetype-csv"></i><span>CSV</span></button>
        </div>
        ${justClosed ? `<a href="#/today" class="btn btn-primary btn-xl w-100 tw-mt-4">${this.t('settle.startNext', { month: this.i18n.monthName(app.monthId, { month: 'long' }) })}</a>` : ''}
      </div>`;
  }

  mount(root) {
    super.mount(root);
    if (this.month === undefined) this.load();
  }

  async load() {
    const { app } = this;
    try {
      const [month, results] = await Promise.all([
        app.repo.getMonth(app.messId, this.monthId),
        app.repo.listResults(app.messId, app.uid)
      ]);
      this.month = month;
      this.result = results.find((r) => r.monthId === this.monthId) ?? null;
    } catch (err) {
      console.error(err);
      this.month = null;
    }
    if (this.root) this.update();
  }

  bind() {
    this.on('click', '[data-export]', (e, el) => this.export(el.dataset.export, el));
  }

  async export(kind, btn) {
    const { app } = this;
    const base = `mess-hishab-${this.monthId}`;
    btn.disabled = true;
    try {
      if (kind === 'png') {
        const outcome = await this.exporter.sharePng(this.$('[data-capture]'), `${base}.png`, this.t('settle.title'));
        if (outcome === 'downloaded') app.toast(this.t('settle.downloaded'), 'success');
      } else if (kind === 'pdf') {
        await this.exporter.downloadPdf(this.$('[data-capture]'), `${base}.pdf`);
      } else if (kind === 'csv') {
        const meals = await app.repo.listMeals(app.messId, this.monthId, app.uid);
        this.exporter.downloadCsv({
          filename: `${base}-${app.uid}.csv`,
          meals,
          result: this.result,
          messName: app.state.data.mess.name,
          memberName: app.displayName()
        });
      }
    } catch (err) {
      console.error(err);
      app.toast(this.t('common.offlineChart'), 'danger');
    } finally {
      btn.disabled = false;
    }
  }
}
