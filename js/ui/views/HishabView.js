import { View } from '../View.js';
import { ring, animateRings, segmented, emptyState, moneyClass } from '../components.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { RetentionPolicy } from '../../domain/RetentionPolicy.js';
import { countUp, loadScript, esc } from '../../core/util.js';

const CHART_JS = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js';

/**
 * Zeigarnik Effect: the dues ring stays open until your balance is cleared.
 * Miller's Law: five stat chunks, never a wall of numbers.
 */
export class HishabView extends View {
  constructor(app, params) {
    super(app, params);
    this.metric = 'balance';
    this.snapshots = null;
    this.results = null;
  }

  title() {
    return this.t('nav.hishab');
  }

  render() {
    const me = this.app.mySummary();
    const tone = me.status === 'owes' ? 'danger' : 'brand';
    const label = { owes: 'hishab.youOwe', gets: 'hishab.youGet', settled: 'hishab.settled' }[me.status];
    const stats = [
      ['hishab.meals', this.i18n.meals(me.meals), 'bi-egg-fried'],
      ['hishab.mealRate', this.i18n.money(me.mealRate, { decimals: 2 }), 'bi-calculator'],
      ['hishab.mealCost', this.i18n.money(me.mealCost), 'bi-basket'],
      ['hishab.fixedShare', this.i18n.money(me.fixedShare), 'bi-lightning-charge'],
      ['hishab.paid', this.i18n.money(me.paid), 'bi-wallet2']
    ];
    const month = this.app.state.data.mess.currentMonth;

    return `
      <div class="page-grid">
        <section class="surface-card hishab-hero">
          <div class="eyebrow tw-text-center">${this.i18n.monthName(month)}</div>
          <div class="ring-wrap tw-my-4">
            ${ring(me.coverage, { size: 184, stroke: 14, tone })}
            <div class="ring-wrap__center">
              <span class="tw-text-sm tw-text-muted">${this.t(label)}</span>
              <span class="ring-wrap__value ${moneyClass(me.balance)}" data-balance>${this.i18n.money(0)}</span>
              <span class="tw-text-xs tw-text-muted">${this.t('hishab.covered', { pct: this.i18n.num(Math.round(me.coverage * 100)) })}</span>
            </div>
          </div>
          ${me.pending > 0 ? `<p class="tw-text-center tw-text-sm tw-mb-3"><span class="badge-soft badge-soft--warning"><i class="bi bi-hourglass-split"></i> ${this.t('hishab.pending', { amount: this.i18n.money(me.pending) })}</span></p>` : ''}
          <a href="#/pay" class="btn btn-primary btn-xl w-100"><i class="bi bi-plus-circle"></i> ${this.t('hishab.pay')}</a>
        </section>

        <section class="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 tw-gap-3 stats-grid">
          ${stats
            .map(
              ([key, value, icon]) => `
            <div class="stat">
              <span class="stat__icon"><i class="bi ${icon}"></i></span>
              <span class="stat__label">${this.t(key)}</span>
              <span class="stat__value">${value}</span>
            </div>`
            )
            .join('')}
        </section>

        <section class="surface-card tw-p-5 page-grid__wide">
          <div class="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-mb-4">
            <div>
              <h2 class="section-title tw-mb-0">${this.t('hishab.last30')}</h2>
              <p class="tw-text-xs tw-text-muted tw-mb-0">${this.t('hishab.last30Hint')}</p>
            </div>
            ${segmented('metric', [
              { value: 'balance', label: this.t('hishab.balance') },
              { value: 'mealRate', label: this.t('hishab.mealRate') }
            ], this.metric, { label: this.t('hishab.last30'), size: 'seg--sm' })}
          </div>
          <div class="chart-box" data-chart>
            <div class="placeholder-glow"><span class="placeholder col-12 tw-rounded-xl" style="height:200px"></span></div>
          </div>
        </section>

        <section class="page-grid__wide">
          <h2 class="section-title">${this.t('hishab.pastMonths')}</h2>
          <div data-results class="tw-flex tw-flex-col tw-gap-3">
            <div class="placeholder-glow"><span class="placeholder col-12 tw-rounded-xl" style="height:76px"></span></div>
          </div>
        </section>
      </div>`;
  }

  bind() {
    animateRings(this.root);
    countUp(this.$('[data-balance]'), this.app.mySummary().balance, (v) => this.i18n.money(v, { sign: true }));
    this.on('click', '[data-seg=metric] .seg__btn', (e, el) => {
      this.metric = el.dataset.value;
      this.$$('[data-seg=metric] .seg__btn').forEach((b) => {
        b.classList.toggle('is-active', b === el);
        b.setAttribute('aria-checked', String(b === el));
      });
      this.drawChart();
    });
    this.loadHistory();
  }

  async loadHistory() {
    const { app } = this;
    const since = DhakaDate.addDays(DhakaDate.dateKey(), -29);
    try {
      [this.snapshots, this.results] = await Promise.all([
        app.repo.listSnapshots(app.messId, app.uid, since),
        app.repo.listResults(app.messId, app.uid)
      ]);
    } catch (err) {
      console.error(err);
      this.snapshots = [];
      this.results = [];
    }
    if (!this.root) return;
    this.renderResults();
    this.drawChart();
  }

  renderResults() {
    const box = this.$('[data-results]');
    if (!box) return;
    const live = (this.results ?? []).filter((r) => !RetentionPolicy.isExpired(r.expireAt));
    if (!live.length) {
      box.innerHTML = emptyState('bi-archive', this.t('hishab.noPast'), this.t('hishab.noPastHint'));
      return;
    }
    box.innerHTML = live
      .map((r) => {
        const soon = RetentionPolicy.isExpiringSoon(r.expireAt);
        const days = RetentionPolicy.daysLeft(r.expireAt);
        return `
          <a href="#/settlement/${esc(r.monthId)}" class="result-row ${soon ? 'is-expiring' : ''}">
            <span class="result-row__month">
              <span class="tw-font-semibold">${this.i18n.monthName(r.monthId)}</span>
              <span class="tw-text-xs ${soon ? 'tw-text-warning' : 'tw-text-muted'}">
                <i class="bi ${soon ? 'bi-exclamation-triangle' : 'bi-shield-check'}"></i>
                ${soon ? this.t('retention.expiresIn', { n: this.i18n.num(days) }) : this.t('retention.keptUntil', { date: this.i18n.date(r.expireAt, { day: 'numeric', month: 'short' }) })}
              </span>
            </span>
            <span class="tw-text-right">
              <span class="tw-block tw-font-bold ${moneyClass(r.balance)}">${this.i18n.money(r.balance, { sign: true })}</span>
              <span class="tw-text-xs tw-text-muted">${this.i18n.meals(r.meals)} ${this.t('common.meals')}</span>
            </span>
            <i class="bi bi-chevron-right tw-text-muted"></i>
          </a>`;
      })
      .join('');
  }

  async drawChart() {
    const box = this.$('[data-chart]');
    if (!box || !this.snapshots) return;
    if (this.snapshots.length < 2) {
      box.innerHTML = emptyState('bi-graph-up', this.t('hishab.chartEmpty'));
      return;
    }
    try {
      await loadScript(CHART_JS);
    } catch {
      box.innerHTML = emptyState('bi-wifi-off', this.t('common.offlineChart'));
      return;
    }
    if (!this.root) return;
    this.chart?.destroy();
    box.innerHTML = '<canvas aria-label="chart" role="img"></canvas>';
    const css = getComputedStyle(document.documentElement);
    const rgb = (v) => `rgb(${css.getPropertyValue(v).trim()})`;
    const rgba = (v, a) => `rgb(${css.getPropertyValue(v).trim()} / ${a})`;
    const values = this.snapshots.map((s) => s[this.metric]);
    const isBalance = this.metric === 'balance';
    const ctx = box.querySelector('canvas').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 220);
    gradient.addColorStop(0, rgba('--c-brand', 0.22));
    gradient.addColorStop(1, rgba('--c-brand', 0));
    const fmt = (v) => this.i18n.money(v, { decimals: isBalance ? 0 : 1 });

    this.chart = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: this.snapshots.map((s) => this.i18n.date(s.date, { day: 'numeric', month: 'short' })),
        datasets: [{
          data: values,
          borderColor: rgb('--c-brand'),
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: rgb('--c-brand')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: rgb('--c-raised'),
            titleColor: rgb('--c-text-2'),
            bodyColor: rgb('--c-text'),
            borderColor: rgb('--c-border'),
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: { label: (c) => fmt(c.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: rgb('--c-text-2'), maxTicksLimit: 6, font: { family: '"Anek Bangla", sans-serif' } } },
          y: {
            grid: { color: rgba('--c-border', 0.6) },
            border: { display: false },
            ticks: { color: rgb('--c-text-2'), maxTicksLimit: 5, callback: (v) => fmt(v), font: { family: '"Anek Bangla", sans-serif' } }
          }
        }
      }
    });
  }

  destroy() {
    this.chart?.destroy();
    super.destroy();
  }
}
