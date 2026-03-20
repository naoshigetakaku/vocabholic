/* ═══════════════════════════════════════════
   VOCABHOLIC — script.js
═══════════════════════════════════════════ */

const CLEAR_PASSWORD    = 'envPAByYj6w5IEFuC1Zy';
const REINSERTION_AFTER = 10;
const COOLDOWN_MS       = 5 * 60 * 1000;

const SAMPLES = [
  { word:'ephemeral',   jp:'はかない・束の間の',      type:'adj',  def:'Lasting for a very short time; transitory.',        usage:['The ephemeral beauty of cherry blossoms reminds us to cherish the present.','Fame can be ephemeral.','Her smile was ephemeral but unforgettable.'] },
  { word:'ubiquitous',  jp:'どこにでもある・遍在する', type:'adj',  def:'Present, appearing, or found everywhere.',           usage:['Smartphones have become ubiquitous in modern society.','The ubiquitous coffee shop can be found on every corner.','Plastic has become ubiquitous in daily life.'] },
  { word:'serendipity', jp:'思いがけない幸運',         type:'noun', def:'The occurrence of events by chance in a happy way.', usage:['Finding that rare book was pure serendipity.','Many great discoveries happened by serendipity.','Their meeting was a beautiful act of serendipity.'] },
  { word:'resilience',  jp:'回復力・しなやかさ',        type:'noun', def:'The capacity to recover quickly from difficulties.', usage:['Her resilience in the face of hardship inspired everyone.','Children often show remarkable resilience.','The city demonstrated great resilience after the flood.'] },
  { word:'pragmatic',   jp:'実用的な・実際的な',        type:'adj',  def:'Dealing with things sensibly and realistically.',   usage:['We need a pragmatic approach to solving this problem.','She is a pragmatic leader who focuses on results.','His advice was always pragmatic and useful.'] },
];

let words        = JSON.parse(localStorage.getItem('vh_words')    || 'null') || [];
let wordStatus   = JSON.parse(localStorage.getItem('vh_status')   || '{}');
let wordSeen     = JSON.parse(localStorage.getItem('vh_seen')     || '{}');
let quizCooldown = JSON.parse(localStorage.getItem('vh_cooldown') || '{}');
let wordScrolled = JSON.parse(localStorage.getItem('vh_scrolled') || '{}');

function save() {
  localStorage.setItem('vh_words',    JSON.stringify(words));
  localStorage.setItem('vh_status',   JSON.stringify(wordStatus));
  localStorage.setItem('vh_seen',     JSON.stringify(wordSeen));
  localStorage.setItem('vh_cooldown', JSON.stringify(quizCooldown));
  localStorage.setItem('vh_scrolled', JSON.stringify(wordScrolled));
}

/* ══════════════════════════════════════════
   CAMBRIDGE FETCH
══════════════════════════════════════════ */
async function fetchCambridgeData(word) {
  const url   = `https://dictionary.cambridge.org/dictionary/english-japanese/${encodeURIComponent(word)}`;
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  try {
    const res  = await fetch(proxy, { signal: AbortSignal.timeout(10000) });
    const json = await res.json();
    const doc  = new DOMParser().parseFromString(json.contents || '', 'text/html');
    const usageEls = [...doc.querySelectorAll('.eg .deg, .examp .deg')].slice(0, 3);
    return {
      type:  doc.querySelector('.pos')?.textContent.trim()         || '',
      def:   doc.querySelector('.def')?.textContent.trim()         || '',
      jp:    doc.querySelector('.trans.dtrans')?.textContent.trim() || '',
      usage: usageEls.map(e => e.textContent.trim()).filter(Boolean),
    };
  } catch { return null; }
}

async function importAndFetch() {
  const txt = document.getElementById('tsv-area').value.trim();
  if (!txt) { showToast('Nothing to import'); return; }

  const rawWords = txt.split('\n')
    .map(l => l.split('\t')[0].trim())
    .filter(w => w && !w.toLowerCase().startsWith('word'));
  if (!rawWords.length) { showToast('No words found'); return; }

  const prog   = document.getElementById('fetch-progress');
  const bar    = document.getElementById('fetch-bar');
  const status = document.getElementById('fetch-status');
  prog.style.display = 'flex';

  let done = 0, added = 0;
  for (const word of rawWords) {
    status.textContent = `Fetching "${word}" (${done+1}/${rawWords.length})…`;
    bar.style.width    = `${Math.round((done/rawWords.length)*100)}%`;
    if (words.find(w => w.word.toLowerCase() === word.toLowerCase())) { done++; continue; }
    const data  = await fetchCambridgeData(word);
    const entry = { word, jp: data?.jp||'', type: data?.type||'', def: data?.def||'', usage: data?.usage||[] };
    const idx   = words.findIndex(w => w.word === word);
    if (idx >= 0) words[idx] = entry; else words.push(entry);
    added++; done++; save();
  }
  bar.style.width    = '100%';
  status.textContent = `Done — ${added} word${added!==1?'s':''} added.`;
  setTimeout(() => { prog.style.display = 'none'; }, 2500);
  renderWordList(); updateBadge();
  showToast(`Imported ${added} word${added!==1?'s':''}`);
}

function exportTSV() {
  const header = 'word\tjapanese\ttype\tdefinition\tusage1\tusage2\tusage3';
  const rows   = words.map(w => {
    const u = Array.isArray(w.usage) ? w.usage : [w.usage||''];
    return [w.word, w.jp, w.type, w.def, u[0]||'', u[1]||'', u[2]||''].join('\t');
  });
  const blob = new Blob([[header,...rows].join('\n')], { type:'text/tab-separated-values' });
  const a    = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'vocabholic_words.tsv'; a.click();
  showToast('TSV exported');
}

function loadSamples() {
  SAMPLES.forEach(nw => { if (!words.find(w => w.word === nw.word)) words.push(nw); });
  save(); showToast(`Loaded ${SAMPLES.length} sample words`); renderWordList(); updateBadge();
}

/* ══════════════════════════════════════════
   TEXT FIT
══════════════════════════════════════════ */
function fitText(el, maxSize, minSize) {
  if (!el) return;
  const maxW = el.parentElement.clientWidth - 48;
  let size = maxSize;
  while (size > minSize) {
    el.style.fontSize = size + 'px';
    if (el.scrollWidth <= maxW) break;
    size--;
  }
}
function fitAllText(container) {
  if (!container) return;
  const wordEl  = container.querySelector('.word');
  const jpEl    = container.querySelector('.jp-word');
  const qPrompt = container.querySelector('.quiz-prompt');
  if (wordEl)  fitText(wordEl,  40, 16);
  if (jpEl)    fitText(jpEl,    28, 12);
  if (qPrompt) fitText(qPrompt, 30, 14);
}

/* ══════════════════════════════════════════
   EXPLORE FILTER
══════════════════════════════════════════ */
let activeFilter = null; // null | 'unknown' | 'known'

function toggleFilter(f) {
  activeFilter = activeFilter === f ? null : f;
  document.getElementById('fseg-unknown')?.classList.toggle('active', activeFilter === 'unknown');
  document.getElementById('fseg-known')?.classList.toggle('active',   activeFilter === 'known');
  renderExploreFeed();
}

/* ══════════════════════════════════════════
   EXPLORE FEED — weighted deck
══════════════════════════════════════════ */
function buildDeck() {
  if (!words.length) return [];

  let pool = words;
  if (activeFilter === 'unknown') pool = words.filter(w => wordStatus[w.word] === 'unknown');
  else if (activeFilter === 'known') pool = words.filter(w => wordStatus[w.word] === 'known');
  if (!pool.length) return [];

  const sh = arr => [...arr].sort(() => Math.random() - .5);

  const unknown = pool.filter(w => wordStatus[w.word] === 'unknown');
  const neutral = pool.filter(w => !wordStatus[w.word]);
  const known   = pool.filter(w => wordStatus[w.word] === 'known');

  // unknown ×2, neutral ×1, known ×0.5
  const raw = [
    ...sh(unknown), ...sh(unknown),
    ...sh(neutral),
    ...sh(known).filter((_,i) => i%2===0),
  ];

  // Final shuffle, deduplicate consecutive
  const final = [];
  sh(raw).forEach(w => {
    if (!final.length || final[final.length-1].word !== w.word) final.push(w);
  });
  return final;
}

function renderExploreFeed() {
  const feed = document.getElementById('card-feed');
  feed.innerHTML = '';
  if (!words.length) {
    feed.innerHTML = emptyStateHTML(bookIcon(), 'No words yet', 'Import a TSV or load sample words to start exploring.');
    return;
  }
  const deck = buildDeck();
  if (!deck.length) {
    feed.innerHTML = emptyStateHTML(bookIcon(), 'No words in this filter', 'Switch filter or swipe more cards first.');
    return;
  }
  deck.forEach(w => feed.appendChild(makeCardSlide(w)));
  initSwipe();
}

function makeCardSlide(w) {
  const st = wordStatus[w.word] || '';
  const el = document.createElement('div');
  el.className    = 'card-slide';
  el.dataset.word = w.word;
  el.dataset.status = st;

  // Normalize usage — handle plain string, array, or accidentally stringified JSON
  let usageArr = w.usage;
  if (typeof usageArr === 'string') {
    try { usageArr = JSON.parse(usageArr); } catch { usageArr = [usageArr]; }
  }
  if (!Array.isArray(usageArr)) usageArr = usageArr ? [usageArr] : [];
  const examples = usageArr.slice(0, 3);
  const usageHTML = examples.length
    ? `<div class="section-label" style="margin-top:2px">Examples</div>
       ${examples.map(u => `<div class="usage-ex">${escHtml(u)}</div>`).join('')}`
    : '';

  const youglishURL = `https://youglish.com/pronounce/${encodeURIComponent(w.word)}/english`;

  el.innerHTML = `
    <div class="flashcard">
      <div class="card-inner">
        <div class="card-face card-front">
          <div class="swipe-indicators">
            <div class="swipe-arrow left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
            </div>
            <div class="swipe-arrow right">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h14M14 5l7 7-7 7"/></svg>
            </div>
          </div>
          <div class="word-type">${escHtml(w.type||'')}</div>
          <div class="word">${escHtml(w.word)}</div>
          <div class="tap-hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            Double-tap to reveal
          </div>
        </div>
        <div class="card-face card-back">
          <div class="back-type">${escHtml(w.type||'')}</div>
          <div class="jp-word">${escHtml(w.jp||'')}</div>
          <div class="cb-divider"></div>
          <div class="section-label">Definition</div>
          <div class="definition">${escHtml(w.def||'')}</div>
          ${usageHTML}
          <a class="youglish-btn" href="${youglishURL}" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="13" height="13"><polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/></svg>
            YouGlish
          </a>
        </div>
      </div>
    </div>`;

  // YouGlish button — needs its own touch handler to prevent swipe listener from blocking it
  const ygBtn = el.querySelector('.youglish-btn');
  if (ygBtn) {
    ygBtn.addEventListener('touchend', e => {
      e.stopPropagation();
      window.open(ygBtn.href, '_blank', 'noopener');
    }, { passive: true });
  }

  // Double-tap — 500ms window
  const fc = el.querySelector('.flashcard');
  let lastTap = 0, tapTimer = null;
  fc.addEventListener('touchend', e => {
    // Ignore taps on the youglish button
    if (e.target.closest('.youglish-btn')) return;
    const now = Date.now(), delta = now - lastTap;
    if (delta < 500 && delta > 0) {
      clearTimeout(tapTimer);
      e.preventDefault();
      fc.querySelector('.card-inner').classList.toggle('flipped');
      lastTap = 0;
    } else {
      lastTap = now;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { lastTap = 0; }, 510);
    }
  }, { passive: false });
  fc.addEventListener('dblclick', () => fc.querySelector('.card-inner').classList.toggle('flipped'));

  requestAnimationFrame(() => fitAllText(el));
  return el;
}

/* ── Swipe ── */
let txStart = 0, tyStart = 0;

function initSwipe() {
  const feed  = document.getElementById('card-feed');
  const fresh = feed.cloneNode(false);
  while (feed.firstChild) fresh.appendChild(feed.firstChild);
  feed.parentNode.replaceChild(fresh, feed);
  const f = document.getElementById('card-feed');
  f.addEventListener('touchstart', e => { txStart = e.touches[0].clientX; tyStart = e.touches[0].clientY; }, { passive:true });
  f.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - txStart;
    const dy = e.changedTouches[0].clientY - tyStart;
    if (Math.abs(dx) > Math.abs(dy)*1.5 && Math.abs(dx) > 55) {
      const slide = currentSlide();
      if (slide) markCard(slide, dx > 0 ? 'known' : 'unknown');
    }
  }, { passive:true });
}

function currentSlide() {
  const feed   = document.getElementById('card-feed');
  const slides = [...feed.querySelectorAll('.card-slide')];
  return slides.find(s => Math.abs(s.offsetTop - feed.scrollTop) < s.offsetHeight/2) || slides[0];
}

function markCard(slide, status) {
  const w = slide.dataset.word;
  wordStatus[w] = status;
  wordSeen[w]   = (wordSeen[w]||0) + 1;
  wordScrolled[w] = Date.now();
  save();
  slide.dataset.status = status;
  slide.querySelector('.flashcard').classList.add(status === 'known' ? 'swiped-right' : 'swiped-left');
  showToast(status === 'known' ? 'Marked as known ✓' : 'Will review again');
  setTimeout(() => {
    slide.classList.add(status === 'known' ? 'swiped-right' : 'swiped-left');
    const next = slide.nextElementSibling;
    if (next) next.scrollIntoView({ behavior:'smooth', block:'start' });
  }, 280);
  updateBadge();
}

/* ══════════════════════════════════════════
   QUIZ
══════════════════════════════════════════ */
let quizJPtoEN    = false;
let quizN         = 10;
let quizQuestions = [];
let quizCur       = 0;
let quizScore     = { c:0, w:0 };
let quizWrongWords = []; // words answered incorrectly this session

function toggleLang() {
  quizJPtoEN = !quizJPtoEN;
  document.getElementById('lang-toggle').classList.toggle('on', quizJPtoEN);
}

function selectQuizN(n, btn) {
  quizN = n;
  document.querySelectorAll('.qs-n-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function showQuizStart() {
  document.getElementById('quiz-start-screen').style.display  = 'flex';
  document.getElementById('quiz-active').style.display        = 'none';
  document.getElementById('quiz-result-screen').style.display = 'none';
}

function startQuiz() {
  if (words.length < 4) {
    showToast('Need at least 4 words');
    return;
  }
  quizScore = { c:0, w:0 };
  quizCur   = 0;
  quizWrongWords = [];
  quizQuestions = buildQuizPool();

  document.getElementById('quiz-start-screen').style.display  = 'none';
  document.getElementById('quiz-active').style.display        = 'flex';
  document.getElementById('quiz-result-screen').style.display = 'none';

  renderQuiz();
}

function stopQuiz() {
  showQuizStart();
}

function buildQuizPool() {
  const now = Date.now();
  const sh  = arr => [...arr].sort(() => Math.random() - .5);

  const unknown = words.filter(w => wordStatus[w.word] === 'unknown');
  const neutral = words.filter(w => !wordStatus[w.word]);
  const known   = words.filter(w =>
    wordStatus[w.word] === 'known' && (!quizCooldown[w.word] || now > quizCooldown[w.word])
  );

  const TEN_MIN = 10 * 60 * 1000;
  const recent  = words.filter(w => wordScrolled[w.word] && (now - wordScrolled[w.word]) < TEN_MIN);

  const pool = [
    ...sh(unknown), ...sh(unknown),
    ...sh(recent),
    ...sh(neutral),
    ...sh(known),
  ];

  // Dedup keeping first occurrence
  const seen = new Set();
  const unique = pool.filter(w => { if (seen.has(w.word)) return false; seen.add(w.word); return true; });

  return unique.slice(0, quizN).map(w => makeQuestion(w));
}

function makeQuestion(w) {
  const others  = words.filter(x => x.word !== w.word).sort(() => Math.random()-.5).slice(0,3);
  const correct = quizJPtoEN ? w.word : w.jp;
  const wrongs  = others.map(x => quizJPtoEN ? x.word : x.jp);
  return {
    prompt:    quizJPtoEN ? w.jp   : w.word,
    typeHint:  w.type || '',
    correct,
    opts:      [correct, ...wrongs].sort(() => Math.random()-.5),
    word:      w.word,
    isUnknown: wordStatus[w.word] === 'unknown',
    answered:  false,
  };
}

function renderQuiz() {
  const total = quizQuestions.length;
  document.getElementById('qp-label').textContent = `${Math.min(quizCur+1, total)} / ${total}`;
  document.getElementById('qp-fill').style.width  = `${total ? (quizCur/total)*100 : 0}%`;

  const body = document.getElementById('quiz-body');
  body.innerHTML = '';

  // Score tally — always visible
  const sc = document.createElement('div');
  sc.className = 'quiz-score';
  sc.innerHTML = `
    <div class="score-item"><div class="score-num g">${quizScore.c}</div><div class="score-label">Correct</div></div>
    <div class="score-item"><div class="score-num r">${quizScore.w}</div><div class="score-label">Wrong</div></div>
    <div class="score-item"><div class="score-num" style="color:var(--text-muted)">${total - quizCur}</div><div class="score-label">Left</div></div>`;
  body.appendChild(sc);

  if (quizCur >= total) {
    showQuizResult();
    return;
  }

  const q    = quizQuestions[quizCur];
  const card = document.createElement('div');
  card.className = 'quiz-card';
  card.innerHTML = `
    ${q.isUnknown ? `<div class="quiz-priority-tag">Review word</div>` : ''}
    <div class="quiz-q-label">${quizJPtoEN ? 'English word for…' : 'Japanese for…'}</div>
    <div class="quiz-prompt">${escHtml(q.prompt)}</div>
    ${q.typeHint ? `<div class="quiz-type">${escHtml(q.typeHint)}</div>` : ''}
    <div class="quiz-opts" id="quiz-opts"></div>
    <div class="quiz-chip" id="quiz-chip"></div>`;
  body.appendChild(card);

  const optsEl = document.getElementById('quiz-opts');
  q.opts.forEach(opt => {
    const btn = document.createElement('button');
    btn.className   = 'qopt';
    btn.textContent = opt;
    btn.addEventListener('click', () => answerQuiz(opt, q, optsEl));
    optsEl.appendChild(btn);
  });

  requestAnimationFrame(() => fitAllText(card));
}

function answerQuiz(chosen, q, optsEl) {
  if (q.answered) return;
  q.answered = true;
  const ok = chosen === q.correct;
  if (ok) quizScore.c++; else quizScore.w++;

  if (!ok) {
    wordStatus[q.word] = 'unknown';
    if (!quizWrongWords.find(w => w.word === q.word)) {
      const entry = words.find(w => w.word === q.word);
      if (entry) quizWrongWords.push({ ...entry, yourAnswer: chosen, correct: q.correct });
    }
  }
  if (ok)  {
    quizCooldown[q.word] = Date.now() + COOLDOWN_MS;
    if (wordStatus[q.word] === 'unknown') wordStatus[q.word] = 'known';
  }
  save();

  optsEl.querySelectorAll('.qopt').forEach(b => {
    b.classList.add('disabled');
    if (b.textContent === q.correct) b.classList.add('reveal');
  });
  const clicked = [...optsEl.querySelectorAll('.qopt')].find(b => b.textContent === chosen);
  if (clicked) clicked.classList.add(ok ? 'correct' : 'wrong');

  const chip = document.getElementById('quiz-chip');
  chip.className   = `quiz-chip visible ${ok ? 'chip-c' : 'chip-w'}`;
  chip.textContent = ok ? 'Correct!' : `Answer: ${q.correct}`;

  quizCur++;
  setTimeout(renderQuiz, 1150);
}

/* ── Result screen ── */
function showQuizResult() {
  const total = quizQuestions.length;
  const pct   = total ? Math.round((quizScore.c / total) * 100) : 0;

  document.getElementById('quiz-active').style.display        = 'none';
  document.getElementById('quiz-result-screen').style.display = 'flex';

  document.getElementById('qr-correct').textContent = quizScore.c;
  document.getElementById('qr-wrong').textContent   = quizScore.w;
  document.getElementById('qr-total').textContent   = total;

  const pctEl = document.getElementById('qr-pct');
  pctEl.textContent = pct + '%';
  pctEl.className   = `qr-pct ${pct >= 70 ? 'good' : pct >= 40 ? 'mid' : 'bad'}`;

  // Reset toggle
  const toggleBtn  = document.getElementById('qr-wrong-toggle-btn');
  const listEl     = document.getElementById('qr-wrong-list');
  const toggleWrap = document.getElementById('qr-wrong-toggle-wrap');
  toggleBtn.classList.remove('open');
  listEl.style.display = 'none';

  // Build missed words list
  listEl.innerHTML = '';
  if (quizWrongWords.length === 0) {
    listEl.innerHTML = '<div class="qr-no-wrong">No mistakes.</div>';
    toggleBtn.textContent = 'No mistakes.';
    toggleBtn.style.pointerEvents = 'none';
    toggleBtn.style.opacity = '.5';
    // hide chevron
    toggleBtn.innerHTML = 'No mistakes.';
  } else {
    toggleBtn.style.pointerEvents = '';
    toggleBtn.style.opacity = '';
    toggleBtn.innerHTML = `See incorrect answers <svg id="qr-toggle-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><polyline points="6 9 12 15 18 9"/></svg>`;
    quizWrongWords.forEach(w => {
      const item = document.createElement('div');
      item.className = 'qr-wrong-item';
      item.innerHTML = `
        <div class="qr-wrong-word">${escHtml(w.word)}</div>
        <div class="qr-wrong-jp">${escHtml(w.jp||'')}</div>
        <div class="qr-wrong-ans">
          <span class="qr-ans-wrong">${escHtml(w.yourAnswer||'')}</span>
          <span class="qr-ans-arrow">→</span>
          <span class="qr-ans-correct">${escHtml(w.correct||'')}</span>
        </div>`;
      listEl.appendChild(item);
    });
  }
}

function toggleMissedWords() {
  const btn    = document.getElementById('qr-wrong-toggle-btn');
  const list   = document.getElementById('qr-wrong-list');
  const isOpen = btn.classList.contains('open');
  btn.classList.toggle('open', !isOpen);
  list.style.display = isOpen ? 'none' : 'flex';
}

/* ══════════════════════════════════════════
   VIEW SWITCHING
══════════════════════════════════════════ */
let currentView = 'explore';

function switchView(v) {
  currentView = v;
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(x  => x.classList.remove('active'));
  document.getElementById(`${v}-view`).classList.add('active');
  document.getElementById(`tab-${v}`)?.classList.add('active');

  // Filter bar only visible in explore
  document.getElementById('filter-bar').style.display = v === 'explore' ? 'flex' : 'none';

  if (v === 'explore') renderExploreFeed();
  if (v === 'quiz')    showQuizStart();
}

/* ══════════════════════════════════════════
   WORD MANAGER
══════════════════════════════════════════ */
function openManager() {
  document.getElementById('modal-overlay').classList.add('open');
  switchWMTab('import');
}
function closeManager() {
  document.getElementById('modal-overlay').classList.remove('open');
  updateBadge();
  if (currentView === 'explore') renderExploreFeed();
}

document.getElementById('open-manager-btn').addEventListener('click', openManager);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target.id === 'modal-overlay') closeManager();
});

function switchWMTab(t) {
  document.querySelectorAll('.wm-tab').forEach((b,i) =>
    b.classList.toggle('active', ['import','words'][i] === t)
  );
  document.getElementById('import-panel').style.display         = t==='import' ? 'flex' : 'none';
  document.getElementById('import-panel').style.flexDirection   = 'column';
  document.getElementById('wm-words-panel').style.display       = t==='words'  ? 'flex' : 'none';
  document.getElementById('wm-words-panel').style.flexDirection = 'column';
  if (t === 'words') renderWordList();
}

/* File / drag */
document.getElementById('file-input').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { document.getElementById('tsv-area').value = ev.target.result; showToast('File loaded — press Import & Fetch'); };
  r.readAsText(f); e.target.value = '';
});
const dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent3)'; });
dropZone.addEventListener('dragleave', ()  => { dropZone.style.borderColor = ''; });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.style.borderColor = '';
  const f = e.dataTransfer.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { document.getElementById('tsv-area').value = ev.target.result; showToast('File loaded — press Import & Fetch'); };
  r.readAsText(f);
});

/* Word list */
function renderWordList() {
  const q = (document.getElementById('search-words')?.value||'').toLowerCase();
  const filtered   = words.filter(w => matchQuery(w, q));
  const unknownW   = filtered.filter(w => wordStatus[w.word]==='unknown');
  const neutralW   = filtered.filter(w => !wordStatus[w.word]);
  const knownW     = filtered.filter(w => wordStatus[w.word]==='known');
  const list       = [...unknownW, ...neutralW, ...knownW];

  const con = document.getElementById('wl-list');
  con.innerHTML = '';
  if (!list.length) { con.innerHTML = `<div class="wl-empty-section">No words here yet.</div>`; return; }

  list.forEach(w => {
    const id   = w.word.replace(/[^a-zA-Z0-9]/g,'_');
    const st   = wordStatus[w.word]==='unknown' ? 'unknown' : wordStatus[w.word]==='known' ? 'known' : 'neutral';
    const item = document.createElement('div');
    item.className = `word-list-item ${st==='unknown'?'is-unknown':st==='known'?'is-known':''}`;
    item.style.cssText = 'flex-direction:column;align-items:stretch';
    item.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span class="wli-word">${escHtml(w.word)}</span>
        <span class="wli-jp">${escHtml(w.jp)}</span>
        <div class="wli-actions">
          <button class="wli-btn" onclick="toggleEdit('${id}')" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="wli-btn del" onclick="delWord('${w.word}')" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
      <div class="wli-edit-row" id="er-${id}">
        <input  placeholder="English word"          value="${escAttr(w.word)}"  data-f="word">
        <input  placeholder="Japanese"               value="${escAttr(w.jp)}"    data-f="jp">
        <input  placeholder="Type (adj/noun/verb…)"  value="${escAttr(w.type)}"  data-f="type">
        <textarea placeholder="Definition"           data-f="def">${escHtml(w.def)}</textarea>
        <input  placeholder="Usage example 1"        value="${escAttr(usageStr(w,0))}" data-f="usage0">
        <input  placeholder="Usage example 2"        value="${escAttr(usageStr(w,1))}" data-f="usage1">
        <input  placeholder="Usage example 3"        value="${escAttr(usageStr(w,2))}" data-f="usage2">
        <button class="wli-save-btn" onclick="saveEdit('${w.word}','${id}',this)">Save</button>
      </div>`;
    con.appendChild(item);
  });
}

function usageStr(w, idx) {
  const u = Array.isArray(w.usage) ? w.usage : (w.usage ? [w.usage] : []);
  return u[idx]||'';
}
function matchQuery(w, q) {
  if (!q) return true;
  return w.word.toLowerCase().includes(q) || (w.jp||'').toLowerCase().includes(q);
}
function toggleEdit(id) { document.getElementById(`er-${id}`)?.classList.toggle('open'); }

function saveEdit(orig, id, btn) {
  const row = btn.closest('.wli-edit-row');
  const f   = {};
  row.querySelectorAll('[data-f]').forEach(el => { f[el.dataset.f] = el.value.trim(); });
  const idx = words.findIndex(w => w.word === orig);
  if (idx < 0) return;
  const usage = [f.usage0, f.usage1, f.usage2].filter(Boolean);
  words[idx] = { word:f.word, jp:f.jp, type:f.type, def:f.def, usage };
  if (f.word !== orig) {
    wordStatus[f.word]   = wordStatus[orig];
    wordSeen[f.word]     = wordSeen[orig];
    quizCooldown[f.word] = quizCooldown[orig];
    wordScrolled[f.word] = wordScrolled[orig];
    delete wordStatus[orig]; delete wordSeen[orig]; delete quizCooldown[orig]; delete wordScrolled[orig];
  }
  save(); showToast('Word updated'); renderWordList();
}

function delWord(word) {
  words = words.filter(w => w.word !== word);
  delete wordStatus[word]; delete wordSeen[word]; delete quizCooldown[word]; delete wordScrolled[word];
  save(); renderWordList(); updateBadge(); showToast('Word removed');
}

function addNewWord() {
  words.unshift({ word:'', jp:'', type:'', def:'', usage:[] });
  switchWMTab('words'); renderWordList();
  setTimeout(() => document.querySelector('#wl-list .wli-edit-row')?.classList.add('open'), 60);
}

function clearAllWords() {
  document.getElementById('pw-overlay').classList.add('open');
  document.getElementById('pw-input').value = '';
  setTimeout(() => document.getElementById('pw-input').focus(), 80);
}
function closePwModal() { document.getElementById('pw-overlay').classList.remove('open'); }
function confirmClear() {
  if (document.getElementById('pw-input').value !== CLEAR_PASSWORD) {
    showToast('Wrong password');
    document.getElementById('pw-input').value = '';
    document.getElementById('pw-input').focus();
    return;
  }
  words = []; wordStatus = {}; wordSeen = {}; quizCooldown = {}; wordScrolled = {};
  save(); closePwModal(); renderWordList(); updateBadge();
  showToast('All words cleared');
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */
function updateBadge() {
  const n = words.length;
  document.getElementById('word-count-badge').textContent = `${n} word${n!==1?'s':''}`;
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(str) { return escHtml(str); }

function bookIcon() {
  return `<svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
}
function quizIcon() {
  return `<svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
}
function emptyStateHTML(iconHTML, title, text) {
  return `<div class="empty-state">${iconHTML}<h3>${title}</h3><p>${text}</p><button class="btn-open-mgr" onclick="openManager()">Open Word Manager</button></div>`;
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
updateBadge();
renderExploreFeed();
