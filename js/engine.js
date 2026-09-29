/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MatSciEng Study Site — shared engine.js
   Navigation, modes, glossary, flashcards, progress.
   Config-driven: every site sets window.SITE_CONFIG before
   loading this file — no per-site edits to this file, ever.

   Required window.SITE_CONFIG shape:
   {
     slug: 'eg184',                          // localStorage key prefix
     topicIds: ['t1','t2',...],              // content topics, in order (excludes home/formulas/glossary/traps/etc.)
     navOrder: ['home','t1',...,'traps'],    // full arrow-key nav order (all sections)
     topicColors: {t1:'#f7a84a', ...},
     topicLabels: {t1:'Stress & Strain', ...},
     subpages: false                         // optional. Topics are split into one page per h2 (dot pager) unless this is false
   }
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  const CFG = window.SITE_CONFIG || {};
  const SLUG = CFG.slug || 'site';
  const TOPIC_IDS_RE = new RegExp('^(' + (CFG.topicIds || []).map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')$');

  // ── SECTION NAVIGATION ──────────────────────
  const NAV_ITEM_SEL = '[data-section]';

  // A topic's page can be addressed as "#id" (first page) or "#id/3" (third page).
  function hashFor(id, page) { return page > 0 && SUB[id] ? `#${id}/${page + 1}` : `#${id}`; }

  function activate(id, page) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll(NAV_ITEM_SEL).forEach(t => t.classList.remove('active'));
    const section = document.getElementById(id);
    if (section) section.classList.add('active');
    const tab = document.querySelector(`[data-section="${id}"]`);
    if (tab) tab.classList.add('active');
    if (section && SUB[id]) setSubpage(id, page === 'last' ? SUB[id].pages.length - 1 : (page || 0));
    updatePager();
    return section;
  }

  window.showSection = function (id, e, page) {
    if (e) e.preventDefault();
    const section = activate(id, page);
    if (section) window.scrollTo({ top: 0, behavior: 'smooth' });
    const idx = SUB[id] ? SUB[id].idx : 0;
    history.pushState({ section: id, page: idx }, '', hashFor(id, idx));
    markVisited(id);
  };

  window.addEventListener('popstate', e => {
    const st = e.state;
    if (st && st.section) { if (document.getElementById(st.section)) activate(st.section, st.page || 0); return; }
    const t = parseHash(location.hash.slice(1)) || { id: 'home', page: 0 };
    if (document.getElementById(t.id)) activate(t.id, t.page);
  });

  // ── LEARN / REVISE MODE ──────────────────────
  window.setMode = function (mode, silent) {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if (btn) btn.classList.add('active');
    if (mode === 'revise') document.body.classList.add('revise-mode');
    else document.body.classList.remove('revise-mode');
    localStorage.setItem(`${SLUG}-mode`, mode);
    if (silent) return;

    document.querySelector('.mode-flash')?.remove();
    const flash = document.createElement('div');
    flash.className = `mode-flash ${mode}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 900);

    document.querySelector('.mode-toast')?.remove();
    const label = mode === 'learn' ? '📖  Learn mode' : '⚡  Revise mode';
    const toast = document.createElement('div');
    toast.className = `mode-toast ${mode}`;
    toast.textContent = label;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 350);
    }, 1800);
  };

  // ── GLOSSARY SEARCH ──────────────────────────
  window.initGlossarySearch = function (inputId, countId, noResultsId) {
    const input = document.getElementById(inputId);
    const countEl = document.getElementById(countId);
    const noResultsEl = document.getElementById(noResultsId);
    if (!input) return;

    const glContainer = document.getElementById('glossary-container');
    const pinnedWrap = document.createElement('div');
    pinnedWrap.id = 'glossary-pinned';
    pinnedWrap.style.display = 'none';
    glContainer.parentNode.insertBefore(pinnedWrap, glContainer);

    input.addEventListener('input', () => {
      const q = input.value.toLowerCase().trim();

      document.querySelectorAll('.term-item[data-pinned]').forEach(item => {
        item.classList.remove('hidden');
        delete item.dataset.pinned;
      });
      pinnedWrap.innerHTML = '';
      pinnedWrap.style.display = 'none';

      let visible = 0;
      const exactItems = [];

      document.querySelectorAll('.term-item').forEach(item => {
        const nameMatch = item.dataset.name.includes(q);
        const defMatch = item.dataset.def.includes(q);
        const show = !q || nameMatch || defMatch;
        item.classList.toggle('hidden', !show);
        if (show) {
          visible++;
          const nameEl = item.querySelector('.term-name');
          if (q) {
            nameEl.innerHTML = highlight(nameEl.textContent, q);
            item.classList.add('match');
            if (item.dataset.name === q) exactItems.push(item);
          } else {
            nameEl.innerHTML = nameEl.textContent;
            item.classList.remove('match');
          }
        }
      });

      document.querySelectorAll('.glossary-section').forEach(sec => {
        const vis = sec.querySelectorAll('.term-item:not(.hidden)').length;
        sec.classList.toggle('hidden', q && vis === 0);
        if (q && vis > 0) sec.classList.remove('collapsed');
      });

      if (q && exactItems.length > 0) {
        const label = document.createElement('div');
        label.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);margin-bottom:6px";
        label.textContent = 'Exact match';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:1px;background:var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:20px';
        exactItems.forEach(item => {
          const clone = item.cloneNode(true);
          clone.style.borderLeftColor = 'var(--gold)';
          grid.appendChild(clone);
          item.dataset.pinned = '1';
          item.classList.add('hidden');
        });
        pinnedWrap.appendChild(label);
        pinnedWrap.appendChild(grid);
        pinnedWrap.style.display = 'block';
      }

      if (countEl) countEl.textContent = q ? `${visible} term${visible !== 1 ? 's' : ''} found` : '';
      if (noResultsEl) noResultsEl.style.display = (q && visible === 0) ? 'block' : 'none';
    });
  };

  function highlight(text, q) {
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(re, '<mark>$1</mark>');
  }

  // ── GLOSSARY FILTER BUTTONS ──────────────────
  window.initGlossaryFilters = function (filterSelector) {
    document.querySelectorAll(filterSelector).forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll(filterSelector).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.gfilter;
        const input = document.querySelector('.search-input');
        if (input) input.value = '';
        const countEl = document.getElementById('search-results-count');
        if (countEl) countEl.textContent = '';
        const noResultsEl = document.getElementById('no-results');
        if (noResultsEl) noResultsEl.style.display = 'none';

        document.querySelectorAll('.glossary-section').forEach(sec => {
          const show = filter === 'all' || sec.dataset.topic === filter;
          sec.classList.toggle('hidden', !show);
          if (show) sec.classList.remove('collapsed');
        });
        document.querySelectorAll('.term-item').forEach(item => {
          item.classList.remove('hidden', 'match');
          const n = item.querySelector('.term-name');
          if (n) n.innerHTML = n.textContent;
        });
      });
    });
  };

  // ── GLOSSARY SECTION TOGGLE ──────────────────
  window.toggleGlossarySection = function (header) {
    const sec = header.parentElement;
    sec.classList.toggle('collapsed');
    const arrow = header.querySelector('.g-arrow');
    if (arrow) arrow.style.transform = sec.classList.contains('collapsed') ? 'rotate(-90deg)' : '';
  };

  // ── INLINE LATEX RENDERER ────────────────────
  window.renderInlineLatex = function (text) {
    if (typeof katex === 'undefined') return text;
    return text.replace(/\\\((.+?)\\\)/g, (_, formula) => {
      try { return katex.renderToString(formula, { throwOnError: false, displayMode: false }); }
      catch (e) { return formula; }
    });
  };

  // ── BUILD GLOSSARY FROM DATA ─────────────────
  window.buildGlossary = function (containerId) {
    const container = document.getElementById(containerId);
    if (!container || typeof glossaryData === 'undefined') return;
    const colorMap = CFG.topicColors || {};

    Object.entries(glossaryData).forEach(([key, topic]) => {
      const color = colorMap[key] || '#7c6af7';
      const sec = document.createElement('div');
      sec.className = 'glossary-section';
      sec.dataset.topic = key;
      sec.innerHTML = `
        <div class="glossary-header" onclick="toggleGlossarySection(this)">
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:9px;height:9px;border-radius:50%;background:${color};flex-shrink:0"></div>
            <span style="font-weight:700;font-size:14px">${topic.name}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted)">(${topic.terms.length} terms)</span>
          </div>
          <span class="g-arrow" style="color:var(--muted);transition:transform 0.2s">▾</span>
        </div>
        <div class="glossary-grid">
          ${topic.terms.map(([name, def]) => `
            <div class="term-item" data-name="${name.toLowerCase()}" data-def="${def.toLowerCase()}">
              <div class="term-name" style="color:${color}">${name}</div>
              <div class="term-def">${renderInlineLatex(def)}</div>
            </div>`).join('')}
        </div>`;
      container.appendChild(sec);
    });
  };

  // ── FLASHCARD SESSION ─────────────────────────
  let _fcDeck = [], _fcFiltered = [], _fcIndex = 0, _fcTopic = 'all';

  function _fcColor(key) {
    return (CFG.topicColors || {})[key] || '#7c6af7';
  }

  function buildFcDeck() {
    if (typeof glossaryData === 'undefined') return;
    _fcDeck = [];
    Object.entries(glossaryData).forEach(([key, topic]) => {
      topic.terms.forEach(([name, def]) => _fcDeck.push({ name, def, label: topic.name, color: _fcColor(key), key }));
    });
    const container = document.getElementById('fc-topic-btns');
    if (container) {
      container.innerHTML = '';
      container.appendChild(_fcBtn('All', 'all'));
      Object.entries(glossaryData).forEach(([key, topic]) => {
        const b = _fcBtn(key.toUpperCase(), key);
        b.title = topic.name;
        container.appendChild(b);
      });
    }
    applyFcFilters();
  }

  function _fcBtn(label, key) {
    const btn = document.createElement('button');
    btn.className = 'fc-filter-btn' + (key === 'all' ? ' active' : '');
    btn.textContent = label;
    btn.onclick = () => {
      document.querySelectorAll('#fc-topic-btns .fc-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _fcTopic = key;
      applyFcFilters();
    };
    return btn;
  }

  window.applyFcFilters = function () {
    const qty = document.getElementById('fc-qty-select')?.value || 'all';
    let deck = _fcTopic === 'all' ? [..._fcDeck] : _fcDeck.filter(c => c.key === _fcTopic);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[deck[i], deck[j]] = [deck[j], deck[i]]; }
    _fcFiltered = qty === 'all' ? deck : deck.slice(0, parseInt(qty));
    _fcIndex = 0;
    _showFcCard();
  };

  function _showFcCard() {
    const c = _fcFiltered[_fcIndex];
    if (!c) return;
    const $ = id => document.getElementById(id);
    $('fc-card-inner')?.classList.remove('flipped');
    if ($('fc-topic-label')) { $('fc-topic-label').textContent = c.label; $('fc-topic-label').style.color = c.color; }
    if ($('fc-term-text')) $('fc-term-text').textContent = c.name;
    if ($('fc-back-term')) { $('fc-back-term').textContent = c.name; $('fc-back-term').style.color = c.color; }
    if ($('fc-def-text')) $('fc-def-text').textContent = c.def;
    if ($('fc-pos')) $('fc-pos').textContent = _fcIndex + 1;
    if ($('fc-total')) $('fc-total').textContent = _fcFiltered.length;
    if ($('fc-progress-bar')) $('fc-progress-bar').style.width = ((_fcIndex + 1) / _fcFiltered.length * 100) + '%';
    if ($('fc-prev')) $('fc-prev').disabled = _fcIndex === 0;
    if ($('fc-next')) $('fc-next').disabled = _fcIndex === _fcFiltered.length - 1;
  }

  window.fcFlip = function () { document.getElementById('fc-card-inner')?.classList.toggle('flipped'); };
  window.fcNext = function () { if (_fcIndex < _fcFiltered.length - 1) { _fcIndex++; _showFcCard(); } };
  window.fcPrev = function () { if (_fcIndex > 0) { _fcIndex--; _showFcCard(); } };

  window.enterFlashcards = function () {
    document.getElementById('fc-session').style.display = 'block';
    document.getElementById('fc-list-view').style.display = 'none';
    buildFcDeck();
  };
  window.exitFlashcards = function () {
    document.getElementById('fc-session').style.display = 'none';
    document.getElementById('fc-list-view').style.display = 'block';
  };

  // ── REVEAL ANSWERS (practice problems) ───────
  window.toggleReveal = function (btn) {
    const card = btn.closest('.problem-card');
    const ans = card.querySelector('.problem-answer');
    const showing = ans.classList.contains('visible');
    ans.classList.toggle('visible', !showing);
    btn.textContent = showing ? 'Show answer' : 'Hide answer';
    btn.classList.toggle('revealed', !showing);
  };

  // ── PROGRESS TRACKING ────────────────────────
  function markVisited(id) {
    if (!TOPIC_IDS_RE.test(id)) return;
    localStorage.setItem(`${SLUG}-visited-${id}`, '1');
    updateProgress();
  }

  function updateProgress() {
    const topics = CFG.topicIds || [];
    const done = topics.filter(id => localStorage.getItem(`${SLUG}-visited-${id}`)).length;
    topics.forEach(id => {
      if (!localStorage.getItem(`${SLUG}-visited-${id}`)) return;
      document.querySelectorAll('.topic-card').forEach(card => {
        if ((card.getAttribute('onclick') || '').includes(`'${id}'`)) card.classList.add('visited');
      });
    });
    const fill = document.querySelector('.progress-fill');
    if (fill && topics.length) fill.style.width = `${(done / topics.length) * 100}%`;
    const label = document.querySelector('.progress-label');
    if (label) label.textContent = `${done} of ${topics.length} topics visited`;
  }

  // ── KEYBOARD SHORTCUTS ───────────────────────
  document.addEventListener('keydown', e => {
    if (document.activeElement.tagName === 'INPUT') return;

    const fcActive = document.getElementById('fc-session')?.style.display !== 'none';
    if (fcActive) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); fcFlip(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); fcNext(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); fcPrev(); return; }
      if (e.key === 'Escape') { exitFlashcards(); return; }
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      showSection('glossary');
      setTimeout(() => { const inp = document.querySelector('.search-input'); if (inp) inp.focus(); }, 150);
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const active = document.querySelector('.section.active');
      if (!active) return;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const st = SUB[active.id];
      if (st && !document.body.classList.contains('revise-mode')) {
        const to = st.idx + dir;
        if (to >= 0 && to < st.pages.length) { showSubpage(active.id, to); return; }
      }
      const navOrder = CFG.navOrder || [];
      const idx = navOrder.indexOf(active.id);
      if (idx === -1) return;
      const next = navOrder[idx + dir];
      if (next) showSection(next, null, dir < 0 ? 'last' : 0);
    }

    if (e.key === 'Escape') {
      const inp = document.querySelector('.search-input');
      if (inp && document.activeElement === inp) { inp.value = ''; inp.dispatchEvent(new Event('input')); inp.blur(); }
    }
  });

  // ── SECTION ACCENT STRIPS ────────────────────
  function buildAccentStrips() {
    (CFG.topicIds || []).forEach(id => {
      const section = document.getElementById(id);
      if (!section) return;
      const strip = document.createElement('div');
      strip.className = 'section-accent';
      section.insertBefore(strip, section.firstChild);
    });
  }

  // ── SUBPAGES (one page per h2, dot pager) ────
  const SUB = {};   // topic id -> { pages: [{el, title}], idx }
  let pagerEl = null;

  function visitedKey(id) { return `${SLUG}-sub-${id}`; }
  function getVisited(id) {
    try { return JSON.parse(localStorage.getItem(visitedKey(id)) || '[]'); } catch (e) { return []; }
  }
  function addVisited(id, i) {
    try {
      const v = getVisited(id);
      if (!v.includes(i)) { v.push(i); localStorage.setItem(visitedKey(id), JSON.stringify(v)); }
    } catch (e) { /* storage unavailable: dots just won't remember */ }
  }

  function buildSubpages() {
    if (CFG.subpages === false) return;
    (CFG.topicIds || []).forEach(id => {
      const section = document.getElementById(id);
      const container = section && (section.querySelector('.container') || section.querySelector('.container-wide'));
      if (!container) return;

      const kids = [...container.children];
      const isHead = k => k.classList.contains('topic-num') || k.tagName === 'H1';
      let first = 0;
      while (first < kids.length && isHead(kids[first])) first++;
      const body = kids.slice(first);
      const topicNav = body.find(k => k.classList.contains('topic-nav'));
      const content = body.filter(k => k !== topicNav);

      // split at every top-level h2
      const groups = [];
      let cur = { title: 'Overview', nodes: [] };
      content.forEach(k => {
        if (k.tagName === 'H2') { groups.push(cur); cur = { title: k.textContent.trim() || 'Section', nodes: [k] }; }
        else cur.nodes.push(k);
      });
      groups.push(cur);
      // the lead group is only a real "Overview" page if it holds more than the subtitle
      const lead = groups[0];
      const hasLead = lead.nodes.some(n => !n.classList.contains('hero-subtitle'));
      if (!hasLead) {
        groups.shift();
        if (groups.length) groups[0].nodes = lead.nodes.concat(groups[0].nodes);
      }
      if (groups.length < 2) return;   // nothing worth splitting

      const pages = groups.map((g, i) => {
        const el = document.createElement('div');
        el.className = 'subpage';
        el.dataset.page = i;
        g.nodes.forEach(n => el.appendChild(n));
        return { el, title: g.title };
      });
      const anchor = topicNav || null;
      pages.forEach(pg => container.insertBefore(pg.el, anchor));
      if (topicNav) pages[pages.length - 1].el.appendChild(topicNav);

      // inline "previous / next" at the foot of every page except the last
      pages.forEach((pg, i) => {
        if (i === pages.length - 1) return;
        const foot = document.createElement('div');
        foot.className = 'sub-foot';
        foot.innerHTML = (i > 0
          ? `<button class="topic-nav-btn" data-sub="${i - 1}">← ${escHtml(pages[i - 1].title)}</button>`
          : '<span></span>') +
          `<button class="topic-nav-btn sub-next" data-sub="${i + 1}">${escHtml(pages[i + 1].title)} →</button>`;
        pg.el.appendChild(foot);
      });

      section.classList.add('paged');
      SUB[id] = { pages, idx: 0 };
      pages[0].el.classList.add('active');
      container.addEventListener('click', ev => {
        const b = ev.target.closest('[data-sub]');
        if (b && container.contains(b)) { showSubpage(id, parseInt(b.dataset.sub, 10)); }
      });
    });
  }

  function escHtml(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // switch page without touching history or scroll
  function setSubpage(id, idx) {
    const st = SUB[id];
    if (!st) return;
    idx = Math.max(0, Math.min(st.pages.length - 1, idx));
    st.pages.forEach((p, i) => p.el.classList.toggle('active', i === idx));
    st.idx = idx;
    addVisited(id, idx);
  }

  window.showSubpage = function (id, idx, opts) {
    opts = opts || {};
    const st = SUB[id];
    if (!st) return;
    setSubpage(id, idx);
    updatePager();
    history.pushState({ section: id, page: st.idx }, '', hashFor(id, st.idx));
    if (opts.scroll !== false) window.scrollTo({ top: 0, behavior: 'auto' });
  };

  function activeTopicId() {
    const a = document.querySelector('.section.active');
    return a && SUB[a.id] ? a.id : null;
  }

  function buildPager() {
    pagerEl = document.createElement('nav');
    pagerEl.className = 'subpager';
    pagerEl.setAttribute('aria-label', 'Subtopic pages');
    pagerEl.innerHTML = `
      <div class="subpager-label"><span class="subpager-count"></span><span class="subpager-title"></span></div>
      <div class="subpager-row">
        <button class="subpager-arrow" data-dir="-1" aria-label="Previous page">‹</button>
        <div class="subpager-dots"></div>
        <button class="subpager-arrow" data-dir="1" aria-label="Next page">›</button>
      </div>`;
    pagerEl.addEventListener('click', ev => {
      const id = activeTopicId();
      if (!id) return;
      const dot = ev.target.closest('.subdot');
      if (dot) return showSubpage(id, parseInt(dot.dataset.i, 10));
      const arrow = ev.target.closest('.subpager-arrow');
      if (arrow) showSubpage(id, SUB[id].idx + parseInt(arrow.dataset.dir, 10));
    });
    document.body.appendChild(pagerEl);
  }

  function updatePager() {
    if (!pagerEl) return;
    const id = activeTopicId();
    pagerEl.classList.toggle('show', !!id);
    if (!id) return;
    const st = SUB[id];
    const visited = getVisited(id);
    const dots = pagerEl.querySelector('.subpager-dots');
    if (dots.dataset.topic !== id) {
      dots.dataset.topic = id;
      dots.classList.toggle('dense', st.pages.length > 12);
      dots.innerHTML = st.pages.map((p, i) =>
        `<button class="subdot" data-i="${i}" title="${escHtml(p.title)}" aria-label="Page ${i + 1}: ${escHtml(p.title)}"></button>`).join('');
    }
    dots.querySelectorAll('.subdot').forEach((d, i) => {
      d.classList.toggle('active', i === st.idx);
      d.classList.toggle('visited', i !== st.idx && visited.includes(i));
      if (i === st.idx) d.setAttribute('aria-current', 'page'); else d.removeAttribute('aria-current');
    });
    pagerEl.querySelector('.subpager-count').textContent = `${st.idx + 1} / ${st.pages.length}`;
    pagerEl.querySelector('.subpager-title').textContent = st.pages[st.idx].title;
    pagerEl.querySelector('[data-dir="-1"]').disabled = st.idx === 0;
    pagerEl.querySelector('[data-dir="1"]').disabled = st.idx === st.pages.length - 1;
  }

  // "#id", "#id/3", or the id of any element inside a topic page
  function parseHash(h) {
    if (!h) return null;
    try { h = decodeURIComponent(h); } catch (e) { /* keep raw */ }
    if (document.getElementById(h) && document.getElementById(h).classList.contains('section')) return { id: h, page: 0 };
    const m = h.match(/^(.+)\/(\d+)$/);
    if (m && SUB[m[1]]) return { id: m[1], page: Math.max(0, parseInt(m[2], 10) - 1) };
    const el = document.getElementById(h);
    const pg = el && el.closest('.subpage');
    if (pg) return { id: pg.closest('.section').id, page: parseInt(pg.dataset.page, 10), el };
    return null;
  }

  // in-page links (contents lists, cross references) may point at content on another page
  document.addEventListener('click', ev => {
    const a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    const t = parseHash(a.getAttribute('href').slice(1));
    if (!t || !t.el) return;
    ev.preventDefault();
    if (SUB[t.id]) {
      if (document.querySelector('.section.active')?.id !== t.id) activate(t.id, t.page); else setSubpage(t.id, t.page);
      updatePager();
      history.pushState({ section: t.id, page: t.page }, '', hashFor(t.id, t.page));
    }
    if (t.page === 0 && t.el === t.el.closest('.subpage').firstElementChild) window.scrollTo({ top: 0, behavior: 'auto' });
    else t.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── PREV / NEXT NAV ──────────────────────────
  function buildTopicNav() {
    const topics = CFG.topicIds || [];
    const labels = CFG.topicLabels || {};
    topics.forEach((id, i) => {
      const section = document.getElementById(id);
      if (!section) return;
      const container = section.querySelector('.container') || section.querySelector('.container-wide');
      if (!container) return;

      const prev = topics[i - 1];
      const next = topics[i + 1];

      const nav = document.createElement('div');
      nav.className = 'topic-nav';
      nav.innerHTML = `
        <button class="topic-nav-btn${prev ? '' : ' disabled'}" onclick="${prev ? `showSection('${prev}')` : ''}">
          ← ${prev ? labels[prev] : 'Start'}
        </button>
        <span style="font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--dim)">${i + 1} / ${topics.length}</span>
        <button class="topic-nav-btn${next ? '' : ' disabled'}" onclick="${next ? `showSection('${next}')` : ''}">
          ${next ? labels[next] : 'End'} →
        </button>`;
      container.appendChild(nav);
    });
  }

  // ── INIT ─────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const savedMode = localStorage.getItem(`${SLUG}-mode`) || 'learn';
    setMode(savedMode, true);

    if (typeof glossaryData !== 'undefined') {
      buildGlossary('glossary-container');
      initGlossarySearch('glossary-search-input', 'search-results-count', 'no-results');
      initGlossaryFilters('[data-gfilter]');
    }
    buildTopicNav();
    buildAccentStrips();
    buildSubpages();
    buildPager();

    const target = parseHash(location.hash.slice(1));
    if (target) {
      showSection(target.id, null, target.page);
      if (target.el) setTimeout(() => target.el.scrollIntoView({ block: 'start' }), 50);
    }
    updateProgress();

    if (typeof renderMathInElement !== 'undefined') {
      renderMathInElement(document.body, { delimiters: [{ left: '$$', right: '$$', display: true }, { left: '\\(', right: '\\)', display: false }] });
    }
  });
})();
