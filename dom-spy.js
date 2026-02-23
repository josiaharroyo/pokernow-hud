// ============================================================
// PokerNow DOM Spy — paste this into DevTools console
// while on a PokerNow game page.
//
// HOW TO USE:
//   1. Open a PokerNow game in Chrome
//   2. Open DevTools (F12 or Cmd+Option+I)
//   3. Go to the Console tab
//   4. Paste this entire script and hit Enter
//   5. Play through 1-2 complete hands
//   6. Type:  downloadLog()  and hit Enter to save the JSON file
//   7. Share the downloaded file
// ============================================================

(function () {
  if (window.__pokerSpy) {
    console.warn('[PokerSpy] Already running. Type stopSpy() to reset.');
    return;
  }

  const log = {
    startedAt: new Date().toISOString(),
    url: location.href,
    initialSnapshot: null,
    mutations: [],
    events: []
  };

  // ── Helpers ──────────────────────────────────────────────

  function ts() {
    return new Date().toISOString();
  }

  function getPath(el) {
    if (!el || el === document.body) return 'body';
    const parts = [];
    let node = el;
    while (node && node !== document.body) {
      let label = node.tagName ? node.tagName.toLowerCase() : '#text';
      if (node.id) label += `#${node.id}`;
      if (node.className && typeof node.className === 'string') {
        label += '.' + node.className.trim().split(/\s+/).join('.');
      }
      parts.unshift(label);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function getText(el) {
    if (!el) return '';
    return (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  }

  function describeNode(node) {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim();
      return text ? { type: 'text', content: text.slice(0, 200) } : null;
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      return {
        type: 'element',
        tag: node.tagName.toLowerCase(),
        id: node.id || null,
        classes: node.className && typeof node.className === 'string'
          ? node.className.trim().split(/\s+/)
          : [],
        text: getText(node),
        path: getPath(node)
      };
    }
    return null;
  }

  // Noise filter — skip mutations that carry no useful information
  function isNoise(mutation) {
    // Skip attribute changes that aren't class or style
    if (mutation.type === 'attributes') {
      const attr = mutation.attributeName;
      if (!['class', 'style', 'data-player-id', 'data-id',
            'data-seat', 'data-status'].includes(attr)) return true;
    }
    // Skip text-only mutations with blank content
    if (mutation.type === 'characterData') {
      const text = (mutation.target.textContent || '').trim();
      if (!text) return true;
    }
    return false;
  }

  // ── Initial DOM Snapshot ─────────────────────────────────

  function snapshotDOM() {
    function walk(el, depth) {
      if (depth > 8) return null;
      if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;

      const text = (el.childNodes.length === 1 &&
                    el.firstChild.nodeType === Node.TEXT_NODE)
        ? el.firstChild.textContent.trim().slice(0, 100)
        : null;

      const node = {
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: el.className && typeof el.className === 'string'
          ? el.className.trim().split(/\s+/).filter(Boolean)
          : undefined,
        text: text || undefined,
        children: []
      };

      for (const child of el.children) {
        const c = walk(child, depth + 1);
        if (c) node.children.push(c);
      }

      if (!node.children.length) delete node.children;
      return node;
    }

    // Try to snapshot the game container specifically
    const gameRoot =
      document.querySelector('.game-table') ||
      document.querySelector('.table') ||
      document.querySelector('[class*="game"]') ||
      document.querySelector('[class*="table"]') ||
      document.body;

    return {
      capturedAt: ts(),
      targetElement: getPath(gameRoot),
      tree: walk(gameRoot, 0)
    };
  }

  // ── MutationObserver ─────────────────────────────────────

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (isNoise(m)) continue;

      const entry = {
        t: ts(),
        type: m.type,
        target: describeNode(m.target),
      };

      if (m.type === 'attributes') {
        entry.attribute = m.attributeName;
        entry.oldValue = m.oldValue;
        entry.newValue = m.target.getAttribute(m.attributeName);
      }

      if (m.type === 'characterData') {
        entry.oldValue = (m.oldValue || '').trim().slice(0, 200);
        entry.newValue = (m.target.textContent || '').trim().slice(0, 200);
      }

      if (m.type === 'childList') {
        entry.added = Array.from(m.addedNodes)
          .map(describeNode)
          .filter(Boolean);
        entry.removed = Array.from(m.removedNodes)
          .map(describeNode)
          .filter(Boolean);

        // Skip empty childList mutations
        if (!entry.added.length && !entry.removed.length) continue;
      }

      log.mutations.push(entry);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    characterData: true,
    characterDataOldValue: true,
    attributeFilter: ['class', 'style', 'data-player-id', 'data-id',
                      'data-seat', 'data-status']
  });

  // ── Click / Key Event Logger ──────────────────────────────
  // Captures user interactions for cross-referencing with mutations

  function logEvent(e) {
    const entry = {
      t: ts(),
      eventType: e.type,
      target: describeNode(e.target)
    };
    if (e.type === 'keydown') entry.key = e.key;
    log.events.push(entry);
  }

  document.addEventListener('click', logEvent, true);
  document.addEventListener('keydown', logEvent, true);

  // ── Take initial snapshot after a short delay ─────────────

  setTimeout(() => {
    log.initialSnapshot = snapshotDOM();
    console.log('[PokerSpy] Initial DOM snapshot captured.');
  }, 500);

  // ── Public API ────────────────────────────────────────────

  window.__pokerSpy = { observer, log };

  window.downloadLog = function () {
    log.stoppedAt = ts();
    log.totalMutations = log.mutations.length;
    log.totalEvents = log.events.length;

    const json = JSON.stringify(log, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pokernow-dom-spy-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`[PokerSpy] Log downloaded. ${log.totalMutations} mutations, ${log.totalEvents} events.`);
  };

  window.spyStatus = function () {
    console.log(`[PokerSpy] Running. ${log.mutations.length} mutations, ${log.events.length} events logged so far.`);
  };

  window.stopSpy = function () {
    observer.disconnect();
    document.removeEventListener('click', logEvent, true);
    document.removeEventListener('keydown', logEvent, true);
    delete window.__pokerSpy;
    console.log('[PokerSpy] Stopped. Run downloadLog() to save what was captured.');
  };

  console.log('%c[PokerSpy] Active and recording.', 'color: #4ade80; font-weight: bold;');
  console.log('  spyStatus()   — see how many mutations logged so far');
  console.log('  downloadLog() — download the JSON log file');
  console.log('  stopSpy()     — stop recording');
})();
