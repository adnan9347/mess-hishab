import { View } from '../View.js';
import { avatar, segmented } from '../components.js';
import { RetentionPolicy } from '../../domain/RetentionPolicy.js';
import { MEAL_SLOTS } from '../../domain/MealEntry.js';
import { StatementExporter } from '../StatementExporter.js';
import { DhakaDate } from '../../core/DhakaDate.js';
import { esc } from '../../core/util.js';
import { MODE } from '../../config.js';
import { RepoError } from '../../data/Repository.js';

/** Profile, language, mess rules and data — grouped into cards (Law of Common Region). */
export class SettingsView extends View {
  static ownHeading = true;

  title() {
    return this.t('nav.settings');
  }

  render() {
    const { app } = this;
    const user = app.state.user;
    const data = app.state.data;
    const mess = data?.mess;
    const isManager = app.isManager;

    return `
      <div class="narrow-page narrow-page--wide tw-flex tw-flex-col tw-gap-6">
        <h1 class="page-heading tw-mb-0">${this.t('nav.settings')}</h1>

        <section class="surface-card tw-p-5">
          <div class="tw-flex tw-items-center tw-gap-4">
            ${avatar({ uid: user.uid, displayName: app.displayName() }, 56)}
            <div class="tw-min-w-0 tw-flex-1">
              <div class="tw-font-semibold tw-text-lg tw-truncate">${esc(app.displayName())}</div>
              <div class="tw-text-sm tw-text-muted tw-truncate">${esc(user.email)}</div>
              <div class="tw-mt-1">${user.emailVerified
                ? `<span class="badge-soft badge-soft--success"><i class="bi bi-patch-check-fill"></i> ${this.t('settings.verified')}</span>`
                : `<span class="badge-soft badge-soft--warning">${this.t('settings.unverified')}</span>`}</div>
            </div>
          </div>
          <form class="tw-flex tw-gap-2 tw-mt-4" data-form="name" novalidate>
            <label class="visually-hidden" for="s-name">${this.t('auth.name')}</label>
            <input id="s-name" class="form-control" name="name" value="${esc(app.displayName())}" maxlength="50" required>
            <button class="btn btn-ghost tw-whitespace-nowrap" type="submit">${this.t('common.save')}</button>
          </form>
        </section>

        <section class="surface-card tw-p-5 tw-flex tw-flex-col tw-gap-5">
          <div>
            <div class="eyebrow tw-mb-2">${this.t('settings.language')}</div>
            ${segmented('locale', [
              { value: 'bn', label: 'বাংলা' },
              { value: 'en', label: 'English' }
            ], this.i18n.locale, { label: this.t('settings.language'), size: 'seg--block' })}
          </div>
        </section>

        ${mess ? this.messSection(mess, isManager) : ''}

        <section class="surface-card tw-p-5">
          <h2 class="section-title">${this.t('settings.data')}</h2>
          <p class="tw-text-sm tw-text-muted">${this.t('settings.dataHint', { n: this.i18n.num(app.retention.days) })}</p>
          <button type="button" class="btn btn-ghost w-100" data-action="export-all"><i class="bi bi-download"></i> ${this.t('settings.downloadAll')}</button>
          ${MODE === 'demo' ? `<button type="button" class="btn btn-link tw-text-muted tw-text-sm w-100 tw-mt-2" data-action="reset-demo"><i class="bi bi-arrow-counterclockwise"></i> ${this.t('settings.resetDemo')}</button>` : ''}
        </section>

        <section class="tw-flex tw-flex-col tw-gap-2">
          <button type="button" class="btn btn-ghost btn-lg w-100" data-action="logout"><i class="bi bi-box-arrow-right"></i> ${this.t('settings.logout')}</button>
          ${mess ? `<button type="button" class="btn btn-link link-danger tw-text-sm" data-action="leave">${this.t('settings.leave')}</button>` : ''}
          <button type="button" class="btn btn-link link-danger tw-text-sm" data-action="delete-account">${this.t('settings.deleteAccount')}</button>
        </section>
      </div>`;
  }

  messSection(mess, isManager) {
    const { app } = this;
    const members = app.state.data.members.filter((m) => m.active !== false);
    const disabled = isManager ? '' : 'disabled';
    return `
      <section class="surface-card tw-p-5 tw-flex tw-flex-col tw-gap-5">
        <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <h2 class="section-title tw-mb-0">${this.t('settings.messRules')}</h2>
          ${isManager ? '' : `<span class="badge-soft"><i class="bi bi-lock"></i> ${this.t('settings.managerOnly')}</span>`}
        </div>

        <div class="tw-flex tw-items-center tw-justify-between tw-gap-3">
          <div class="tw-min-w-0"><div class="eyebrow">${this.t('onboarding.inviteCode')}</div><div class="tw-font-mono tw-text-lg tw-font-bold tw-tracking-widest">${esc(mess.inviteCode)}</div></div>
          <div class="tw-flex tw-gap-2">
            <button type="button" class="btn btn-ghost btn-icon" data-action="copy-code" aria-label="${esc(this.t('common.copy'))}"><i class="bi bi-copy"></i></button>
            <a class="btn btn-whatsapp btn-icon" href="${app.whatsappInviteLink()}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="bi bi-whatsapp"></i></a>
          </div>
        </div>

        <div>
          <div class="eyebrow tw-mb-2">${this.t('settings.cutoffs')}</div>
          <div class="tw-grid tw-grid-cols-3 tw-gap-2">
            ${MEAL_SLOTS.map((slot) => `
              <label class="tw-flex tw-flex-col tw-gap-1">
                <span class="tw-text-xs tw-text-muted">${this.t(`meal.${slot}`)}</span>
                <input type="time" class="form-control" data-cutoff="${slot}" value="${esc(mess.mealCutoffs?.[slot] ?? '')}" ${disabled}>
              </label>`).join('')}
          </div>
        </div>

        <div>
          <div class="eyebrow tw-mb-2">${this.t('settings.breakfastWeight')}</div>
          ${segmented('weight', [
            { value: '1', label: this.t('settings.fullMeal') },
            { value: '0.5', label: this.t('settings.halfMeal') }
          ], String(mess.mealWeights?.breakfast ?? 1), { label: this.t('settings.breakfastWeight'), size: `seg--block ${isManager ? '' : 'is-disabled'}` })}
        </div>

        <div>
          <div class="eyebrow tw-mb-2">${this.t('settings.retention')}</div>
          ${segmented('retention', RetentionPolicy.OPTIONS.map((d) => ({ value: String(d), label: this.t('settings.days', { n: this.i18n.num(d) }) })),
            String(app.retention.days), { label: this.t('settings.retention'), size: `seg--block ${isManager ? '' : 'is-disabled'}` })}
          <p class="tw-text-xs tw-text-muted tw-mt-2 tw-mb-0">${this.t('settings.retentionHint')}</p>
        </div>

        ${isManager && members.length > 1 ? `
          <div>
            <div class="eyebrow tw-mb-2">${this.t('settings.handover')}</div>
            <div class="tw-flex tw-gap-2">
              <select class="form-select" data-handover aria-label="${esc(this.t('settings.handover'))}">
                ${members.filter((m) => m.uid !== app.uid).map((m) => `<option value="${m.uid}">${esc(m.displayName)}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-ghost" data-action="handover">${this.t('settings.handoverButton')}</button>
            </div>
          </div>` : ''}
      </section>`;
  }

  bind() {
    const { app } = this;
    this.on('click', '[data-seg=locale] .seg__btn', (e, el) => app.setLocale(el.dataset.value));
    this.on('click', '[data-action=copy-code]', () => app.copyInviteCode());

    this.on('submit', '[data-form=name]', async (e) => {
      e.preventDefault();
      const name = e.target.name.value.trim();
      if (name.length < 2) return e.target.name.classList.add('is-invalid');
      await app.auth.updateName(name);
      await app.repo.saveProfile(app.uid, { displayName: name });
      if (app.messId) await app.repo.updateMember(app.messId, app.uid, { displayName: name });
      app.toast(this.t('common.saved'), 'success');
    });

    if (!app.isManager) return this.bindCommon();

    this.on('change', '[data-cutoff]', async (e, el) => {
      if (!el.value) return;
      await app.repo.updateMess(app.messId, { mealCutoffs: { ...app.state.data.mess.mealCutoffs, [el.dataset.cutoff]: el.value } });
      app.toast(this.t('common.saved'), 'success');
    });
    this.on('click', '[data-seg=weight] .seg__btn', async (e, el) => {
      await app.repo.updateMess(app.messId, { mealWeights: { ...app.state.data.mess.mealWeights, breakfast: Number(el.dataset.value) } });
    });
    this.on('click', '[data-seg=retention] .seg__btn', async (e, el) => {
      await app.repo.updateMess(app.messId, { retentionDays: Number(el.dataset.value) });
      app.toast(this.t('common.saved'), 'success');
    });
    this.on('click', '[data-action=handover]', async () => {
      const uid = this.$('[data-handover]').value;
      const ok = await app.confirm({
        title: this.t('settings.handoverConfirm', { name: esc(app.memberName(uid)) }),
        body: `<p class="tw-text-sm tw-text-muted tw-mb-0">${this.t('settings.handoverBody')}</p>`,
        confirmText: this.t('settings.handoverButton')
      });
      if (ok) await app.repo.handoverManager(app.messId, uid);
    });
    this.bindCommon();
  }

  bindCommon() {
    const { app } = this;
    this.on('click', '[data-action=logout]', () => app.auth.signOut());
    this.on('click', '[data-action=export-all]', () => this.exportAll());
    this.on('click', '[data-action=reset-demo]', async () => {
      const ok = await app.confirm({ title: this.t('settings.resetDemo'), body: `<p class="tw-text-sm tw-mb-0">${this.t('settings.resetDemoBody')}</p>`, confirmText: this.t('settings.resetDemo'), danger: true });
      if (ok) app.resetDemo();
    });
    this.on('click', '[data-action=leave]', async () => {
      const ok = await app.confirm({ title: this.t('settings.leave'), body: `<p class="tw-text-sm tw-mb-0">${this.t('settings.leaveBody')}</p>`, confirmText: this.t('settings.leave'), danger: true });
      if (!ok) return;
      try {
        await app.repo.leaveMess(app.messId, app.uid);
        await app.selectMess(null);
        app.router.go('onboarding');
      } catch (err) {
        app.toast(this.t(err instanceof RepoError && err.code === 'manager-must-handover' ? 'settings.handoverFirst' : 'common.error'), 'danger');
      }
    });
    this.on('click', '[data-action=delete-account]', async () => {
      const ok = await app.confirm({ title: this.t('settings.deleteAccount'), body: `<p class="tw-text-sm tw-mb-0">${this.t('settings.deleteBody')}</p>`, confirmText: this.t('common.delete'), danger: true });
      if (!ok) return;
      try {
        if (app.messId) await app.repo.leaveMess(app.messId, app.uid);
        await app.repo.deleteUserData(app.uid);
        await app.auth.deleteAccount();
      } catch (err) {
        const key = err?.key ?? (err instanceof RepoError && err.code === 'manager-must-handover' ? 'settings.handoverFirst' : 'common.error');
        app.toast(this.t(key), 'danger');
      }
    });
  }

  /** "Download all my data": profile, every saved monthly result and the last 30 daily snapshots. */
  async exportAll() {
    const { app } = this;
    const [profile, results, snapshots] = await Promise.all([
      app.repo.getProfile(app.uid),
      app.messId ? app.repo.listResults(app.messId, app.uid) : [],
      app.messId ? app.repo.listSnapshots(app.messId, app.uid, DhakaDate.addDays(DhakaDate.dateKey(), -30)) : []
    ]);
    new StatementExporter(this.i18n).downloadJson(`mess-hishab-${app.uid}.json`, {
      exportedAt: new Date().toISOString(),
      user: { uid: app.uid, email: app.state.user.email, displayName: app.displayName() },
      profile,
      currentMonth: app.messId ? app.mySummary().toJSON() : null,
      results,
      snapshots
    });
  }

  /** Don't wipe what someone is typing when data changes underneath. */
  onDataChange() {
    if (this.root?.contains(document.activeElement) && document.activeElement.matches('input, select')) return;
    this.update();
  }
}
