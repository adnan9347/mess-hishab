/**
 * Base class for every screen. Subclasses override render() and bind();
 * the app calls mount() on navigation and onDataChange() when Firestore/local data changes.
 */
export class View {
  /** 'app' = inside the tab shell, 'bare' = full-bleed (auth screens). */
  static layout = 'app';
  /** Re-render automatically when mess data changes? Forms set this to false. */
  static live = true;
  /** Screens with their own back button + heading keep the top bar to the mess name only. */
  static ownHeading = false;

  constructor(app, params = {}) {
    this.app = app;
    this.params = params;
    this.cleanups = [];
    this.root = null;
  }

  t(key, params) {
    return this.app.i18n.t(key, params);
  }

  get i18n() {
    return this.app.i18n;
  }

  /** Header title for the app shell. */
  title() {
    return '';
  }

  render() {
    return '';
  }

  /** Attach event listeners after the HTML is in the DOM. */
  bind() {}

  mount(root) {
    this.root = root;
    this.runCleanups();
    root.innerHTML = this.render();
    this.bind();
  }

  update() {
    if (this.root) this.mount(this.root);
  }

  onDataChange() {
    if (this.constructor.live) this.update();
  }

  /** Event delegation: this.on('click', '[data-action=save]', (e, el) => …) */
  on(type, selector, handler) {
    const listener = (e) => {
      const el = e.target.closest(selector);
      if (el && this.root.contains(el)) handler(e, el);
    };
    this.root.addEventListener(type, listener);
    this.cleanups.push(() => this.root?.removeEventListener(type, listener));
  }

  $(selector) {
    return this.root.querySelector(selector);
  }

  $$(selector) {
    return [...this.root.querySelectorAll(selector)];
  }

  addCleanup(fn) {
    this.cleanups.push(fn);
  }

  runCleanups() {
    this.cleanups.forEach((fn) => fn());
    this.cleanups = [];
  }

  destroy() {
    this.runCleanups();
    this.root = null;
  }
}
