/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm:  '640px',
      md:  '1024px',
      lg:  '1280px',
      xl:  '1536px',
    },
    extend: {
      colors: {
        /* Primary palette */
        ink:          '#151714',
        'text-2':     '#4A5245',
        'text-3':     '#5F675A',
        paper:        '#F8F8F5',
        surface:      '#FFFFFF',
        line:         '#E3E6DD',
        'line-strong':'#CFD5C6',
        lime:         '#D9FA71',
        dark:         '#1B1F1A',

        /* Status backgrounds */
        'status-active-bg':    '#F3FBD9',
        'status-submitted-bg': '#FDF3DF',
        'status-settled-bg':   '#E6F3EA',
        'status-rejected-bg':  '#FBE9E8',
        'status-cancelled-bg': '#EEF0EC',
        'status-expired-bg':   '#F4EDE4',

        /* Legacy aliases so existing Tailwind classes keep working */
        white:        '#FFFFFF',
        'ink-2':      '#252823',
        secondary:    '#4A5245',
        muted:        '#5F675A',
        'line-dark':  '#353933',
        'lime-soft':  '#E9F9B8',
        select:       '#E4EDC9',
        tint:         '#F0F2EC',
        ok:           '#27744E',
        warn:         '#966625',
        bad:          '#B64D4A',
        bg:           '#F8F8F5',
        border:       '#E3E6DD',
        accent:       '#D9FA71',
        success:      '#27744E',
        danger:       '#B64D4A',
        subtle:       '#5F675A',
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        'xs':  ['0.75rem',   { lineHeight: '1rem'    }],
        'sm':  ['0.875rem',  { lineHeight: '1.25rem' }],
        'md':  ['1rem',      { lineHeight: '1.5rem'  }],
        'lg':  ['1.25rem',   { lineHeight: '1.75rem' }],
        'xl':  ['1.5rem',    { lineHeight: '2rem'    }],
        '2xl': ['2rem',      { lineHeight: '2.5rem'  }],
        '3xl': ['2.5rem',    { lineHeight: '3rem'    }],
        /* keep legacy sizes Tailwind normally provides */
        'base': ['1rem',     { lineHeight: '1.5rem'  }],
      },
      fontWeight: {
        body:    '450',
        label:   '600',
        heading: '650',
        /* keep legacy names */
        '450': '450',
        '600': '600',
        '650': '650',
      },
      borderRadius: {
        sm:      '8px',
        DEFAULT: '12px',
        md:      '12px',
        lg:      '16px',
        card:    '16px',
        full:    '9999px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        container: '1200px',
        'container-xl': '1360px',
      },
      boxShadow: {
        popover: '0 8px 32px rgba(18,23,14,.10), 0 2px 8px rgba(18,23,14,.06)',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
}
