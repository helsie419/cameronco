(function () {
  var STOPWORDS = new Set(['a','an','the','do','does','did','is','are','was','were','be','how','to','i','can','in','on','of','for','my','me','please','you','your','it','this','that','and','or','with','when','where','what','why','who','from','into','up','set','get','so']);

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(function (w) { return w && !STOPWORDS.has(w); });
  }

  function collectText(nodes) {
    return nodes.map(function (n) { return n.textContent.trim(); }).join(' ').replace(/\s+/g, ' ').trim();
  }

  // Build a search index: one entry per h3 sub-topic (falling back to the
  // section itself when a section has no h3s), each carrying the DOM node
  // to scroll to (when `doc` is the live document) and the text that
  // follows it, up to the next h3.
  function buildIndex(doc) {
    var entries = [];
    doc.querySelectorAll('.manual-section').forEach(function (section) {
      var sectionTitle = (section.querySelector('h2') || {}).textContent || '';
      var h3s = Array.prototype.slice.call(section.querySelectorAll('h3'));
      if (!h3s.length) {
        var body = Array.prototype.slice.call(section.children).filter(function (el) { return el.tagName !== 'H2'; });
        entries.push({
          sectionId: section.id,
          sectionTitle: sectionTitle,
          heading: sectionTitle,
          bodyText: collectText(body),
          target: section,
        });
        return;
      }
      h3s.forEach(function (h3) {
        var body = [];
        var el = h3.nextElementSibling;
        while (el && el.tagName !== 'H3') { body.push(el); el = el.nextElementSibling; }
        entries.push({
          sectionId: section.id,
          sectionTitle: sectionTitle,
          heading: h3.textContent,
          bodyText: collectText(body),
          target: h3,
        });
      });
    });
    entries.forEach(function (e) {
      e.headingTokens = tokenize(e.heading);
      e.sectionTokens = tokenize(e.sectionTitle);
      e.bodyTokens = tokenize(e.bodyText);
    });
    return entries;
  }

  function scoreEntry(entry, queryTokens, rawQuery) {
    var score = 0;
    queryTokens.forEach(function (qt) {
      if (entry.headingTokens.indexOf(qt) !== -1) score += 3;
      if (entry.sectionTokens.indexOf(qt) !== -1) score += 2;
      if (entry.bodyTokens.indexOf(qt) !== -1) score += 1;
    });
    var lowerHeading = entry.heading.toLowerCase();
    var lowerBody = entry.bodyText.toLowerCase();
    if (rawQuery && (lowerHeading.indexOf(rawQuery) !== -1 || lowerBody.indexOf(rawQuery) !== -1)) score += 6;
    return score;
  }

  function search(index, query) {
    var queryTokens = tokenize(query);
    var rawQuery = query.trim().toLowerCase();
    if (!queryTokens.length) return { best: null, suggestions: [] };
    var scored = index.map(function (entry) {
      return { entry: entry, score: scoreEntry(entry, queryTokens, rawQuery) };
    }).filter(function (s) { return s.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
    return {
      best: scored.length ? scored[0].entry : null,
      suggestions: scored.slice(0, 3).map(function (s) { return s.entry; }),
    };
  }

  function truncate(text, max) {
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var lastSpace = cut.lastIndexOf(' ');
    return cut.slice(0, lastSpace > 40 ? lastSpace : max) + '…';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // The manuals content only lives in the DOM on user-manuals.html itself.
  // Everywhere else, fetch that page and build the index from its markup —
  // "Open this section" then links out to it instead of scrolling in-page.
  var IS_MANUALS_PAGE = /(^|\/)user-manuals\.html$/.test(location.pathname) || document.querySelector('.manual-section');
  var indexPromise = IS_MANUALS_PAGE
    ? Promise.resolve(buildIndex(document))
    : fetch('user-manuals.html')
        .then(function (r) { return r.text(); })
        .then(function (html) { return buildIndex(new DOMParser().parseFromString(html, 'text/html')); })
        .catch(function () { return []; });

  function init() {
    var chatEl = document.getElementById('manualChat');
    if (!chatEl) return;
    var toggle = document.getElementById('manualChatToggle');
    var panel = document.getElementById('manualChatPanel');
    var closeBtn = document.getElementById('manualChatClose');
    var form = document.getElementById('manualChatForm');
    var input = document.getElementById('manualChatInput');
    var messagesEl = document.getElementById('manualChatMessages');
    var greeted = false;

    function appendMessage(role, html) {
      var div = document.createElement('div');
      div.className = 'manual-chat-msg ' + role;
      div.innerHTML = html;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    // Best-effort — a visitor's question should never fail to answer just
    // because logging it didn't work.
    function logQuestion(question, matched, matchedHeading) {
      fetch('/api/manual-questions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: question, matched: matched, matchedHeading: matchedHeading, page: location.pathname.split('/').pop() || 'index.html' }),
      }).catch(function () {});
    }

    function jumpToTarget(target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target.classList.remove('manual-chat-target-flash');
      void target.offsetWidth; // restart animation if clicked again
      target.classList.add('manual-chat-target-flash');
      setTimeout(function () { target.classList.remove('manual-chat-target-flash'); }, 1700);
    }

    function answer(index, query) {
      var result = search(index, query);
      if (!result.best) {
        logQuestion(query, false, null);
        appendMessage('bot', "I couldn't find anything on that in the manuals. Try different words, or open the full Manuals page.");
        return;
      }
      var entry = result.best;
      logQuestion(query, true, entry.heading);
      var snippet = truncate(entry.bodyText, 220) || 'See this section for the full steps.';
      var href = IS_MANUALS_PAGE ? ('#' + entry.sectionId) : ('user-manuals.html#' + entry.sectionId);
      var html = '<span class="answer-heading">' + escapeHtml(entry.heading) + '</span>'
        + escapeHtml(snippet)
        + '<a class="answer-link" href="' + escapeHtml(href) + '">Open this section →</a>';
      var msgEl = appendMessage('bot', html);
      if (IS_MANUALS_PAGE) {
        var link = msgEl.querySelector('.answer-link');
        link.addEventListener('click', function (event) {
          event.preventDefault();
          jumpToTarget(entry.target);
        });
      }
    }

    function openPanel() {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        appendMessage('bot', 'Hi — ask me things like "How do I deactivate a staff member?" and I\'ll point you to the right manual section.');
        greeted = true;
      }
      input.focus();
    }
    function closePanel() {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (panel.hidden) openPanel(); else closePanel();
    });
    closeBtn.addEventListener('click', closePanel);

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var query = input.value.trim();
      if (!query) return;
      appendMessage('user', escapeHtml(query));
      input.value = '';
      indexPromise.then(function (index) { answer(index, query); });
    });

    // Arriving via a chat link's #section-id — flash the target so it's
    // obvious what the assistant sent you to.
    if (IS_MANUALS_PAGE && location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) setTimeout(function () { jumpToTarget(target); }, 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
