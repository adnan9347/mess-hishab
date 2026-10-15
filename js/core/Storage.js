/** localStorage that never throws (private windows, blocked storage, quota). */
export class SafeStorage {
  static get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  static remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
