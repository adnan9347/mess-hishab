import { MODE, FIREBASE_CONFIG, FIREBASE_SDK_VERSION } from './config.js';
import { I18n } from './core/I18n.js';
import { Router } from './core/Router.js';
import { DhakaDate } from './core/DhakaDate.js';
import { esc, debounce } from './core/util.js';
import { LocalRepository } from './data/LocalRepository.js';
import { DemoSeeder, DEMO_MESS_ID, DEMO_UID, statsOf } from './data/DemoSeeder.js';
import { DemoAuthService } from './auth/DemoAuthService.js';
import { HishabCalculator } from './domain/HishabCalculator.js';
import { MealEntry, MealCutoffPolicy } from './domain/MealEntry.js';
import { RetentionPolicy } from './domain/RetentionPolicy.js';
import { avatar } from './ui/components.js';
import { WelcomeView, SignUpView, LoginView, ForgotView } from './ui/views/AuthViews.js';
import { OnboardingView } from './ui/views/OnboardingView.js';
import { TodayView } from './ui/views/TodayView.js';
import { HishabView } from './ui/views/HishabView.js';
import { PayView } from './ui/views/PayView.js';
import { MessView } from './ui/views/MessView.js';
import { BazarView } from './ui/views/BazarView.js';
import { ManagerView } from './ui/views/ManagerView.js';
import { SettlementView } from './ui/views/SettlementView.js';
import { SettingsView } from './ui/views/SettingsView.js';

/** guard: 'guest' = signed out only · 'auth' = signed in · 'mess' = in a mess · 'manager' = mess manager */
const ROUTES = {
  welcome: { View: WelcomeView, guard: 'guest' },
  signup: { View: SignUpView, guard: 'guest' },
  login: { View: LoginView, guard: 'guest' },
  forgot: { View: ForgotView, guard: 'guest' },
  onboarding: { View: OnboardingView, guard: 'auth' },
  today: { View: TodayView, guard: 'mess', tab: 'today' },
  hishab: { View: HishabView, guard: 'mess', tab: 'hishab' },
  pay: { View: PayView, guard: 'mess', tab: 'hishab' },
  mess: { View: MessView, guard: 'mess', tab: 'mess' },
  bazar: { View: BazarView, guard: 'manager', tab: 'mess' },
  manager: { View: ManagerView, guard: 'manager', tab: 'manager' },
  settlement: { View: SettlementView, guard: 'mess', tab: 'hishab' },
  settings: { View: SettingsView, guard: 'auth', tab: 'settings' }
};

const TABS = [
  { id: 'today', icon: 'bi-sun', iconOn: 'bi-sun-fill' },
  { id: 'hishab', icon: 'bi-pie-chart', iconOn: 'bi-pie-chart-fill' },
  { id: 'mess', icon: 'bi-house', iconOn: 'bi-house-fill' },
  { id: 'manager', icon: 'bi-clipboard-check', iconOn: 'bi-clipboard-check-fill', managerOnly: true },
  { id: 'settings', icon: 'bi-gear', iconOn: 'bi-gear-fill', desktopOnly: true }
];

/** The application: owns services and state, guards routes, renders the shell, and hands data to views. */
export class App {
  constructor(root) {
    this.root = root;
    this.i18n = new I18n();
    this.state = App.emptyState();
    this.view = null;
    this.verifyDismissed = false;
    this.cleanedMesses = new Set();
    this.lastSnapshotKey = '';
    this.saveSnapshotSoon = debounce(() => this.saveSnapshot(), 1500);
  }

  static emptyState() {
    return { user: null, profile: null, messId: null, data: null, justClosed: null };
  }

  // ---------------------------------------------------------------- boot

  async start() {
    this.renderSplash();
    await this.initServices();
    this.router = new Router(ROUTES, (route) => this.render(route));
    this.bindGlobalActions();
    this.i18n.addEventListener('change', () => {
      this.auth.setLanguage?.(this.i18n.locale);
      this.router.resolve();
    });
    window.addEventListener('online', () => this.updateOfflineChip());
    window.addEventListener('offline', () => this.updateOfflineChip());
    this.auth.onChange((user) => this.onAuthChange(user));
  }

  async initServices() {
    if (MODE === 'firebase') {
      const sdk = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
      const [{ initializeApp }, { FirestoreRepository }, { FirebaseAuthService }] = await Promise.all([
        import(`${sdk}/firebase-app.js`),
        import('./data/FirestoreRepository.js'),
        import('./auth/FirebaseAuthService.js')
      ]);
      const firebaseApp = initializeApp(FIREBASE_CONFIG);
      this.repo = await FirestoreRepository.create(firebaseApp);
      this.auth = await FirebaseAuthService.create(firebaseApp, this.i18n.locale);
    } else {
      this.repo = new LocalRepository();
      this.auth = new DemoAuthService();
    }
  }

  async onAuthChange(user) {
    this.unsubscribeMess?.();
    this.unsubscribeMess = null;
    if (!user) {
      this.state = App.emptyState();
      this.verifyDismissed = false;
      this.router.resolve();
      return;
    }
    this.state.user = user;
    this.booting = true;
    this.renderSplash();

    if (MODE === 'demo' && user.uid === DEMO_UID && !this.repo.hasMess(DEMO_MESS_ID)) {
      this.repo.mergeSeed(new DemoSeeder().build());
    }

    let profile = await this.repo.getProfile(user.uid);
    if (!profile) {
      profile = {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        locale: this.i18n.locale,
        messIds: []
      };
      await this.repo.saveProfile(user.uid, profile);
    } else {
      // Bring this device in line with the person's saved preferences.
      if (profile.locale) this.i18n.setLocale(profile.locale);
    }
    this.state.profile = profile;
    await this.selectMess(profile.messIds?.[0] ?? null);
    this.booting = false;
    const { name } = this.router.current();
    if (!name || ROUTES[name].guard === 'guest') this.router.replace(this.home());
    else this.router.resolve();
  }

  /** Subscribe to a mess; resolves once its first data arrives. */
  selectMess(messId) {
    this.unsubscribeMess?.();
    this.unsubscribeMess = null;
    this.state.messId = messId;
    this.state.data = null;
    this.lastSnapshotKey = '';
    if (!messId) return Promise.resolve();
    return new Promise((resolve) => {
      this.unsubscribeMess = this.repo.subscribeMess(messId, (data) => {
        this.onData(data);
        resolve();
      });
    });
  }

  onData(data) {
    if (!data?.mess) return;
    const waiting = !this.state.data;
    this.state.data = data;
    this.recalculate();
    if (waiting && !this.view) {
      // A splash screen was waiting for this data.
      if (!this.booting) this.router.resolve();
    } else {
      this.view?.onDataChange();
      this.refreshShell();
    }
    this.saveSnapshotSoon();
    if (this.isManager && !this.cleanedMesses.has(this.messId)) {
      this.cleanedMesses.add(this.messId);
      this.repo.cleanupExpired(this.messId).catch((err) => console.warn('[retention] cleanup skipped', err));
    }
  }

  recalculate() {
    const { members, meals, bazar, fixedCosts, deposits, mess } = this.state.data;
    this.calc = new HishabCalculator({ members, meals, bazar, fixedCosts, deposits, weights: mess.mealWeights });
  }

  // ---------------------------------------------------------------- state helpers

  get uid() {
    return this.state.user?.uid;
  }

  get messId() {
    return this.state.messId;
  }

  get monthId() {
    return this.state.data?.mess.currentMonth;
  }

  get isManager() {
    return Boolean(this.state.data && this.state.data.mess.managerUid === this.uid);
  }

  get cutoffs() {
    return new MealCutoffPolicy(this.state.data?.mess.mealCutoffs);
  }

  get retention() {
    return RetentionPolicy.from(this.state.data?.mess.retentionDays);
  }

  home() {
    return this.state.messId ? 'today' : 'onboarding';
  }

  displayName() {
    const u = this.state.user;
    return u?.displayName || this.state.profile?.displayName || u?.email?.split('@')[0] || '';
  }

  memberName(uid) {
    return this.state.data?.members.find((m) => m.uid === uid)?.displayName ?? '—';
  }

  mySummary() {
    return this.calc.summaryFor(this.uid);
  }

  mealFor(uid, date) {
    const found = this.state.data?.meals.find((m) => m.memberUid === uid && m.date === date);
    return found ? new MealEntry(found) : MealEntry.empty(uid, date);
  }

  // ---------------------------------------------------------------- actions

  /** Optimistic write (Doherty Threshold): update the screen first, then persist. */
  async saveMeal(entry) {
    if (entry.date.slice(0, 7) !== this.monthId) return this.toast(this.t('today.otherMonth'), 'secondary');
    const data = this.state.data;
    const previous = data.meals;
    data.meals = [...previous.filter((m) => !(m.memberUid === entry.memberUid && m.date === entry.date)), entry.toJSON()];
    this.recalculate();
    this.view?.onDataChange();
    try {
      await this.repo.setMeal(this.messId, this.monthId, entry);
    } catch (err) {
      console.error(err);
      data.meals = previous;
      this.recalculate();
      this.view?.onDataChange();
      this.toast(this.t('common.error'), 'danger');
    }
  }

  async closeMonth() {
    const calc = this.calc;
    const monthId = this.monthId;
    const settlement = calc.settle(undefined, this.state.data.mess.managerUid);
    const results = calc.summaries().map((s) => ({
      ...s.toJSON(),
      settlementLines: settlement.filter((t) => t.from === s.uid || t.to === s.uid)
    }));
    // Usually next month; if the manager closes late, jump straight to the current calendar month.
    const next = DhakaDate.nextMonthKey(monthId);
    const nextMonthId = DhakaDate.monthKey() > next ? DhakaDate.monthKey() : next;
    await this.repo.closeMonth(this.messId, monthId, {
      results,
      settlement,
      stats: statsOf(calc),
      retentionDays: this.retention.days,
      nextMonthId
    });
    this.state.justClosed = monthId;
    return monthId;
  }

  /** Daily snapshot of my numbers, kept 30 days — powers the "last 30 days" chart. */
  async saveSnapshot() {
    if (!this.state.data || this.state.data.month?.status !== 'open') return;
    const s = this.mySummary();
    const snapshot = {
      uid: this.uid,
      date: DhakaDate.dateKey(),
      monthId: this.monthId,
      meals: s.meals,
      mealRate: s.mealRate,
      mealCost: s.mealCost,
      fixedShare: s.fixedShare,
      paid: s.paid,
      balance: s.balance
    };
    const key = JSON.stringify(snapshot);
    if (key === this.lastSnapshotKey) return;
    this.lastSnapshotKey = key;
    try {
      await this.repo.upsertSnapshot(this.messId, snapshot);
    } catch (err) {
      console.warn('[snapshot]', err);
    }
  }

  setLocale(locale) {
    this.i18n.setLocale(locale);
    if (this.uid) this.repo.saveProfile(this.uid, { locale }).catch(() => {});
  }


  async copyInviteCode() {
    const code = this.state.data?.mess.inviteCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.toast(this.t('common.copied', { code }), 'success');
    } catch {
      this.toast(code, 'secondary');
    }
  }

  whatsappInviteLink() {
    const mess = this.state.data?.mess;
    const url = `${location.origin}${location.pathname}`;
    return `https://wa.me/?text=${encodeURIComponent(this.t('invite.message', { mess: mess?.name ?? '', code: mess?.inviteCode ?? '', url }))}`;
  }

  async resetDemo() {
    this.repo.mergeSeed(new DemoSeeder().build());
    await this.selectMess(DEMO_MESS_ID);
    this.router.go('today');
    this.toast(this.t('settings.resetDone'), 'success');
  }

  t(key, params) {
    return this.i18n.t(key, params);
  }

  // ---------------------------------------------------------------- rendering

  render(route) {
    if (!this.auth?.ready || this.booting) return this.renderSplash();
    const user = this.state.user;
    if (!route.name) return this.router.replace(user ? this.home() : 'welcome');

    const def = ROUTES[route.name];
    if (!user && def.guard !== 'guest') return this.router.replace('welcome');
    if (user && def.guard === 'guest') return this.router.replace(this.home());
    if ((def.guard === 'mess' || def.guard === 'manager') && !this.state.messId) return this.router.replace('onboarding');
    if (route.name === 'onboarding' && this.state.messId && !(this.view instanceof OnboardingView)) return this.router.replace('today');
    if (this.state.messId && !this.state.data && def.guard !== 'guest') return this.renderSplash();
    if (def.guard === 'manager' && !this.isManager) return this.router.replace('today');

    this.view?.destroy();
    const view = new def.View(this, route.params);
    this.view = view;

    let container;
    if (def.View.layout === 'bare') {
      this.root.innerHTML = '<main id="main" tabindex="-1" class="bare-main"></main>';
      container = this.root.querySelector('#main');
    } else {
      this.root.innerHTML = this.shell(def.tab, view);
      container = this.root.querySelector('#view');
    }
    view.mount(container);
    document.title = `${view.title() ? `${view.title()} · ` : ''}${this.t('app.name')}`;
    window.scrollTo({ top: 0 });
    this.root.querySelector('#main')?.focus({ preventScroll: true });
    this.updateOfflineChip();
  }

  renderSplash() {
    this.view?.destroy();
    this.view = null;
    this.root.innerHTML = `
      <div class="splash" role="status" aria-live="polite">
        <span class="brand-mark__logo brand-mark__logo--lg"><i class="bi bi-journal-check"></i></span>
        <span class="visually-hidden">${this.t('common.loading')}</span>
      </div>`;
  }

  shell(activeTab, view) {
    const data = this.state.data;
    const mess = data?.mess;
    const pending = this.isManager ? data.deposits.filter((d) => d.status === 'pending').length : 0;
    const showFab = this.isManager && (activeTab === 'mess' || activeTab === 'manager');
    return `
      <a class="visually-hidden-focusable skip-link" href="#main">${this.t('common.skip')}</a>
      <div class="shell">
        <aside class="sidebar">
          <div class="brand-mark"><span class="brand-mark__logo"><i class="bi bi-journal-check"></i></span><span>${this.t('app.name')}</span></div>
          ${mess ? `<div class="sidebar__mess"><div class="tw-text-xs tw-text-muted">${this.i18n.monthName(mess.currentMonth)}</div><div class="tw-font-semibold tw-truncate">${esc(mess.name)}</div></div>` : ''}
          <nav class="sidebar__nav" aria-label="${esc(this.t('nav.label'))}" data-nav="side">${this.navLinks(activeTab, pending, 'side')}</nav>
          <div class="sidebar__foot">${this.localeSwitch()}</div>
        </aside>
        <div class="shell__main">
          <header class="topbar">
            <div class="topbar__title">
              ${view.constructor.ownHeading
                ? `<div class="tw-font-semibold tw-truncate lg:tw-hidden">${esc(mess?.name ?? this.t('app.name'))}</div>`
                : `${mess ? `<div class="tw-text-xs tw-text-muted tw-truncate lg:tw-hidden">${esc(mess.name)}</div>` : ''}
              <div class="tw-font-semibold tw-truncate">${esc(view.title())}</div>`}
            </div>
            <div class="topbar__actions">
              <span class="offline-chip d-none" data-offline><i class="bi bi-cloud-slash"></i> ${this.t('common.offline')}</span>
              <a href="#/settings" class="avatar-link" aria-label="${esc(this.t('nav.settings'))}">${avatar({ uid: this.uid, displayName: this.displayName() }, 36)}</a>
            </div>
          </header>
          ${this.verifyBanner()}
          <main id="main" tabindex="-1" class="content"><div id="view"></div></main>
        </div>
        <nav class="bottom-nav" aria-label="${esc(this.t('nav.label'))}" data-nav="bottom">${this.navLinks(activeTab, pending, 'bottom')}</nav>
        ${showFab ? `<a href="#/bazar" class="fab" aria-label="${esc(this.t('mess.addBazar'))}"><i class="bi bi-plus-lg"></i><span class="fab__label">${this.t('nav.bazar')}</span></a>` : ''}
      </div>`;
  }

  navLinks(activeTab, pending, variant) {
    return TABS.filter((tab) => (!tab.managerOnly || this.isManager) && (variant === 'side' || !tab.desktopOnly))
      .filter((tab) => this.state.messId || tab.id === 'settings')
      .map((tab) => {
        const active = tab.id === activeTab;
        const badge = tab.id === 'manager' && pending ? `<span class="nav-badge" aria-label="${pending}">${this.i18n.num(pending)}</span>` : '';
        return `
          <a href="#/${tab.id}" class="nav-item ${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>
            <span class="nav-item__icon"><i class="bi ${active ? tab.iconOn : tab.icon}"></i>${badge}</span>
            <span class="nav-item__label">${this.t(`nav.${tab.id}`)}</span>
          </a>`;
      })
      .join('');
  }

  /** Re-draw nav badges after data changes without touching the view. */
  refreshShell() {
    const route = ROUTES[this.router.current().name];
    if (!route?.tab) return;
    const pending = this.isManager ? this.state.data.deposits.filter((d) => d.status === 'pending').length : 0;
    for (const nav of this.root.querySelectorAll('[data-nav]')) nav.innerHTML = this.navLinks(route.tab, pending, nav.dataset.nav);
  }

  /** Zeigarnik: a gentle, dismissible reminder until the email is verified. */
  verifyBanner() {
    const u = this.state.user;
    if (!u || u.emailVerified || u.provider !== 'password' || this.verifyDismissed) return '';
    return `
      <div class="verify-banner" role="status">
        <i class="bi bi-envelope-exclamation"></i>
        <span class="tw-flex-1">${this.t('verify.text', { email: esc(u.email) })}</span>
        <button type="button" class="btn btn-sm btn-link link-brand tw-font-semibold" data-action="resend-verification">${this.t(MODE === 'demo' ? 'verify.demo' : 'verify.resend')}</button>
        <button type="button" class="icon-btn icon-btn--sm" data-action="dismiss-verify" aria-label="${esc(this.t('common.close'))}"><i class="bi bi-x-lg"></i></button>
      </div>`;
  }

  localeSwitch() {
    const l = this.i18n.locale;
    return `
      <div class="locale-switch" role="group" aria-label="${esc(this.t('settings.language'))}">
        <button type="button" class="${l === 'bn' ? 'is-active' : ''}" data-action="set-locale" data-locale="bn" lang="bn" aria-pressed="${l === 'bn'}">বাং</button>
        <button type="button" class="${l === 'en' ? 'is-active' : ''}" data-action="set-locale" data-locale="en" lang="en" aria-pressed="${l === 'en'}">EN</button>
      </div>`;
  }



  updateOfflineChip() {
    this.root.querySelector('[data-offline]')?.classList.toggle('d-none', navigator.onLine);
  }

  bindGlobalActions() {
    document.addEventListener('click', async (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      switch (el.dataset.action) {
        case 'set-locale':
          this.setLocale(el.dataset.locale);
          break;
        case 'dismiss-verify':
          this.verifyDismissed = true;
          el.closest('.verify-banner')?.remove();
          break;
        case 'resend-verification':
          try {
            await this.auth.resendVerification();
            if (this.state.user?.emailVerified) {
              this.root.querySelector('.verify-banner')?.remove();
              this.toast(this.t('verify.done'), 'success');
            } else this.toast(this.t('verify.sent'), 'success');
          } catch (err) {
            this.toast(this.t(err.key ?? 'common.error'), 'danger');
          }
          break;
        default:
      }
    });
  }

  // ---------------------------------------------------------------- feedback

  toast(message, variant = 'secondary') {
    const icons = { success: 'bi-check-circle-fill', danger: 'bi-exclamation-circle-fill', secondary: 'bi-info-circle-fill' };
    const el = document.createElement('div');
    el.className = `toast app-toast app-toast--${variant}`;
    el.setAttribute('role', variant === 'danger' ? 'alert' : 'status');
    el.setAttribute('aria-live', variant === 'danger' ? 'assertive' : 'polite');
    el.innerHTML = `<div class="toast-body"><i class="bi ${icons[variant] ?? icons.secondary}"></i><span>${esc(message)}</span></div>`;
    document.getElementById('toasts').appendChild(el);
    const toast = window.bootstrap.Toast.getOrCreateInstance(el, { delay: 2800 });
    el.addEventListener('hidden.bs.toast', () => el.remove());
    toast.show();
  }

  /** Promise-based confirm dialog on top of Bootstrap's modal. Body is trusted HTML built by views. */
  confirm({ title, body = '', confirmText, cancelText = this.t('common.cancel'), danger = false }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="modal fade" tabindex="-1" aria-labelledby="confirm-title" aria-modal="true" role="dialog">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content app-modal">
              <div class="modal-body tw-p-6">
                <h2 class="tw-text-lg tw-font-bold tw-mb-3" id="confirm-title">${esc(title)}</h2>
                ${body}
              </div>
              <div class="modal-footer tw-border-0 tw-px-6 tw-pb-6 tw-pt-0 tw-gap-2">
                <button type="button" class="btn btn-ghost btn-lg tw-flex-1" data-bs-dismiss="modal">${esc(cancelText)}</button>
                <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} btn-lg tw-flex-1" data-confirm>${esc(confirmText)}</button>
              </div>
            </div>
          </div>
        </div>`;
      const el = wrap.firstElementChild;
      document.getElementById('modal-root').appendChild(el);
      const modal = new window.bootstrap.Modal(el);
      let result = false;
      el.querySelector('[data-confirm]').addEventListener('click', () => {
        result = true;
        modal.hide();
      });
      el.addEventListener('hidden.bs.modal', () => {
        modal.dispose();
        el.remove();
        resolve(result);
      });
      modal.show();
    });
  }
}
