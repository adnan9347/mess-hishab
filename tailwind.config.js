/** Tailwind handles layout, spacing and custom design; Bootstrap handles components.
 *  The `tw-` prefix and disabled preflight keep the two frameworks from colliding. */
export default {
  prefix: 'tw-',
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-border) / <alpha-value>)',
        ink: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-text-2) / <alpha-value>)',
        brand: 'rgb(var(--c-brand) / <alpha-value>)',
        'brand-soft': 'rgb(var(--c-brand-soft) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)'
      },
      fontFamily: { sans: ['Inter', '"Hind Siliguri"', 'system-ui', 'sans-serif'] },
      borderRadius: { card: '20px' }
    }
  }
};
