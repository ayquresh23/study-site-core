/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MatSciEng Study Site — shared terms.js
   Loaded automatically by engine.js. Two features, both driven
   by the site's glossaryData (no per-site setup needed):

   1. Term previews (Wikipedia-style). The first mention of each
      glossary term on a page gets a quiet dotted underline; hovering
      it (or tapping, or focusing it) opens a small card with the
      definition. Selecting / double-clicking ANY glossary term,
      abbreviation or symbol anywhere on the page opens the same card.
   2. Expandable glossary entries. Clicking an entry in the glossary
      (e.g. a search result) expands it to list every place the term
      appears; each one jumps straight to that page and highlights it.

   Optional per-site comparisons, shown in both views — define in
   glossary-data.js alongside glossaryData:
     const glossaryComparisons = [
       { terms: ['Isotropic', 'Anisotropic'],          // 2 or 3 terms
         defs:  ['', 'Properties vary with direction'], // used only for terms not in the glossary
         aliases: [['isotropic'], ['anisotropic']],      // optional extra words that find each side
         rows:  [['Properties', 'Same in every direction', 'Depend on direction'], …] }
     ];
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  if (typeof glossaryData === 'undefined' || window.__termsLoaded) return;
  window.__termsLoaded = true;

  const CFG = window.SITE_CONFIG || {};
  const CONTENT_SEL = '.section:not(#home):not(#glossary)';
  const LINK_SKIP = 'h1,h2,h3,h4,th,a,button,input,textarea,select,label,code,pre,svg,script,style,mark,.katex,.gl-term,' +
    '.formula-eq,.formula-var-symbol,.concept-box-title,.toc,.topic-nav,.topic-num,.sub-foot,.section-accent,.tp-card';
  const MENTION_SKIP = 'script,style,svg,button,.katex,.toc,.topic-nav,.sub-foot,.section-accent,.tp-card';
  const MENTION_SHOW = 6, MENTION_MAX = 30;
  const HOVER_DELAY = 450, HIDE_DELAY = 260;

  // ── HELPERS ──────────────────────────────────
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = s => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ').trim();
  const SUBS = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', 'ₐ': 'a', 'ₑ': 'e', 'ᵢ': 'i', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₜ': 't' };
  const normSym = s => s.replace(/[₀-₉ₐₑᵢₘₙₚₜ]/g, c => SUBS[c]).replace(/[\u0304\u02c9\u00af]/g, '\u00af').replace(/[\s_\u200b]/g, '');   // x̄ / KaTeX's xˉ
  const isAbbrev = s => /^%?[A-Z][A-Z0-9-]*s?$/.test(s) && s.replace(/[^A-Z]/g, '').length >= 2;
  const isSymbol = s => !/\s/.test(s) && (/[^\x00-\x7F]|_/.test(s) || s.length <= 3);

  // escape plain text, render \( … \) segments with KaTeX when available
  function richText(s) {
    return String(s).split(/(\\\(.+?\\\))/g).map((part, i) => {
      if (i % 2 === 0) return esc(part);
      const tex = part.slice(2, -2);
      if (typeof katex === 'undefined') return esc(tex);
      try { return katex.renderToString(tex, { throwOnError: false }); } catch (e) { return esc(tex); }
    }).join('');
  }

  // Regex source for a term: whole words, case-insensitive except for
  // all-caps tokens (abbreviations like UTS or SCC stay case-exact).
  function patternFor(v) {
    return v.split(/(\s+)/).map(tok => {
      if (/^\s+$/.test(tok)) return '\\s+';
      const exact = isAbbrev(tok);
      return [...tok].map(ch => {
        if (ch === "'" || ch === '’') return "['’]";
        if (ch === '-' || ch === '–') return '[-‐‑–]';
        const lo = ch.toLowerCase(), up = ch.toUpperCase();
        return !exact && lo !== up && lo.length === 1 && up.length === 1 ? `[${lo}${up}]` : reEsc(ch);
      }).join('');
    }).join('');
  }
  const wrapRe = alts => new RegExp(`(?<![\\p{L}\\p{N}-])(${alts})(?:e?s)?(?![\\p{L}\\p{N}])`, 'gu');

  function topicTag(key, name) {
    const m = name.match(/^(Topics?|Units?|Weeks?|Lectures?) (\d+)(?: (?:and|&) (\d+))?/);
    return m ? `${m[1][0].toUpperCase()}${m[2]}${m[3] ? '–' + m[3] : ''}` : key.toUpperCase();
  }

  // ── INDEX ────────────────────────────────────
  const entries = [];
  const nameIndex = new Map();   // exact lowercase name → entry (matches .term-item data-name)
  const wordIndex = new Map();   // norm(variant) → entry
  const weakIndex = new Map();   // qualifier-stripped names, selection lookup only
  const symIndex = new Map();    // normSym(symbol) → entry
  const banned = new Set();      // ambiguous abbreviations
  const abbrevCase = new Map();  // norm(abbreviation) → exact spelling; selections must match case

  function claim(map, key, entry, primary) {
    if (!key || banned.has(key)) return;
    const prev = map.get(key);
    if (!prev) { map.set(key, entry); return; }
    if (prev === entry || prev.name === entry.name) return;
    if (primary && norm(prev.name) !== key) { map.set(key, entry); return; }
    if (map === wordIndex && !primary && norm(prev.name) !== key && isAbbrev(entry.variants.find(v => norm(v) === key) || '')) {
      map.delete(key); banned.add(key);
    }
  }

  function addEntry(e) {
    const name = e.name;
    e.variants = []; e.symbols = []; e.comparisons = [];
    // a bracket mid-name is an optional insert — "Secondary (steady-state) creep" — not a qualifier
    const parens = [...name.matchAll(/\(([^)]+)\)/g)].filter(m => !name.slice(m.index + m[0].length).trim()).map(m => m[1].trim());
    const base = name.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    const baseIsAbbrev = isAbbrev(base);
    let qualified = false, qualifier = '';

    parens.forEach(p => {
      // "Quenching (PH)", "Matrix (PMC)": the base or bracket is another entry, so the bracket is context
      if (NAMES.has(norm(base)) && norm(base) !== norm(name) || NAMES.has(norm(p))) { qualified = true; qualifier = p; return; }
      if (isAbbrev(p)) e.variants.push(p);                                   // Ultimate tensile strength (UTS)
      else if (baseIsAbbrev && /\s/.test(p)) e.variants.push(p);            // BCC (body-centred cubic)
      else if (isSymbol(p)) e.symbols.push(p);                              // Stress (σ)
      else if (/\s/.test(p) && !NAMES.has(norm(base))) e.variants.push(p);  // Fatigue limit (endurance limit): a synonym
      else { qualified = true; qualifier = p; }                              // Die (extrusion): context, not a synonym
    });

    const parts = / \/ /.test(base) && base.split(' / ').every(s => /\s/.test(s.trim()) || isAbbrev(s.trim()))
      ? base.split(' / ').map(s => s.trim()) : [base];
    // a context bracket only makes the base ambiguous when it's one word or another entry ("Die (extrusion)")
    const ambiguous = qualified && (!/\s/.test(base) || NAMES.has(norm(base)));
    if (!ambiguous) e.variants.push(...parts);
    else e.qualifier = qualifier.toLowerCase().split(/[\s/]/)[0].slice(0, 5);   // mentions of "die" only count near "extru…"
    e.variants.slice().forEach(v => { if (/ (materials?|solids?)$/i.test(v)) e.variants.push(v.replace(/ (materials?|solids?)$/i, '')); });
    if (name.length <= 14 && !/\s/.test(name) && (isSymbol(name) || /[[\]{}<>()|]/.test(name))) e.symbols.push(name);   // λ_max, {hkl}, <uvw>

    e.id = entries.length;
    entries.push(e);
    if (!e.synthetic && !nameIndex.has(name.toLowerCase())) nameIndex.set(name.toLowerCase(), e);
    claim(wordIndex, norm(name), e, true);
    e.variants.forEach(v => claim(wordIndex, norm(v), e, false));
    [name, ...e.variants].forEach(v => { if (isAbbrev(v)) abbrevCase.set(norm(v), v); });
    if (ambiguous) parts.forEach(v => {   // two entries sharing a base ("Die (sheet)", "Die (extrusion)") cancel out
      const k = norm(v);
      weakIndex.set(k, weakIndex.has(k) && weakIndex.get(k) !== e ? null : e);
    });
    e.symbols.forEach(s => { const k = normSym(s); if (!symIndex.has(k)) symIndex.set(k, e); });
    return e;
  }

  // a bracket on a name that is also its own entry is context — "Porosity (grinding wheel)"
  const NAMES = new Set(Object.values(glossaryData).flatMap(t => t.terms.map(([n]) => norm(n))));

  Object.entries(glossaryData).forEach(([key, topic]) => {
    const color = (CFG.topicColors || {})[key] || 'var(--accent)';
    const tag = topicTag(key, topic.name);
    const label = topic.name.split(/ — |: /)[1] || topic.name;
    topic.terms.forEach(([name, def]) => addEntry({ name, def, key, tag, label, color }));
  });

  function findEntry(raw) {
    const t = raw.replace(/^[\s("'“‘]+|[\s.,;:!?)"'”’]+$/g, '');
    if (!t) return null;
    const n = norm(t);
    const tries = [n, n.replace(/ies$/, 'y'), n.replace(/es$/, ''), n.replace(/s$/, ''), n.replace(/^(the|a|an) /, '')];
    const exact = k => !abbrevCase.has(k) || [t, t.replace(/e?s$/, '')].includes(abbrevCase.get(k));
    for (const k of tries) if (wordIndex.has(k) && exact(k)) return wordIndex.get(k);
    for (const k of tries) if (weakIndex.get(k)) return weakIndex.get(k);
    const s = normSym(t);
    return symIndex.get(s) || null;
  }

  const comparisonData = typeof glossaryComparisons !== 'undefined' ? glossaryComparisons : (window.glossaryComparisons || []);
  comparisonData.forEach(c => {
    if (!c || !Array.isArray(c.terms)) return;
    const sides = c.terms.map((t, i) => findEntry(t) ||
      addEntry({ name: t, def: (c.defs && c.defs[i]) || '', key: null, tag: '', label: '', color: 'var(--text-2)', synthetic: true }));
    (c.aliases || []).forEach((list, i) => sides[i] && (list || []).forEach(a => {   // extra words that should find this side
      sides[i].variants.push(a);
      claim(wordIndex, norm(a), sides[i], false);
    }));
    const cmp = { title: c.title, names: c.terms, sides, rows: c.rows || [] };
    sides.forEach(e => { if (!e.comparisons.includes(cmp)) e.comparisons.push(cmp); });
  });

  entries.forEach(e => {
    const vs = [...new Set([e.name, ...e.variants]
      .map(v => v.replace(/\s*\([^)]*\)/g, '').trim()).filter(v => v.length >= 2))];
    e.re = vs.length ? wrapRe(vs.sort((a, b) => b.length - a.length).map(patternFor).join('|')) : null;
  });

  // words worth underlining: ≥4 letters, or an abbreviation / mixed-case token (pH, UTS)
  const linkable = [...new Set([...wordIndex.entries()].map(([k, e]) =>
    [e.name, ...e.variants].find(v => norm(v) === k)).filter(v => v && !/[()]/.test(v) &&
    (v.length >= 4 || isAbbrev(v) || /[A-Z]/.test(v.slice(1)))))];
  const TERM_RE = linkable.length ? wrapRe(linkable.sort((a, b) => b.length - a.length).map(patternFor).join('|')) : null;

  window.__terms = { entries, findEntry };   // for debugging from the console

  // ── AUTO-LINK FIRST MENTION PER PAGE ─────────
  function textNodes(root, skipSel) {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (!n.nodeValue.trim() || n.parentElement.closest(skipSel)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }

  function linkUnit(unit) {
    const seen = new Set();
    textNodes(unit, LINK_SKIP).forEach(node => {
      const text = node.nodeValue;
      let m, last = 0, frag = null;
      TERM_RE.lastIndex = 0;
      while ((m = TERM_RE.exec(text))) {
        const e = wordIndex.get(norm(m[1]));
        if (!e || seen.has(e)) continue;
        seen.add(e);
        frag = frag || document.createDocumentFragment();
        frag.append(text.slice(last, m.index));
        const span = document.createElement('span');
        span.className = 'gl-term';
        span.dataset.term = e.id;
        span.tabIndex = 0;
        span.textContent = m[0];
        frag.append(span);
        last = m.index + m[0].length;
      }
      if (frag) { frag.append(text.slice(last)); node.replaceWith(frag); }
    });
  }

  function linkSection(sec) {
    if (!TERM_RE) return;
    const pages = sec.querySelectorAll('.subpage');
    if (pages.length) pages.forEach(linkUnit); else linkUnit(sec);
  }

  // ── MENTIONS (where a term appears) ──────────
  function sectionLabel(id) {
    if ((CFG.topicLabels || {})[id]) return CFG.topicLabels[id];
    const tab = document.querySelector(`[data-section="${id}"]`);
    return tab ? tab.textContent.replace(/[↗]/g, '').trim() : id;
  }

  function cleanText(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('.katex-mathml, .tp-panel').forEach(n => n.remove());
    return c.textContent.replace(/\u200b/g, '').replace(/\s+/g, ' ');
  }

  const BLOCK_SEL = 'p,li,td,th,h1,h2,h3,h4,.formula-block,.concept-box,.trap-card,.example,.analogy,.card,.problem-card,div';

  function findMentions(e) {
    if (e.mentions) return e.mentions;
    const out = [];
    if (!e.re) return (e.mentions = out);
    const revise = document.body.classList.contains('revise-mode');
    const blocks = new Set();
    for (const sec of document.querySelectorAll(CONTENT_SEL)) {
      const heads = [...sec.querySelectorAll('h2,h3')];
      for (const node of textNodes(sec, MENTION_SKIP)) {
        if (out.length >= MENTION_MAX) break;
        const parent = node.parentElement;
        if (parent.closest(revise ? '.learn-only' : '.revise-only')) continue;
        e.re.lastIndex = 0;
        const m = e.re.exec(node.nodeValue);
        if (!m) continue;
        const block = parent.closest(BLOCK_SEL) || parent;
        if (blocks.has(block)) continue;       // one mention per paragraph / box
        const txt = cleanText(block);
        if (e.qualifier && !txt.toLowerCase().includes(e.qualifier)) continue;   // "die" only counts near "extrusion"
        blocks.add(block);
        let heading = '';
        for (const h of heads) {
          if (h.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) heading = cleanText(h).trim();
          else break;
        }
        if (/^h[1-4]$/i.test(block.tagName)) heading = '';
        e.re.lastIndex = 0;
        const bm = e.re.exec(txt) || { index: 0, 0: '' };
        const a = Math.max(0, bm.index - 55), b = Math.min(txt.length, bm.index + bm[0].length + 70);
        const snippet = (a > 0 ? '…' : '') + esc(txt.slice(a, bm.index)).trimStart() +
          `<mark>${esc(bm[0])}</mark>` + esc(txt.slice(bm.index + bm[0].length, b)).trimEnd() + (b < txt.length ? '…' : '');
        const page = node.parentElement.closest('.subpage');
        out.push({ node, index: m.index, length: m[0].length, sectionId: sec.id,
          page: page ? parseInt(page.dataset.page, 10) : 0, heading, snippet });
      }
    }
    return (e.mentions = out);
  }

  function jumpTo(mt) {
    if (!mt) return;
    hideCard();
    if (document.getElementById('fc-session')?.style.display === 'block' && window.exitFlashcards) exitFlashcards();
    showSection(mt.sectionId, null, mt.page);
    const node = mt.node;
    const ans = node.parentElement && node.parentElement.closest('.problem-answer:not(.visible)');
    if (ans) {
      const btn = ans.closest('.problem-card')?.querySelector('.reveal-btn');
      if (btn && window.toggleReveal) toggleReveal(btn); else ans.classList.add('visible');
    }
    node.parentElement?.closest('details:not([open])')?.setAttribute('open', '');

    // highlight: reuse a link span if the mention is one, otherwise wrap the words briefly
    let target = node.parentElement.classList.contains('gl-term') ? node.parentElement : null;
    if (!target && node.isConnected && mt.index + mt.length <= node.nodeValue.length) {
      const r = document.createRange();
      r.setStart(node, mt.index); r.setEnd(node, mt.index + mt.length);
      target = document.createElement('span');
      target.className = 'tp-flash-wrap';
      r.surroundContents(target);
      const wrap = target;
      setTimeout(() => {
        const p = wrap.parentNode;
        if (!p) return;
        wrap.replaceWith(...wrap.childNodes);
        p.normalize();
        resetMentions();   // text nodes changed; cached mentions would point at detached nodes
      }, 2600);
    }
    target = target || node.parentElement;
    setTimeout(() => {
      const y = target.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      target.classList.remove('tp-flash'); void target.offsetWidth; target.classList.add('tp-flash');
      setTimeout(() => target.classList.remove('tp-flash'), 2400);
    }, 80);
  }

  function resetMentions() { entries.forEach(x => { x.mentions = null; }); }

  // ── SHARED RENDERERS ─────────────────────────
  function comparisonHTML(e, max) {
    return e.comparisons.slice(0, max).map(c => {
      const self = c.sides.indexOf(e);
      const title = c.title ? esc(c.title) : c.names.map(esc).join(' <span>vs</span> ');
      return `<div class="tp-cmp">
        <div class="tp-cmp-title">${title}</div>
        <table><thead><tr><th></th>${c.names.map((n, i) => `<th class="${i === self ? 'is-self' : ''}">${esc(n)}</th>`).join('')}</tr></thead>
        <tbody>${c.rows.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map((cell, i) => `<td class="${i === self ? 'is-self' : ''}">${richText(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>
      </div>`;
    }).join('');
  }

  // ── PREVIEW CARD ─────────────────────────────
  const card = document.createElement('div');
  card.className = 'tp-card';
  card.setAttribute('role', 'tooltip');
  let current = null, showTimer = 0, hideTimer = 0;

  function cardHTML(e) {
    const n = findMentions(e).length;
    const meta = e.synthetic ? 'Comparison' : `${esc(e.tag)} · ${esc(e.label)}`;
    return `<div class="tp-arrow"></div>
      <div class="tp-body">
        <div class="tp-topic" style="color:${e.color}">${meta}</div>
        <div class="tp-title">${esc(e.name)}</div>
        ${e.def ? `<div class="tp-def">${richText(e.def)}</div>` : ''}
        ${comparisonHTML(e, 2)}
      </div>
      <div class="tp-foot">
        ${e.synthetic || !document.getElementById('glossary') ? '<span></span>' : '<button type="button" data-act="glossary">Open in glossary →</button>'}
        <span>${n ? `${n}${n >= MENTION_MAX ? '+' : ''} mention${n === 1 ? '' : 's'}` : ''}</span>
      </div>`;
  }

  function place(rect) {
    card.classList.remove('above');
    const cw = card.offsetWidth, ch = card.offsetHeight, gap = 10, pad = 8;
    const navH = (document.querySelector('.navbar')?.offsetHeight || 0) + 8;
    const vw = document.documentElement.clientWidth;
    const above = rect.bottom + gap + ch > window.innerHeight && rect.top - gap - ch > navH;
    const left = Math.min(Math.max(pad, rect.left - 14), vw - cw - pad);
    const top = above ? rect.top - gap - ch : rect.bottom + gap;
    card.classList.toggle('above', above);
    card.style.left = `${left + window.scrollX}px`;
    card.style.top = `${top + window.scrollY}px`;
    const ax = Math.min(Math.max(12, rect.left + Math.min(rect.width / 2, 22) - left - 5), cw - 22);
    card.querySelector('.tp-arrow').style.left = `${ax}px`;
  }

  function openCard(e, rect, source, anchor) {
    if (!e) return;
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (!card.isConnected) document.body.appendChild(card);
    const same = current && current.entry === e;
    current = { entry: e, source, anchor };
    if (!same || !card.classList.contains('open')) card.innerHTML = cardHTML(e);
    card.classList.toggle('wide', e.comparisons.length > 0);
    place(rect);
    requestAnimationFrame(() => card.classList.add('open'));
  }

  function hideCard() {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if (!current) return;
    current = null;
    card.classList.remove('open');
  }

  const entryOf = el => entries[+el.dataset.term];

  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mouseover', ev => {
      const t = ev.target.closest('.gl-term');
      if (t) {
        clearTimeout(hideTimer);
        if (current && current.anchor === t) return;
        clearTimeout(showTimer);
        showTimer = setTimeout(() => openCard(entryOf(t), t.getBoundingClientRect(), 'hover', t), current ? 120 : HOVER_DELAY);
      } else if (ev.target.closest('.tp-card')) {
        clearTimeout(hideTimer);
      }
    });
    document.addEventListener('mouseout', ev => {
      const from = ev.target.closest('.gl-term, .tp-card');
      if (!from || (ev.relatedTarget && from.contains(ev.relatedTarget))) return;
      clearTimeout(showTimer);
      if (current && current.source === 'hover') hideTimer = setTimeout(hideCard, HIDE_DELAY);
    });
  }

  document.addEventListener('focusin', ev => {
    const t = ev.target.closest && ev.target.closest('.gl-term');
    if (t && !t.matches(':hover')) openCard(entryOf(t), t.getBoundingClientRect(), 'focus', t);
  });
  document.addEventListener('focusout', ev => {
    if (current && current.source === 'focus' && !card.contains(ev.relatedTarget)) hideCard();
  });

  document.addEventListener('click', ev => {
    const act = ev.target.closest('.tp-card [data-act]');
    if (act && current) { if (act.dataset.act === 'glossary') openInGlossary(current.entry); return; }
    if (ev.target.closest('.tp-card')) return;
    const t = ev.target.closest('.gl-term');
    if (t) {
      if (current && current.anchor === t && current.source === 'click') { hideCard(); return; }
      openCard(entryOf(t), t.getBoundingClientRect(), 'click', t);
      current.source = 'click';
      return;
    }
    if (current && current.source !== 'select') hideCard();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && current) { hideCard(); ev.stopPropagation(); return; }
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList && ev.target.classList.contains('gl-term')) {
      ev.preventDefault(); ev.stopPropagation();
      openCard(entryOf(ev.target), ev.target.getBoundingClientRect(), 'click', ev.target);
    }
  }, true);
  window.addEventListener('resize', hideCard);
  window.addEventListener('popstate', hideCard);

  // ── SELECTION ("highlight a term") ───────────
  function checkSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const c = range.commonAncestorContainer;
    const host = c.nodeType === 1 ? c : c.parentElement;
    if (!host || host.closest('.tp-card, input, textarea, .navbar, .subpager, #fc-session')) return;
    const frag = range.cloneContents();
    frag.querySelectorAll('.katex-mathml').forEach(n => n.remove());
    const text = frag.textContent.replace(/\u200b/g, '').trim();
    if (!text || text.length > 60) return;
    const e = findEntry(text);
    if (!e) return;
    const rects = range.getClientRects();
    openCard(e, rects.length ? rects[0] : range.getBoundingClientRect(), 'select', null);
  }
  document.addEventListener('mouseup', ev => { if (!ev.target.closest('.tp-card')) setTimeout(checkSelection, 0); });
  document.addEventListener('keyup', ev => { if (ev.shiftKey) checkSelection(); });
  document.addEventListener('touchend', () => setTimeout(checkSelection, 400));
  document.addEventListener('selectionchange', () => {
    if (current && current.source === 'select' && window.getSelection().isCollapsed) hideCard();
  });

  // ── GLOSSARY: EXPANDABLE ENTRIES ─────────────
  function panelHTML(e) {
    const ms = findMentions(e);
    const plus = ms.length >= MENTION_MAX ? '+' : '';
    const list = ms.map((mt, i) => `
      <button type="button" class="tp-mention${i >= MENTION_SHOW ? ' tp-extra' : ''}" data-mention="${i}">
        <span class="tp-m-where"><b>${esc(sectionLabel(mt.sectionId))}</b>${mt.heading ? ` › ${esc(mt.heading)}` : ''}</span>
        <span class="tp-m-snip">${mt.snippet}</span>
      </button>`).join('');
    const more = ms.length > MENTION_SHOW
      ? `<button type="button" class="tp-more" data-act="more">Show ${ms.length - MENTION_SHOW}${plus} more</button>` : '';
    return `<div class="tp-panel">
      ${comparisonHTML(e, 3)}
      <div class="tp-mentions-label">${ms.length ? `Appears in ${ms.length}${plus} place${ms.length === 1 ? '' : 's'} — click to jump` : 'Only mentioned in the glossary'}</div>
      ${ms.length ? `<div class="tp-mentions">${list}</div>${more}` : ''}
    </div>`;
  }

  const itemEntry = item => nameIndex.get(item.dataset.name) || findEntry(item.dataset.name);

  function collapseItem(item) {
    item.classList.remove('expanded');
    item.setAttribute('aria-expanded', 'false');
    item.querySelector('.tp-panel')?.remove();
  }

  function expandItem(item) {
    const e = itemEntry(item);
    if (!e) return;
    document.querySelectorAll('#glossary .term-item.expanded').forEach(i => { if (i !== item) collapseItem(i); });
    item.classList.add('expanded');
    item.setAttribute('aria-expanded', 'true');
    item.insertAdjacentHTML('beforeend', panelHTML(e));
  }

  function prepItems(root) {
    root.querySelectorAll('.term-item:not([role])').forEach(i => {
      i.tabIndex = 0; i.setAttribute('role', 'button'); i.setAttribute('aria-expanded', 'false');
    });
  }

  function openInGlossary(e) {
    hideCard();
    showSection('glossary');
    if (window.exitFlashcards && document.getElementById('fc-session')) exitFlashcards();
    const input = document.getElementById('glossary-search-input');
    if (input) { input.value = e.name; input.dispatchEvent(new Event('input')); }
    const key = e.name.toLowerCase();
    const item = [...document.querySelectorAll('#glossary-pinned .term-item, #glossary .term-item:not(.hidden)')].find(i => i.dataset.name === key);
    if (!item) return;
    expandItem(item);
    setTimeout(() => {
      const y = item.getBoundingClientRect().top + window.scrollY - 170;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }, 80);
  }

  function initGlossaryExpand() {
    const root = document.getElementById('glossary');
    if (!root) return;
    prepItems(root);
    root.addEventListener('click', ev => {
      const item = ev.target.closest('.term-item');
      const mention = ev.target.closest('.tp-mention');
      if (mention && item) { const e = itemEntry(item); if (e) jumpTo(findMentions(e)[+mention.dataset.mention]); return; }
      const more = ev.target.closest('[data-act="more"]');
      if (more) { more.closest('.tp-panel').classList.add('show-all'); more.remove(); return; }
      if (!item || ev.target.closest('.tp-panel') || window.getSelection().toString().trim()) return;
      if (item.classList.contains('expanded')) collapseItem(item); else expandItem(item);
    });
    root.addEventListener('keydown', ev => {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList.contains('term-item')) {
        ev.preventDefault();
        if (ev.target.classList.contains('expanded')) collapseItem(ev.target); else expandItem(ev.target);
      }
    });
    // a new search or filter re-renders results; close open entries so nothing goes stale
    document.getElementById('glossary-search-input')?.addEventListener('input', () => {
      document.querySelectorAll('#glossary-container .term-item.expanded').forEach(collapseItem);
      const pinned = document.getElementById('glossary-pinned');
      if (pinned) { pinned.querySelectorAll('.term-item').forEach(collapseItem); prepItems(pinned); }
    });
    root.querySelectorAll('[data-gfilter]').forEach(b => b.addEventListener('click', () =>
      document.querySelectorAll('#glossary .term-item.expanded').forEach(collapseItem)));
  }

  // ── INIT ─────────────────────────────────────
  // Runs after engine.js's init (glossary built, subpages split, maths rendered).
  function init() {
    initGlossaryExpand();
    const secs = [...document.querySelectorAll(CONTENT_SEL)];
    const active = secs.find(s => s.classList.contains('active'));
    if (active) { secs.splice(secs.indexOf(active), 1); secs.unshift(active); }
    (function step() {   // one section per tick so first paint isn't held up
      const s = secs.shift();
      if (!s) { resetMentions(); return; }
      linkSection(s);
      setTimeout(step, 0);
    })();
    // learn/revise changes which text is visible, so recount mentions
    new MutationObserver(resetMentions)
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 0));
  else setTimeout(init, 0);
})();
