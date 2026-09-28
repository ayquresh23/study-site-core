/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   MatSciEng Study Site — shared render.js
   Turns window.SITE_CONTENT (data) into the section markup
   that engine.js and base.css expect. Runs before engine.js's
   DOMContentLoaded init.

   Block types (topic.sections[]):
     {type:'toc', items:[{href,label}]}
     {type:'p', text, class}                    // class e.g. 'learn-only'
     {type:'h2', id, text}
     {type:'h3', text}
     {type:'conceptbox', variant, title, html}   // variant: 'note' | '' ; title may have learn-only/revise-only split via titleLearn/titleRevise
     {type:'formulablock', name, eq, eq2, vars:[{symbol,desc}], note}
     {type:'cardgrid', cards:[{title,color,text}]}
     {type:'example', label, q, steps:[str], answer}
     {type:'list', items:[str]}
     {type:'raw', html}                          // escape hatch — used verbatim, unmodified
   An unrecognized/unsupported type falls back to rendering nothing
   visible but logging a console warning, rather than throwing.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

(function () {
  const esc = s => (s == null ? '' : String(s));

  function renderBlock(b) {
    switch (b.type) {
      case 'toc':
        return `<div class="toc"><div class="toc-title">${esc(b.title || 'In this topic')}</div><ul class="toc-list">${
          b.items.map(i => `<li><a href="${esc(i.href)}" class="toc-link">→ ${esc(i.label)}</a></li>`).join('')
        }</ul></div>`;

      case 'p':
        return `<p${b.class ? ` class="${esc(b.class)}"` : ''}>${b.text}</p>`;

      case 'h2':
        return `<h2${b.id ? ` id="${esc(b.id)}"` : ''}>${b.text}</h2>`;

      case 'h3':
        return `<h3>${b.text}</h3>`;

      case 'conceptbox': {
        const cls = 'concept-box' + (b.variant ? ` ${b.variant}` : '');
        let titleHtml = '';
        if (b.titleLearn || b.titleRevise) {
          // A newline between these two divs (matching the source markup's
          // own formatting) keeps their text from visually/textually
          // running together -- purely cosmetic since both are
          // block-level, but avoids "SHEETQuick"-style word-merging.
          titleHtml = `${b.titleRevise ? `<div class="concept-box-title revise-only">${esc(b.titleRevise)}</div>\n` : ''}${b.titleLearn ? `<div class="concept-box-title learn-only">${esc(b.titleLearn)}</div>` : ''}`;
        } else if (b.title) {
          titleHtml = `<div class="concept-box-title">${esc(b.title)}</div>`;
        }
        return `<div class="${cls}">${titleHtml}${b.html || ''}</div>`;
      }

      case 'formulablock': {
        const vars = (b.vars || []).length
          ? `<div class="formula-vars">${b.vars.map(v => `<div class="formula-var"><span class="formula-var-symbol">${esc(v.symbol)}</span>${v.desc}</div>`).join('')}</div>`
          : '';
        const note = b.note ? `<p style="margin-top:10px">${b.note}</p>` : '';
        const eqs = b.eqs && b.eqs.length ? b.eqs : (b.eq ? [b.eq] : []);
        const eqsHtml = eqs.map((e, i) => `<div class="formula-eq"${i > 0 ? ' style="margin-top:8px"' : ''}>$$${e}$$</div>`).join('');
        return `<div class="formula-block"><div class="formula-name">${esc(b.name)}</div>${eqsHtml}${b.strayHtml || ''}${vars}${note}</div>`;
      }

      case 'cardgrid':
        return `<div class="card-grid">${
          b.cards.map(c => {
            // A card's text may already be pre-wrapped in one or more
            // <p> tags (multi-paragraph cards); only wrap it ourselves
            // when it's plain inline HTML.
            const body = /^\s*<p[\s>]/i.test(c.text || '') ? c.text : `<p>${c.text}</p>`;
            return `<div class="card">${c.title ? `<h4${c.color ? ` style="color:${esc(c.color)}"` : ''}>${esc(c.title)}</h4>` : ''}${body}</div>`;
          }).join('')
        }${b.strayHtml || ''}</div>`;

      case 'example':
        return `<div class="example">
          <div class="example-label">${esc(b.label)}</div>
          <p class="example-q">${b.q}</p>
          ${(b.steps || []).map(s => `<div class="example-step">${s}</div>`).join('')}
          ${b.answer ? `<div class="example-answer">${b.answer}</div>` : ''}
        </div>`;

      case 'list':
        return `<ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul>`;

      case 'raw':
        return b.html;

      default:
        console.warn('render.js: unknown block type', b.type, b);
        return '';
    }
  }

  function renderTopicSection(topic, idx, total) {
    const body = (topic.sections || []).map(renderBlock).join('\n');
    const essentials = topic.essentials
      ? `<h2>${esc(topic.essentialsTitle || 'Essentials')}</h2><div class="concept-box">${
          topic.essentialsHeading ? `<div class="concept-box-title revise-only">${esc(topic.essentialsHeading)}</div><div class="concept-box-title learn-only">Quick recap</div>` : ''
        }<ul>${topic.essentials.map(i => `<li>${i}</li>`).join('')}</ul></div>`
      : '';
    return `<section id="${esc(topic.id)}" class="section">
      <div class="container">
        <div class="topic-num">Topic ${idx + 1} of ${total}</div>
        <h1>${esc(topic.title)}</h1>
        ${topic.subtitle ? `<p class="hero-subtitle learn-only">${topic.subtitle}</p>` : ''}
        ${body}
        ${essentials}
      </div>
    </section>`;
  }

  function renderHome(content) {
    const h = content.home;
    const statsHtml = (h.stats || []).map(s => `<div class="hero-stat"><div class="hero-stat-value">${esc(s.value)}</div><div class="hero-stat-label">${esc(s.label)}</div></div>`).join('');
    const topicCards = content.topics.map(t => {
      if (t.soon) {
        return `<div class="topic-card" style="--bar-color:${esc(t.color)};opacity:0.45;pointer-events:none;cursor:default">
          <div class="topic-num">${esc(t.numLabel)}</div>
          <div class="topic-title">${esc(t.title)}</div>
          <div class="topic-desc">${esc(t.desc || 'Coming soon.')}</div>
        </div>`;
      }
      return `<div class="topic-card" onclick="showSection('${esc(t.id)}')" style="--bar-color:${esc(t.color)}">
        <div class="topic-num">${esc(t.numLabel)}</div>
        <div class="topic-title">${esc(t.title)}</div>
        <div class="topic-desc">${esc(t.desc)}</div>
        <div class="topic-meta">
          <div class="topic-meta-item">Difficulty: <span>${esc(t.difficulty || '—')}</span></div>
          <div class="topic-meta-item">Read: <span>${esc(t.readTime || '—')}</span></div>
        </div>
      </div>`;
    }).join('');
    const refCards = (h.refCards || []).map(r => `<div class="topic-card" onclick="showSection('${esc(r.section)}')" style="--bar-color:${esc(r.color)}">
      <div class="topic-num">Reference</div>
      <div class="topic-title">${esc(r.title)}</div>
      <div class="topic-desc">${esc(r.desc)}</div>
    </div>`).join('');

    return `<section id="home" class="section active">
      <div class="container">
        <div class="hero">
          <span class="hero-tag">${esc(h.tag)}</span>
          <h1>${esc(h.title)}</h1>
          <p class="hero-subtitle">${h.subtitle}</p>
          <div class="hero-stats">${statsHtml}</div>
        </div>
        <h2>Pick a topic</h2>
        <div class="progress-row">
          <span class="progress-label" style="flex-shrink:0">0 of ${(window.SITE_CONFIG.topicIds || []).length} topics visited</span>
          <div class="progress-track"><div class="progress-fill"></div></div>
        </div>
        <div class="card-grid">${topicCards}</div>
        ${h.refCards ? `<h2>Quick reference</h2><div class="card-grid">${refCards}</div>` : ''}
        ${(h.extra || []).map(renderBlock).join('\n')}
      </div>
    </section>`;
  }

  function renderFormulas(content) {
    if (!content.formulaSheet) return '';
    const body = content.formulaSheet.map(u => `<h2>${esc(u.heading)}</h2>${(u.blocks || []).map(renderBlock).join('')}`).join('\n');
    return `<section id="formulas" class="section">
      <div class="container">
        <h1>Formula Sheet</h1>
        <p class="hero-subtitle">${esc(content.formulaSheetSubtitle || 'Every calculation in the module. Variables defined, units stated.')}</p>
        ${body}
      </div>
    </section>`;
  }

  function renderGlossary(content) {
    if (typeof glossaryData === 'undefined') return '';
    const filterBtns = Object.entries(glossaryData).map(([k, v]) => `<button class="filter-btn" data-gfilter="${esc(k)}">${esc(v.filterLabel || v.name)}</button>`).join('');
    return `<section id="glossary" class="section">
      <div class="container-wide">
        <h1>Complete Glossary</h1>
        <p style="margin-bottom:24px;color:var(--text-2)">${esc(content.glossaryIntro || 'Search across all terms instantly. Filter by topic.')}</p>
        <div class="glossary-search-wrap">
          <div class="search-input-wrap">
            <input type="text" class="search-input" id="glossary-search-input" placeholder="Search any term, definition, or concept..." autocomplete="off">
            <span class="search-icon">⌕</span>
          </div>
          <span id="search-results-count"></span>
        </div>
        <button class="fc-open-btn" onclick="showSection('glossary');enterFlashcards()">📇 Flashcard mode</button>
        <div id="fc-session" style="display:none">
          <div class="fc-config">
            <div class="fc-config-row">
              <span class="fc-config-label">Topic</span>
              <div id="fc-topic-btns" class="fc-topic-btns" style="display:flex;gap:6px;flex-wrap:wrap"></div>
            </div>
            <div class="fc-config-row">
              <span class="fc-config-label">Cards</span>
              <select id="fc-qty-select" class="fc-qty-select" onchange="applyFcFilters()">
                <option value="all">All</option><option value="10">10</option><option value="20">20</option><option value="30">30</option><option value="50">50</option>
              </select>
              <button class="fc-reshuffle-btn" onclick="applyFcFilters()">🔀 Reshuffle</button>
              <button class="fc-exit-btn" onclick="exitFlashcards()">← Back to list</button>
            </div>
          </div>
          <div class="fc-viewport" onclick="fcFlip()">
            <div id="fc-card-inner" class="fc-card-inner">
              <div class="fc-card-face fc-front">
                <div id="fc-topic-label" class="fc-topic-label"></div>
                <div id="fc-term-text" class="fc-term-text"></div>
                <div class="fc-tap-hint">click · space · enter — reveal definition</div>
              </div>
              <div class="fc-card-face fc-back">
                <div id="fc-back-term" class="fc-back-term"></div>
                <div id="fc-def-text" class="fc-def-text"></div>
              </div>
            </div>
          </div>
          <div class="fc-nav-row">
            <button class="fc-nav-btn" id="fc-prev" onclick="fcPrev()">◀ Prev</button>
            <span class="fc-counter-display"><span id="fc-pos">1</span> / <span id="fc-total">0</span></span>
            <button class="fc-nav-btn" id="fc-next" onclick="fcNext()">Next ▶</button>
          </div>
          <div class="fc-progress-wrap"><div id="fc-progress-bar"></div></div>
        </div>
        <div id="fc-list-view">
          <div class="filter-row"><button class="filter-btn active" data-gfilter="all">All topics</button>${filterBtns}</div>
          <div id="glossary-container"></div>
          <div id="no-results" style="display:none;text-align:center;padding:60px 20px;color:var(--muted);font-family:'IBM Plex Mono',monospace">No terms found — try a different search</div>
        </div>
      </div>
    </section>`;
  }

  function renderTraps(content) {
    if (!content.traps) return '';
    const body = content.traps.map(u => `<h2>${esc(u.heading)}</h2>${(u.items || []).map(t => `<div class="trap-card"><span class="trap-tag">${esc(t.tag)}</span><div class="trap-claim">${t.claim}</div><div class="trap-truth">${t.truth}</div></div>`).join('')}`).join('\n');
    return `<section id="traps" class="section">
      <div class="container">
        <h1>MCQ Traps</h1>
        <p class="hero-subtitle">${esc(content.trapsSubtitle || "Plausible-but-wrong claims the exam uses. Read each one. Know what's actually true.")}</p>
        ${body}
      </div>
    </section>`;
  }

  window.renderSite = function () {
    const content = window.SITE_CONTENT;
    if (!content) { console.error('render.js: window.SITE_CONTENT not found'); return; }
    const root = document.getElementById('app');
    if (!root) { console.error('render.js: #app container not found'); return; }

    const total = content.topics.filter(t => !t.soon).length;
    let liveIdx = 0;
    const topicSections = content.topics.filter(t => !t.soon).map(t => renderTopicSection(t, liveIdx++, total)).join('\n');

    root.innerHTML = [
      renderHome(content),
      topicSections,
      content.extraSections ? content.extraSections.map(renderBlock).join('\n') : '',
      renderFormulas(content),
      renderGlossary(content),
      renderTraps(content)
    ].join('\n');
  };

  // Render before engine.js's DOMContentLoaded handler needs the DOM in place.
  // Since both scripts load synchronously in <head>/<body> order and engine.js
  // attaches its own DOMContentLoaded listener, we render immediately here
  // if the DOM is already parseable, else wait for DOMContentLoaded ourselves
  // at a slightly earlier point (same event, but this script tag must come
  // BEFORE engine.js in the HTML so its listener registers first).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSite);
  } else {
    renderSite();
  }
})();
