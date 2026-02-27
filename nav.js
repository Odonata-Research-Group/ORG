// ORG — Shared Navigation
// Add one line to any experiment page: <script src="nav.js"></script>
// The nav injects itself, handles prev/next, and the ··· menu.

const ORG_NAV = {
  experiments: [
    { num: '001', name: 'Visual Glossary',     file: 'org-glossary-v3.html' },
    { num: '002', name: 'Low Poly Generator',  file: 'low-poly.html'        },
    { num: '003', name: 'Glitch Generator',    file: 'glitch.html'              },
  ],

  links: [
    { label: 'Instagram', url: 'https://instagram.com/odonataresearchgroup', target: '_blank' },
    { label: 'GitHub',    url: 'https://github.com/odonata-research-group/ORG', target: '_blank' },
  ],

  // Detect which page we're on from the filename
  currentFile() {
    return window.location.pathname.split('/').pop() || 'index.html';
  },

  currentIndex() {
    const f = this.currentFile();
    return this.experiments.findIndex(e => e.file === f);
  },

  init() {
    this.injectStyles();
    this.injectNav();
    this.bindMenu();
  },

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #org-nav {
        position: fixed;
        top: 0; left: 0; right: 0;
        z-index: 1000;
        height: 64px;
        background: #080808;
        border-bottom: 1px solid #1a1a1a;
        display: flex;
        align-items: center;
        padding: 0 40px;
        gap: 0;
        font-family: 'IBM Plex Mono', monospace;
      }

      /* Push page content below nav */
      body { padding-top: 64px; }

      /* ── LEFT: logo ── */
      #org-nav .nav-logo {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        text-decoration: none;
      }
      #org-nav .nav-logo img {
        height: 28px;
        width: auto;
        display: block;
        mix-blend-mode: screen;
        opacity: 0.92;
      }

      /* ── CENTRE: experiment label + arrows ── */
      #org-nav .nav-centre {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
      }

      #org-nav .nav-arrow {
        background: none;
        border: none;
        color: #444;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        transition: color 0.15s;
        line-height: 1;
        text-decoration: none;
        display: flex;
        align-items: center;
      }
      #org-nav .nav-arrow:hover { color: #eeeae2; }
      #org-nav .nav-arrow.disabled {
        color: #222;
        cursor: default;
        pointer-events: none;
      }

      #org-nav .nav-label {
        font-size: 9px;
        letter-spacing: 0.28em;
        text-transform: uppercase;
        color: #eeeae2;
        text-align: center;
        white-space: nowrap;
        min-width: 180px;
      }
      #org-nav .nav-label .nav-num {
        color: #444;
        margin-right: 8px;
      }

      /* Index page — no experiment label */
      #org-nav .nav-label.is-index {
        color: #333;
        letter-spacing: 0.22em;
      }

      /* ── RIGHT: ··· menu ── */
      #org-nav .nav-menu-wrap {
        position: relative;
        flex-shrink: 0;
      }

      #org-nav .nav-dots {
        background: none;
        border: none;
        color: #eeeae2;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 16px;
        letter-spacing: 0.15em;
        cursor: pointer;
        padding: 4px 0 4px 16px;
        transition: color 0.15s;
        line-height: 1;
      }
      #org-nav .nav-dots:hover { color: #eeeae2; }
      #org-nav .nav-dots.open { color: #eeeae2; }

      #org-nav .nav-dropdown {
        position: absolute;
        top: calc(100% + 16px);
        right: 0;
        background: #0d0d0d;
        border: 1px solid #1a1a1a;
        min-width: 160px;
        display: none;
        flex-direction: column;
      }
      #org-nav .nav-dropdown.open { display: flex; }

      #org-nav .nav-dropdown a {
        font-size: 9px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: #888;
        text-decoration: none;
        padding: 12px 16px;
        border-bottom: 1px solid #1a1a1a;
        transition: color 0.12s, background 0.12s;
      }
      #org-nav .nav-dropdown a:last-child { border-bottom: none; }
      #org-nav .nav-dropdown a:hover { color: #eeeae2; background: #111; }

      /* Divider line in dropdown */
      #org-nav .nav-dropdown .nav-divider {
        height: 1px;
        background: #1a1a1a;
      }
    `;
    document.head.appendChild(style);
  },

  injectNav() {
    const idx = this.currentIndex();
    const isIndex = this.currentFile() === 'index.html' || this.currentFile() === '';
    const current = this.experiments[idx];
    const prev = idx > 0 ? this.experiments[idx - 1] : null;
    const next = idx >= 0 && idx < this.experiments.length - 1 ? this.experiments[idx + 1] : null;

    // Centre label
    let centreHTML = '';
    if (isIndex) {
      centreHTML = `<span class="nav-label is-index">Odonata Research Group</span>`;
    } else if (current) {
      const prevHTML = prev
        ? `<a class="nav-arrow" href="${prev.file}" title="${prev.num} — ${prev.name}">←</a>`
        : `<span class="nav-arrow disabled">←</span>`;

      const nextHTML = (next && !next.soon)
        ? `<a class="nav-arrow" href="${next.file}" title="${next.num} — ${next.name}">→</a>`
        : `<span class="nav-arrow disabled">→</span>`;

      centreHTML = `
        ${prevHTML}
        <span class="nav-label">
          <span class="nav-num">${current.num}</span>${current.name}
        </span>
        ${nextHTML}
      `;
    }

    // Dropdown links
    const linksHTML = this.links.map(l =>
      `<a href="${l.url}" target="${l.target || '_self'}">${l.label}</a>`
    ).join('');

    // All experiments in dropdown
    const expHTML = this.experiments
      .filter(e => !e.soon)
      .map(e => `<a href="${e.file}">${e.num} — ${e.name}</a>`)
      .join('');

    const nav = document.createElement('nav');
    nav.id = 'org-nav';
    nav.innerHTML = `
      <a class="nav-logo" href="index.html">
        <img src="ORG.png" alt="ORG">
      </a>
      <div class="nav-centre">${centreHTML}</div>
      <div class="nav-menu-wrap">
        <button class="nav-dots" id="nav-dots-btn">···</button>
        <div class="nav-dropdown" id="nav-dropdown">
          ${expHTML}
          <div class="nav-divider"></div>
          ${linksHTML}
        </div>
      </div>
    `;

    document.body.insertBefore(nav, document.body.firstChild);
  },

  bindMenu() {
    const btn = document.getElementById('nav-dots-btn');
    const dropdown = document.getElementById('nav-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = dropdown.classList.toggle('open');
      btn.classList.toggle('open', open);
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
      btn.classList.remove('open');
    });
  }
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ORG_NAV.init());
} else {
  ORG_NAV.init();
}
