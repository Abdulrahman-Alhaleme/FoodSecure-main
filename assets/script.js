(function themeInit(){
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  if(saved) root.setAttribute('data-theme', saved);
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.matches('[data-theme-toggle]')){
      const cur = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      root.setAttribute('data-theme', cur);
      localStorage.setItem('theme', cur);
    }
  });
})();

(function menuInit(){
  const btn = document.querySelector('[data-menu-toggle]');
  const links = document.querySelector('header .links');
  if(!btn || !links) return;
  btn.addEventListener('click', ()=> links.classList.toggle('open'));
  links.addEventListener('click', (e)=>{
    if(e.target.tagName === 'A') links.classList.remove('open');
  });
  window.addEventListener('resize', ()=>{ 
    if(window.innerWidth > 900) links.classList.remove('open'); 
  });
})();

(function progressInit(){
  const bar = document.getElementById('progressBar');
  if(!bar) return;
  const update = ()=>{
    const scrolled = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    bar.style.width = pct.toFixed(2) + '%';
  };
  window.addEventListener('scroll', update, {passive:true});
  window.addEventListener('resize', update);
  update();
})();

(function appearInit(){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      const kids = el.querySelectorAll(':scope > *[data-animate], :scope .card, :scope .crop-card');
      kids.forEach((k, i)=>{
        k.style.animationDelay = `${Math.min(i * 80, 600)}ms`;
        k.classList.add('in');
      });
      io.unobserve(el);
    });
  }, {root:null, threshold:0.18});
  document.querySelectorAll('[data-animate]').forEach(el=> io.observe(el));
})();

async function loadData(){
  const res = await fetch('assets/data.json');
  if(!res.ok) throw new Error('Failed to load assets/data.json');
  return await res.json();
}

function makeChart(ctx, config){
  return new Chart(ctx, {
    ...config,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900, easing: 'easeOutQuart' },
      ...(config.options || {})
    }
  });
}

function buildFilterUI(opts){
  const {containerId, dataPromise, typeKey='type', rarityKey='rarity'} = opts;
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = `
    <div class="grid-3" style="margin-bottom:1rem">
      <input id="${containerId}-q" class="input" placeholder="Search by name…" />
      <select id="${containerId}-type" class="input">
        <option value="">All types</option>
        <option value="vegetable">Vegetable</option>
        <option value="fruit">Fruit</option>
        <option value="legume">Legume</option>
        <option value="grain">Grain</option>
        <option value="herb">Herb</option>
        <option value="oilseed">Oilseed</option>
        <option value="spice">Spice</option>
        <option value="forage">Forage</option>
        <option value="tuber">Tuber</option>
        <option value="fungi">Fungi</option>
        <option value="native">Native</option>
        <option value="ornamental">Ornamental</option>
        <option value="riparian">Riparian</option>
        <option value="halophyte">Halophyte</option>
      </select>
      <select id="${containerId}-rarity" class="input">
        <option value="">All rarity</option>
        <option value="common">Common</option>
        <option value="niche">Niche</option>
        <option value="rare">Rare</option>
      </select>
    </div>
    <div class="table-wrap">
      <table class="table" id="${containerId}-table">
        <thead><tr><th>Name</th><th>Type</th><th>Rarity</th><th>Notes</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="pager">
      <div class="pager-left">
        <button class="btn-nav" id="${containerId}-prev">Prev</button>
        <div id="${containerId}-pages"></div>
        <button class="btn-nav" id="${containerId}-next">Next</button>
      </div>
      <div class="pager-right">
        <span class="count" id="${containerId}-count">0 results</span>
        <select class="page-size" id="${containerId}-size" title="Rows per page">
          <option value="5">5 / page</option>
          <option value="10" selected>10 / page</option>
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
        </select>
      </div>
    </div>
  `;
  const q = document.getElementById(`${containerId}-q`);
  const t = document.getElementById(`${containerId}-type`);
  const r = document.getElementById(`${containerId}-rarity`);
  const tbody = container.querySelector('tbody');
  const prevBtn = document.getElementById(`${containerId}-prev`);
  const nextBtn = document.getElementById(`${containerId}-next`);
  const pagesWrap = document.getElementById(`${containerId}-pages`);
  const sizeSel = document.getElementById(`${containerId}-size`);
  const countEl = document.getElementById(`${containerId}-count`);
  let dataset = [];
  let filtered = [];
  let page = 1;
  let pageSize = parseInt(sizeSel.value, 10);
  const paginate = (arr, page, size) => arr.slice((page-1)*size, (page-1)*size + size);
  const renderTable = () => {
    const rows = paginate(filtered, page, pageSize).map(it => `
      <tr>
        <td>${it.name}</td>
        <td><span class="badge">${it[typeKey]}</span></td>
        <td><span class="badge">${it[rarityKey]}</span></td>
        <td>${it.notes || ''}</td>
      </tr>
    `).join('');
    tbody.innerHTML = rows || `<tr><td colspan="4">No matches.</td></tr>`;
  };
  const renderPager = () => {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page > totalPages) page = totalPages;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
    const btn = (n, active=false) => `<button class="btn-page${active ? ' active' : ''}" data-page="${n}">${n}</button>`;
    const dots = `<span class="count">…</span>`;
    let html = '';
    const windowPages = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) windowPages.push(i);
    const layout = [...new Set([1, ...windowPages, totalPages])];
    html += btn(layout[0], layout[0] === page);
    for (let i = 1; i < layout.length; i++) {
      if (layout[i] - layout[i-1] > 1) html += dots;
      html += btn(layout[i], layout[i] === page);
    }
    pagesWrap.innerHTML = html;
    const start = total ? (page - 1) * pageSize + 1 : 0;
    const end = Math.min(page * pageSize, total);
    countEl.textContent = total ? `Showing ${start}–${end} of ${total} results` : `0 results`;
    pagesWrap.querySelectorAll('.btn-page').forEach(b => {
      b.addEventListener('click', () => {
        page = parseInt(b.getAttribute('data-page'), 10);
        renderTable();
        renderPager();
      });
    });
  };
  const applyFilters = () => {
    const qq = (q.value || '').toLowerCase().trim();
    const tt = t.value;
    const rr = r.value;
    filtered = dataset.filter(it => {
      const okQ = !qq || it.name.toLowerCase().includes(qq);
      const okT = !tt || (it[typeKey] === tt);
      const okR = !rr || (it[rarityKey] === rr);
      return okQ && okT && okR;
    });
    page = 1;
    renderTable();
    renderPager();
  };
  q.addEventListener('input', applyFilters);
  t.addEventListener('change', applyFilters);
  r.addEventListener('change', applyFilters);
  sizeSel.addEventListener('change', () => {
    pageSize = parseInt(sizeSel.value, 10);
    page = 1;
    renderTable();
    renderPager();
  });
  prevBtn.addEventListener('click', () => { if(page > 1){ page--; renderTable(); renderPager(); } });
  nextBtn.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if(page < totalPages){ page++; renderTable(); renderPager(); }
  });
  dataPromise.then(({crops, plants}) => {
    dataset = crops || plants || [];
    applyFilters();
  });
}

function buildCardUI({containerId, dataPromise, datasetKey}){
  const container = document.getElementById(containerId);
  if(!container) return;
  container.innerHTML = `
    <div class="grid-3" style="margin-bottom:1rem">
      <input id="${containerId}-q" class="input" placeholder="Search by name…" />
      <select id="${containerId}-type" class="input">
        <option value="">All types</option>
        <option value="vegetable">Vegetable</option>
        <option value="fruit">Fruit</option>
        <option value="legume">Legume</option>
        <option value="grain">Grain</option>
        <option value="herb">Herb</option>
        <option value="oilseed">Oilseed</option>
        <option value="spice">Spice</option>
        <option value="forage">Forage</option>
        <option value="tuber">Tuber</option>
        <option value="fungi">Fungi</option>
        <option value="native">Native</option>
        <option value="ornamental">Ornamental</option>
        <option value="riparian">Riparian</option>
        <option value="halophyte">Halophyte</option>
      </select>
      <select id="${containerId}-rarity" class="input">
        <option value="">All rarity</option>
        <option value="common">Common</option>
        <option value="niche">Niche</option>
        <option value="rare">Rare</option>
      </select>
    </div>
    <div id="${containerId}-cards" class="card-grid"></div>
    <div class="pager">
      <div class="pager-left">
        <button class="btn-nav" id="${containerId}-prev">Prev</button>
        <div id="${containerId}-pages"></div>
        <button class="btn-nav" id="${containerId}-next">Next</button>
      </div>
      <div class="pager-right">
        <span class="count" id="${containerId}-count">0 results</span>
        <select class="page-size" id="${containerId}-size" title="Cards per page">
          <option value="6">6 / page</option>
          <option value="12" selected>12 / page</option>
          <option value="24">24 / page</option>
        </select>
      </div>
    </div>
  `;
  const q = document.getElementById(`${containerId}-q`);
  const t = document.getElementById(`${containerId}-type`);
  const r = document.getElementById(`${containerId}-rarity`);
  const cardsWrap = document.getElementById(`${containerId}-cards`);
  const prevBtn = document.getElementById(`${containerId}-prev`);
  const nextBtn = document.getElementById(`${containerId}-next`);
  const pagesWrap = document.getElementById(`${containerId}-pages`);
  const sizeSel = document.getElementById(`${containerId}-size`);
  const countEl = document.getElementById(`${containerId}-count`);
  let dataset = [];
  let filtered = [];
  let page = 1;
  let pageSize = parseInt(sizeSel.value, 10);
  const paginate = (arr, page, size) => arr.slice((page-1)*size, (page-1)*size + size);
  const renderCards = () => {
    const startIndex = (page - 1) * pageSize;
    const pageItems = paginate(filtered, page, pageSize);
    const cards = pageItems.map((it, i) => `
      <div class="crop-card" data-idx="${startIndex + i}" role="button" tabindex="0" aria-label="Open details">
        <div>
          <h3>${it.name}</h3>
          <div class="tags">
            <span class="badge">${it.type}</span>
            <span class="badge">${it.rarity}</span>
          </div>
          <p>${it.notes || ''}</p>
        </div>
      </div>
    `).join('');
    cardsWrap.innerHTML = cards || `<p>No matches found.</p>`;
  };
  const renderPager = () => {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if(page > totalPages) page = totalPages;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
    const btn = (n, active=false)=> `<button class="btn-page${active?' active':''}" data-page="${n}">${n}</button>`;
    const dots = `<span class="count">…</span>`;
    let html = '';
    const windowPages = [];
    for(let i=Math.max(1,page-2); i<=Math.min(totalPages,page+2); i++){ windowPages.push(i); }
    const layout = [...new Set([1, ...windowPages, totalPages])];
    html += btn(layout[0], layout[0]===page);
    for(let i=1;i<layout.length;i++){
      if(layout[i]-layout[i-1] > 1) html += dots;
      html += btn(layout[i], layout[i]===page);
    }
    pagesWrap.innerHTML = html;
    const start = total ? (page-1)*pageSize+1 : 0;
    const end = Math.min(page*pageSize, total);
    countEl.textContent = total ? `Showing ${start}–${end} of ${total} results` : `0 results`;
    pagesWrap.querySelectorAll('.btn-page').forEach(b=>{
      b.addEventListener('click', ()=>{
        page = parseInt(b.getAttribute('data-page'), 10);
        renderCards(); renderPager();
      });
    });
  };
  const applyFilters = () => {
    const qq = (q.value||'').toLowerCase().trim();
    const tt = t.value, rr = r.value;
    filtered = dataset.filter(it=>{
      const okQ = !qq || it.name.toLowerCase().includes(qq);
      const okT = !tt || it.type === tt;
      const okR = !rr || it.rarity === rr;
      return okQ && okT && okR;
    });
    page = 1;
    renderCards(); renderPager();
  };
  sizeSel.addEventListener('change', ()=>{ pageSize=parseInt(sizeSel.value,10); page=1; renderCards(); renderPager(); });
  prevBtn.addEventListener('click', ()=>{ if(page>1){ page--; renderCards(); renderPager(); }});
  nextBtn.addEventListener('click', ()=>{
    const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize));
    if(page<totalPages){ page++; renderCards(); renderPager(); }
  });
  q.addEventListener('input', applyFilters);
  t.addEventListener('change', applyFilters);
  r.addEventListener('change', applyFilters);
  cardsWrap.addEventListener('click', (e)=>{
    const card = e.target.closest('.crop-card');
    if(!card) return;
    const idx = parseInt(card.dataset.idx, 10);
    const item = filtered[idx];
    openItemModal(item);
  });
  cardsWrap.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.crop-card');
    if(!card) return;
    e.preventDefault();
    const idx = parseInt(card.dataset.idx, 10);
    const item = filtered[idx];
    openItemModal(item);
  });
  dataPromise.then(data=>{
    dataset = data[datasetKey] || [];
    applyFilters();
  });
}

(function heroParallax(){
  const img = document.querySelector('.hero-img');
  if(!img) return;
  const maxShift = 30;
  const maxScale = 1.04;
  const onScroll = ()=>{
    const y = window.scrollY || 0;
    const shift = Math.min(maxShift, y * 0.06);
    const scale = 1 + Math.min(maxScale - 1, y / 6000);
    img.style.transform = `translateY(${shift}px) scale(${scale})`;
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();
})();

(function cardTilt(){
  const wrap = document.body;
  if(!wrap) return;
  let raf = null;
  function handleMove(e){
    const card = e.target.closest('.crop-card');
    if(!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotX = (0.5 - y) * 10;
    const rotY = (x - 0.5) * 12;
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(()=>{
      card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-6px)`;
    });
  }
  function reset(e){
    const card = e.target.closest('.crop-card');
    if(!card) return;
    card.style.transform = '';
  }
  wrap.addEventListener('pointermove', handleMove);
  wrap.addEventListener('pointerleave', reset);
})();

(function modalInit(){
  if (document.getElementById('modal-root')) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-root';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header>
        <h3 id="modal-title"></h3>
        <button class="close" aria-label="Close">✕</button>
      </header>
      <div class="meta"></div>
      <div class="body"></div>
    </div>
  `;
  document.body.appendChild(backdrop);
  let lastFocus = null;
  function closeModal(){
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    document.removeEventListener('keydown', onKey);
    backdrop.removeEventListener('click', onBackdrop);
  }
  function onKey(e){
    if (e.key === 'Escape') closeModal();
  }
  function onBackdrop(e){
    if (!e.target.closest('.modal')) closeModal();
  }
  window.openModal = function({ title, badges = [], bodyHTML = '' }){
    lastFocus = document.activeElement;
    document.getElementById('modal-title').textContent = title || '';
    const meta = backdrop.querySelector('.meta');
    meta.innerHTML = badges.map(b=>`<span class="badge">${b}</span>`).join('');
    backdrop.querySelector('.body').innerHTML = bodyHTML;
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
    backdrop.querySelector('.close').focus();
    document.addEventListener('keydown', onKey);
    backdrop.addEventListener('click', onBackdrop);
  };
  backdrop.querySelector('.close').addEventListener('click', closeModal);
})();

function openItemModal(it){
  const body = `
    <p>${it.notes || ''}</p>
  `;
  openModal({
    title: it.name,
    badges: [it.type, it.rarity].filter(Boolean),
    bodyHTML: body
  });
}

(function splashInit(){
  const splash = document.getElementById('splash');
  if(!splash) return;
  const showOncePerSession = false;
  const sessionKey = 'fsj-splash-shown';
  if (showOncePerSession && sessionStorage.getItem(sessionKey) === '1') {
    document.documentElement.classList.remove('splashing');
    splash.classList.add('hide');
    return;
  }
  const MIN_TIME = 1400;
  const MAX_TIME = 4000;
  const START_DELAY = 120;
  const start = Date.now();
  function hideSplash(){
    splash.classList.add('hide');
    document.documentElement.classList.remove('splashing');
    if (showOncePerSession) sessionStorage.setItem(sessionKey, '1');
  }
  function maybeHide(){
    const elapsed = Date.now() - start;
    const wait = Math.max(START_DELAY, MIN_TIME - elapsed);
    setTimeout(hideSplash, wait);
  }
  if (document.readyState === 'complete') {
    maybeHide();
  } else {
    window.addEventListener('load', maybeHide, { once: true });
    setTimeout(hideSplash, MAX_TIME);
  }
  splash.addEventListener('click', () => hideSplash());
})();
function initSuggestions(){
  const form = document.getElementById('suggestForm');
  const listWrap = document.querySelector('#suggestList tbody');
  if(!form || !listWrap) return;

  const KEY = 'fsj_suggestions';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const write = (arr) => localStorage.setItem(KEY, JSON.stringify(arr));

  function render(){
    const arr = read().sort((a,b)=> b.time - a.time);
    listWrap.innerHTML = arr.map(s => `
      <tr>
        <td>${new Date(s.time).toLocaleString()}</td>
        <td><span class="badge">${s.topic}</span></td>
        <td>${s.message.replace(/</g,'&lt;')}</td>
        <td>${s.name ? s.name.replace(/</g,'&lt;') : ''}</td>
      </tr>
    `).join('') || `<tr><td colspan="4">No suggestions yet.</td></tr>`;
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const entry = {
      time: Date.now(),
      name: (fd.get('name')||'').trim(),
      email: (fd.get('email')||'').trim(),
      topic: fd.get('topic'),
      message: (fd.get('message')||'').trim()
    };
    if(!entry.topic || !entry.message){ return; }
    const arr = read();
    arr.push(entry);
    write(arr);
    form.reset();
    render();
    openModal({ title: 'Thank you!', badges: [entry.topic], bodyHTML: '<p>Your suggestion was saved locally.</p>' });
  });

  document.getElementById('exportSuggestions')?.addEventListener('click', ()=>{
    const data = read();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'suggestions.json'; a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('clearSuggestions')?.addEventListener('click', ()=>{
    write([]); render();
  });

  render();
}
