/**
 * Tiny hash router: "#/settlement/2026-09" → { name: 'settlement', params: { id: '2026-09' } }.
 * Each route declares its guard: 'guest' | 'auth' | 'mess' | 'manager'.
 */
export class Router {
  constructor(routes, onRoute) {
    this.routes = routes;
    this.onRoute = onRoute;
    window.addEventListener('hashchange', () => this.resolve());
  }

  current() {
    const [name = '', id = null] = location.hash.replace(/^#\/?/, '').split('/');
    const route = this.routes[name] ? name : null;
    return { name: route, params: { id } };
  }

  go(name, id = null) {
    const target = `#/${name}${id ? `/${id}` : ''}`;
    if (location.hash === target) this.resolve();
    else location.hash = target;
  }

  replace(name, id = null) {
    history.replaceState(null, '', `#/${name}${id ? `/${id}` : ''}`);
    this.resolve();
  }

  resolve() {
    this.onRoute(this.current());
  }
}
