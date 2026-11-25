'use strict';
const $ = s => document.querySelector(s);
const KEY = 'tema-dnya.v2';
const TIMER_MIN = 20, REC_SEC = 60;
const PALETTE = ['#7DA2FF','#4FD1FF','#B69CFF','#3EE0C5','#7BE37B','#FF7A8A','#FF8FD8','#FFA24C','#FFE14D','#C8F05A','#9CC2FF','#5CE1E6','#E6B26A','#FF9C73','#D7A6FF','#FF6FB0'];
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ================= данные =================
function parseTopics(txt){
  const tree = []; let area = null, sec = null;
  for (let line of txt.split('\n')){
    line = line.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, '');
    if (!line || line.startsWith('<<<') || line.startsWith('```')) continue;
    if (line.startsWith('## ')) { sec = {name: line.slice(3).trim(), children: []}; if (area) area.children.push(sec); }
    else if (line.startsWith('# ')) { const [n, c] = line.slice(2).split('|').map(s => s.trim()); area = {name: n, color: c || null, children: []}; tree.push(area); sec = null; }
    else if (sec) sec.children.push({name: line});
    else if (area) area.children.push({name: line});
  }
  return tree;
}
function hash(s){ let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function ensureIds(nodes, path = '', used = new Set()){
  nodes.forEach((n, i) => {
    if (!n.id || used.has(n.id)) { let id = 'n' + hash(path + '/' + n.name), k = 1; while (used.has(id)) id = 'n' + hash(path + '/' + n.name + '#' + k++); n.id = id; }
    used.add(n.id);
    if (path === '' && !n.color) n.color = PALETTE[i % PALETTE.length];
    if (n.children) ensureIds(n.children, path + '/' + n.name, used);
  });
}
function newToday(){ return {date: dayKey(), topicId: null, timerEnd: null, phase: 'idle'}; }
function loadState(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if (!s || !Array.isArray(s.tree)) s = {tree: parseTopics(DEFAULT_TOPICS), progress: {}};
  s.progress ??= {};
  s.settings = Object.assign({useShortcut: false, scName: 'Учёба 20'}, s.settings || {});
  if (!s.today || s.today.date !== dayKey()) s.today = newToday();
  ensureIds(s.tree);
  return s;
}
let S = loadState();
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){ toast('Не удалось сохранить'); } }

// индексы дерева
let byId = {}, parentOf = {}, leaves = [];
function reindex(){
  byId = {}; parentOf = {}; leaves = [];
  (function walk(nodes, parent){ for (const n of nodes){ byId[n.id] = n; parentOf[n.id] = parent; if (n.children) walk(n.children, n.id); else leaves.push(n); } })(S.tree, null);
}
reindex();
const isLeaf = n => !n.children;
function areaOf(id){ let a = id; while (parentOf[a]) a = parentOf[a]; return byId[a]; }
const colorOf = id => (areaOf(id) && areaOf(id).color) || '#FFE14D';
function pathOf(id){ const p = []; for (let a = id; a; a = parentOf[a]) p.unshift(a); return p; }
function doneCount(n){ return isLeaf(n) ? (S.progress[n.id] ? 1 : 0) : n.children.reduce((s, c) => s + doneCount(c), 0); }
function leafCount(n){ return isLeaf(n) ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0); }
function splitEmoji(name){ const m = name.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u); return m ? [m[1], m[2]] : ['', name]; }
function setTint(c){ document.documentElement.style.setProperty('--c', c || '#FFE14D'); }

// ================= медиа (IndexedDB) =================
const DB = (() => {
  let p;
  const open = () => p ??= new Promise((res, rej) => { const r = indexedDB.open('tema-media', 1); r.onupgradeneeded = () => r.result.createObjectStore('m'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction('m', mode), r = fn(t.objectStore('m')); t.oncomplete = () => res(r.result); t.onerror = () => rej(t.error); }));
  return {
    put: async (k, blob) => { const buf = await blob.arrayBuffer(); return run('readwrite', s => s.put({buf, type: blob.type}, k)); },
    get: async k => { const v = await run('readonly', s => s.get(k)); return v ? new Blob([v.buf], {type: v.type}) : null; },
    del: k => run('readwrite', s => s.delete(k)),
  };
})();
const mediaId = () => 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function dropMedia(p){ if (!p) return; for (const k of [p.video, ...(p.photos || [])]) if (k) try { await DB.del(k); } catch(e){} }

// ================= мелочи =================
let AC = null;
function audio(){ if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} if (AC && AC.state === 'suspended') AC.resume(); }
function tone(f, dur = .04, vol = .12, type = 'triangle'){
  if (!AC) return; const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f; g.gain.value = vol; g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + dur);
  o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
}
const chime = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, .35, .18), i * 130));
let toastT; function toast(msg){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }
const norm = s => splitEmoji(s)[1].toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// поиск похожих при добавлении: показывает совпадения, точный дубль блокирует OK
function searchSimilar(q){
  const box = $('#m-list'), ok = $('#m-ok'), nq = norm(q);
  ok.disabled = false;
  if (nq.length < 2) { box.innerHTML = ''; return; }
  const words = nq.split(' ').filter(w => w.length > 2);
  const hits = Object.values(byId).map(n => {
    const nn = norm(n.name);
    const score = nn === nq ? 100 : nn.includes(nq) || nq.includes(nn) ? 50 : words.filter(w => nn.includes(w.slice(0, Math.max(3, w.length - 2)))).length * 10;
    return {n, score};
  }).filter(h => h.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  const same = hits.some(h => h.score === 100);
  ok.disabled = same;
  box.innerHTML = (same ? '<div class="note">Такая уже есть</div>' : hits.length ? '<div class="note">Похожие:</div>' : '<div class="note">Похожих нет — можно добавлять</div>') +
    hits.map(h => `<div class="${h.score === 100 ? 'same' : ''}">${esc(h.n.name)}<small>${esc(pathOf(h.n.id).slice(0, -1).map(id => byId[id].name).join(' › ') || 'область')}</small></div>`).join('');
}
function ask(title, {value = '', input = true, ok = 'OK', search = false} = {}){
  return new Promise(res => {
    $('#m-title').textContent = title; $('#m-ok').textContent = ok; $('#m-ok').disabled = false;
    const inp = $('#m-input'); inp.hidden = !input; inp.value = value; $('#m-list').innerHTML = '';
    inp.oninput = search ? () => searchSimilar(inp.value) : null;
    inp.placeholder = search ? 'Начни вводить — поищу похожие' : '';
    $('#modal').hidden = false; if (input) setTimeout(() => inp.focus(), 50);
    const done = v => { $('#modal').hidden = true; $('#m-ok').onclick = $('#m-cancel').onclick = inp.oninput = null; $('#m-list').innerHTML = ''; res(v); };
    $('#m-ok').onclick = () => done(input ? inp.value.trim() || null : true);
    $('#m-cancel').onclick = () => done(null);
  });
}
async function shareFile(file){
  if (navigator.canShare && navigator.canShare({files: [file]})) { try { await navigator.share({files: [file]}); return; } catch(e){ if (e.name === 'AbortError') return; } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
}

// ================= навигация =================
let current = 'home';
function go(name){
  if (current === 'record' && name !== 'record') camOff();
  if (current === 'gallery' && name !== 'gallery') cancelAnimationFrame(G.raf);
  current = name;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-' + name));
  ({home: renderHome, spin: renderSpin, study: renderStudy, record: renderRecord, gallery: () => gBuild(), settings: renderSettings}[name] || (() => {}))();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

// ================= главная =================
function renderHome(){
  fillTicker();
  const d = new Date().toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'}); $('#h-date').textContent = d[0].toUpperCase() + d.slice(1);
  const T = S.today, topic = T.topicId && byId[T.topicId];
  let label = 'Крутить', sub = '';
  if (topic) {
    sub = topic.name;
    if (T.phase === 'chosen') label = 'Дальше';
    if (T.phase === 'study') label = leftMs() > 0 ? fmt(leftMs()) : 'Видео';
    if (T.phase === 'record') label = 'Видео';
    if (T.phase === 'done') label = '✓';
  }
  $('#start-label').textContent = label; $('#start-sub').textContent = sub;
}
$('#start').onclick = () => {
  audio();
  const T = S.today;
  if (T.phase === 'idle') { go('spin'); spin(); }
  else if (T.phase === 'chosen') go('spin');
  else if (T.phase === 'study') go('study');
  else if (T.phase === 'record') { recFor = T.topicId; go('record'); }
  else if (T.phase === 'done') openTopic(T.topicId);
};
setInterval(() => {
  if (S.today.date !== dayKey()) { S.today = newToday(); save(); if (current === 'home') renderHome(); }
  else if (current === 'home' && S.today.phase === 'study') renderHome();
}, 1000);

let tickerDone = false;
function fillTicker(){
  if (tickerDone) return; tickerDone = true;
  const pick = leaves.slice().sort(() => Math.random() - .5).slice(0, 24).map(n => `<span>${esc(n.name)}</span>`).join('');
  $('#ticker').innerHTML = pick + pick;   // дважды — для бесшовной прокрутки
}

// ================= барабан =================
const N_ITEMS = 24, STEP = 360 / N_ITEMS, ITEM_H = 84;
const RADIUS = Math.round(ITEM_H / 2 / Math.tan(Math.PI / N_ITEMS));
let spinning = false;
function pool(){ return leaves.filter(l => !S.progress[l.id]); }
function setDrum(items, angle){
  const d = $('#drum');
  d.innerHTML = items.map((n, i) => `<div class="drum-item" style="--ic:${colorOf(n.id)};transform:rotateX(${i * STEP}deg) translateZ(${RADIUS}px)"><span>${esc(n.name)}</span></div>`).join('');
  d.style.transform = `translateZ(${-RADIUS}px) rotateX(${-angle}deg)`;
}
function renderSpin(){
  const T = S.today;
  if (T.phase === 'chosen' && !spinning) {
    const n = byId[T.topicId]; setTint(colorOf(n.id));
    $('#s-spin').classList.add('done');
    $('#r-area').textContent = areaOf(n.id).name; $('#r-title').textContent = n.name;
  }
}
function spin(){
  const p = pool();
  if (!p.length) { toast('Все темы пройдены 🎉'); go('home'); return; }
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const items = Array.from({length: N_ITEMS}, (_, i) => p[i % p.length]);
  const win = Math.floor(Math.random() * N_ITEMS);
  $('#s-spin').classList.remove('done');
  setDrum(items, 0);
  const target = 360 * 5 + win * STEP, dur = 5600, t0 = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 4);
  let last = -1; spinning = true;
  (function frame(now){
    const t = Math.min(1, (now - t0) / dur), a = target * ease(t);
    $('#drum').style.transform = `translateZ(${-RADIUS}px) rotateX(${-a}deg)`;
    const idx = Math.floor((a + STEP / 2) / STEP);
    if (idx !== last) { tone(1100, .025, .07, 'square'); last = idx; setTint(colorOf(items[idx % N_ITEMS].id)); }
    if (t < 1) return requestAnimationFrame(frame);
    spinning = false;
    const n = items[win];
    Object.assign(S.today, {topicId: n.id, phase: 'chosen', timerEnd: null}); save();
    chime();
    setTimeout(() => { if (current === 'spin') renderSpin(); }, 500);
  })(t0);
}
$('#r-start').onclick = () => { audio(); startTimer(); go('study'); };

// ================= таймер =================
const totalMs = TIMER_MIN * 60000;
const leftMs = () => S.today.timerEnd == null ? totalMs : Math.max(0, S.today.timerEnd - Date.now());
const fmt = ms => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
let wake = null;
async function keepAwake(on){ try { if (on && !wake && 'wakeLock' in navigator) { wake = await navigator.wakeLock.request('screen'); wake.onrelease = () => wake = null; } if (!on && wake) { await wake.release(); wake = null; } } catch(e){} }
function startTimer(){
  S.today.timerEnd = Date.now() + totalMs; S.today.phase = 'study'; save(); rang = false;
  keepAwake(true);
  if (S.settings.useShortcut) location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent(S.settings.scName);
}
function renderStudy(){
  const n = byId[S.today.topicId]; if (!n) return go('home');
  setTint(colorOf(n.id));
  $('#st-area').textContent = areaOf(n.id).name; $('#st-title').textContent = n.name;
  tickStudy();
}
let rang = false;
function tickStudy(){
  const running = S.today.phase === 'study', ms = leftMs(), over = running && ms <= 0;
  $('#st-time').textContent = fmt(ms);
  $('#st-dial').style.setProperty('--deg', (360 * ms / totalMs).toFixed(2) + 'deg');
  $('#st-state').textContent = over ? 'время вышло!' : running ? 'изучаем — можно гуглить' : '20 минут на тему';
  $('#st-go').hidden = running;
  $('#st-record').hidden = !over;
  $('#st-early').hidden = !running || over;
  if (over && !rang) { rang = true; chime(); keepAwake(false); }
}
setInterval(() => { if (current === 'study') tickStudy(); }, 250);
$('#st-go').onclick = () => { audio(); startTimer(); tickStudy(); };
function toRecord(){ S.today.phase = 'record'; save(); keepAwake(false); recFor = S.today.topicId; go('record'); }
$('#st-record').onclick = toRecord;
$('#st-early').onclick = async () => { if (await ask('Закончить раньше и перейти к видео?', {input: false, ok: 'Да, к видео'})) toRecord(); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.today.phase === 'study' && leftMs() > 0) keepAwake(true); });

// ================= запись видео =================
let stream = null, recorder = null, chunks = [], videoBlob = null, recT = null, recFor = null;
// заметки: у пройденной темы — в её записи, у сегодняшней — черновик дня
const getNotes = id => S.progress[id] ? (S.progress[id].notes || '') : (S.today.notes || '');
function setNotes(id, v){ if (S.progress[id]) S.progress[id].notes = v; else S.today.notes = v; save(); }
function renderRecord(){
  const n = byId[recFor]; if (!n) return go('home');
  setTint(colorOf(n.id));
  $('#rc-area').textContent = areaOf(n.id).name; $('#rc-title').textContent = n.name;
  $('#rc-notes').value = getNotes(n.id);
  resetCam();
}
$('#rc-notes').oninput = e => setNotes(recFor, e.target.value);
function resetCam(){
  camOff(); videoBlob = null;
  const v = $('#rc-video'); v.removeAttribute('src'); v.srcObject = null; v.controls = false; v.classList.remove('play');
  $('#rc-idle').hidden = false; $('#rc-rec').hidden = true; $('#rc-count').hidden = true; $('#rc-after').hidden = true;
  $('#rc-rec').classList.remove('on');
}
async function camOn(){
  try {
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user', width: {ideal: 720}, height: {ideal: 1280}}, audio: true});
    const v = $('#rc-video'); v.srcObject = stream; v.muted = true; await v.play();
    $('#rc-idle').hidden = true; $('#rc-rec').hidden = false;
    $('#rc-count').textContent = fmt(REC_SEC * 1000); $('#rc-count').hidden = false;
  } catch(e){ toast('Нет доступа к камере'); }
}
function camOff(){ clearInterval(recT); if (recorder && recorder.state === 'recording') { recorder.onstop = null; recorder.stop(); } if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }
function recToggle(){
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  const mime = ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  chunks = [];
  recorder = new MediaRecorder(stream, Object.assign({videoBitsPerSecond: 2500000}, mime ? {mimeType: mime} : {}));
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  recorder.onstop = () => {
    clearInterval(recT);
    videoBlob = new Blob(chunks, {type: recorder.mimeType || 'video/mp4'});
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    const v = $('#rc-video'); v.srcObject = null; v.src = URL.createObjectURL(videoBlob); v.muted = false; v.controls = true; v.classList.add('play');
    $('#rc-rec').hidden = true; $('#rc-count').hidden = true; $('#rc-after').hidden = false;
  };
  recorder.start(1000);
  $('#rc-rec').classList.add('on');
  let left = REC_SEC; $('#rc-count').textContent = fmt(left * 1000);
  recT = setInterval(() => {
    left--; $('#rc-count').textContent = fmt(left * 1000);
    if (left <= 3 && left > 0) tone(700, .1, .1, 'sine');
    if (left <= 0) recorder.stop();
  }, 1000);
}
async function saveVideo(){
  if (!videoBlob) return;
  const id = recFor, key = mediaId();
  try { await DB.put(key, videoBlob); } catch(e){ toast('Не хватает места для видео'); return; }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch(e){}
  const old = S.progress[id];
  S.progress[id] = {date: old?.date || dayKey(), notes: old ? old.notes : (S.today.notes || ''), photos: old?.photos || [], video: key};
  if (old?.video) DB.del(old.video).catch(() => {});
  if (id === S.today.topicId) S.today.phase = 'done';
  save();
  chime(); toast('Сохранено в галерею');
  openTopic(id);
}
$('#rc-on').onclick = camOn;
$('#rc-rec').onclick = recToggle;
$('#rc-retake').onclick = () => { resetCam(); camOn(); };
$('#rc-save').onclick = saveVideo;
$('#rc-back').onclick = () => S.progress[recFor] ? openTopic(recFor) : go('home');

// ================= галерея-пузыри =================
const G = {stack: [], nodes: [], center: null, raf: 0, W: 0, H: 0, drag: null, busy: false};
function gLevelKids(){
  const pid = G.stack[G.stack.length - 1];
  return (pid ? byId[pid].children : S.tree).filter(n => doneCount(n) > 0);
}
function gBuild(spawn){
  const field = $('#g-field'); field.classList.remove('leaving');
  field.querySelectorAll('.bubble').forEach(b => b.remove());
  const rect = field.getBoundingClientRect(); G.W = rect.width; G.H = rect.height;
  const pid = G.stack[G.stack.length - 1], parent = pid && byId[pid];
  const tint = parent ? colorOf(pid) : '#FFE14D'; setTint(tint);
  // хлебные крошки
  $('#g-crumbs').innerHTML = ['Моё поле', ...G.stack.map(id => splitEmoji(byId[id].name)[1])].map(s => `<span>${esc(s)}</span>`).join('');
  requestAnimationFrame(() => { const c = $('#g-crumbs'); c.scrollLeft = c.scrollWidth; });
  const kids = gLevelKids(), m = Math.min(G.W, G.H);
  const total = parent ? doneCount(parent) : leaves.filter(l => S.progress[l.id]).length;
  $('#g-empty').hidden = total > 0;
  // центр
  const [ce, cn] = parent ? splitEmoji(parent.name) : ['', 'Моё поле'];
  G.center = mkBubble({id: pid || null, center: true, color: tint, r: m * .17, emoji: ce, name: cn, count: total, x: G.W / 2, y: G.H / 2});
  // дети: размер по числу пройденных, суммарная площадь ~ 35% поля
  const max = Math.max(1, ...kids.map(doneCount));
  const w = kids.map(k => isLeaf(k) ? 1 : .55 + .45 * Math.sqrt(doneCount(k) / max));
  const sum = w.reduce((s, x) => s + x * x, 0) || 1;
  const base = Math.min(m * .19, Math.max(28, Math.sqrt(G.W * G.H * .33 / (Math.PI * sum))));
  const sx = spawn ? spawn.x : G.W / 2, sy = spawn ? spawn.y : G.H / 2;
  G.nodes = kids.map((k, i) => {
    const [e, n] = splitEmoji(k.name), ang = i / kids.length * Math.PI * 2 + Math.random() * .3;
    return mkBubble({id: k.id, leaf: isLeaf(k), color: colorOf(k.id), r: base * w[i], emoji: isLeaf(k) ? '' : e, name: n,
      count: isLeaf(k) ? 0 : doneCount(k), x: sx + Math.cos(ang) * 20, y: sy + Math.sin(ang) * 20, delay: i * 40});
  });
  cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(gStep);
}
function mkBubble(o){
  const el = document.createElement('div');
  el.className = 'bubble pop' + (o.center ? ' center' : '');
  el.style.cssText = `--bc:${o.color};width:${2 * o.r}px;height:${2 * o.r}px;animation-delay:${o.delay || 0}ms`;
  const fs = o.leaf ? Math.max(10, Math.min(19, 1.45 * o.r / Math.sqrt(o.name.length))) : Math.max(11, Math.min(22, o.r * .24));
  el.innerHTML = `${o.emoji ? `<div class="e" style="font-size:${Math.min(44, o.r * .45)}px">${o.emoji}</div>` : ''}<div class="n" style="font-size:${fs}px">${esc(o.name)}</div>${o.count ? `<div class="k" style="font-size:${fs * .85}px">${o.count}</div>` : ''}`;
  $('#g-field').appendChild(el);
  const node = Object.assign(o, {el, vx: 0, vy: 0, ph: Math.random() * 6.28});
  el.addEventListener('pointerdown', e => gDown(e, node));
  return node;
}
function gStep(t){
  const C = G.center, all = [C, ...G.nodes], cx = G.W / 2, cy = G.H / 2;
  C.x = cx + Math.sin(t * .0006) * 4; C.y = cy + Math.cos(t * .0005) * 4;
  for (const a of G.nodes){
    if (a === G.drag?.node) continue;
    a.vx += (cx - a.x) * .0022 + Math.sin(t * .0007 + a.ph) * .035;
    a.vy += (cy - a.y) * .0022 + Math.cos(t * .0009 + a.ph) * .035;
    if (a.x < a.r) a.vx += (a.r - a.x) * .08; if (a.x > G.W - a.r) a.vx -= (a.x - G.W + a.r) * .08;
    if (a.y < a.r) a.vy += (a.r - a.y) * .08; if (a.y > G.H - a.r) a.vy -= (a.y - G.H + a.r) * .08;
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++){
    const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, ov = a.r + b.r + 10 - d;
    if (ov <= 0) continue;
    const ux = dx / d, uy = dy / d, f = ov * .12;
    if (a !== C && a !== G.drag?.node) { a.vx -= ux * f; a.vy -= uy * f; }
    if (b !== C && b !== G.drag?.node) { b.vx += ux * f; b.vy += uy * f; }
  }
  let lines = '';
  for (const a of all){
    if (a !== C && a !== G.drag?.node) { a.vx *= .86; a.vy *= .86; a.x += a.vx; a.y += a.vy; }
    a.el.style.transform = `translate(${a.x - a.r}px,${a.y - a.r}px)`;
    if (a !== C) lines += `<line x1="${C.x}" y1="${C.y}" x2="${a.x}" y2="${a.y}" stroke="${a.color}"/>`;
  }
  $('#g-lines').innerHTML = lines;
  G.raf = requestAnimationFrame(gStep);
}
function gDown(e, node){
  if (G.busy) return;
  e.preventDefault();
  const sx = e.clientX, sy = e.clientY, ox = node.x, oy = node.y;
  G.drag = {node, moved: false};
  const move = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (Math.hypot(dx, dy) > 8) G.drag.moved = true;
    if (!node.center && G.drag.moved) { node.x = ox + dx; node.y = oy + dy; node.vx = node.vy = 0; }
  };
  const up = () => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    const tap = !G.drag.moved; G.drag = null;
    if (tap) gTap(node);
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
}
function gTap(node){
  if (node.center) { if (G.stack.length) gUp(); return; }
  if (node.leaf) { openTopic(node.id); return; }
  // проваливаемся: пузырь летит в центр, остальное гаснет
  G.busy = true; cancelAnimationFrame(G.raf);
  const s = (G.center.r / node.r);
  node.el.classList.add('chosen'); $('#g-field').classList.add('leaving');
  node.el.style.transform = `translate(${G.W / 2 - node.r}px,${G.H / 2 - node.r}px) scale(${s})`;
  setTimeout(() => { G.busy = false; G.stack.push(node.id); gBuild(); }, 480);
}
function gUp(){ const from = G.stack.pop(); gBuild(); }
$('#g-back').onclick = () => G.stack.length ? gUp() : go('home');
addEventListener('resize', () => { if (current === 'gallery') gBuild(); });

// ================= страница темы =================
let topicId = null, urls = [];
function freeUrls(){ urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }
const blobUrl = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
async function openTopic(id){
  topicId = id; const n = byId[id], p = S.progress[id]; if (!n || !p) return;
  if (current === 'record') camOff();
  current = 'topic';
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === 's-topic'));
  setTint(colorOf(id)); freeUrls();
  $('#tp-area').textContent = areaOf(id).name; $('#tp-title').textContent = n.name;
  $('#tp-date').textContent = 'Изучено ' + new Date(p.date + 'T12:00').toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'});
  $('#tp-notes').value = p.notes || '';
  $('#tp-saved').classList.remove('on');
  const vbox = $('#tp-video'); vbox.innerHTML = '';
  const blob = p.video ? await DB.get(p.video).catch(() => null) : null;
  vbox.innerHTML = blob ? `<video src="${blobUrl(blob)}" controls playsinline preload="metadata"></video>` : '<div class="none">Видео нет</div>';
  $('#tp-share').hidden = !blob;
  $('#tp-rerec').textContent = blob ? 'Переснять' : 'Записать видео';
  if (blob) {
    $('#tp-share').onclick = () => shareFile(new File([blob], `${n.name}.${blob.type.includes('webm') ? 'webm' : 'mp4'}`.replace(/[\\/:*?"<>|]/g, ''), {type: blob.type}));
  }
  renderPhotos();
}
async function renderPhotos(){
  const p = S.progress[topicId], box = $('#tp-photos'); box.innerHTML = '';
  for (const k of p.photos || []){
    const b = await DB.get(k).catch(() => null); if (!b) continue;
    const d = document.createElement('div'); d.innerHTML = `<img src="${blobUrl(b)}" alt="">`;
    d.onclick = () => viewPhoto(k, d.firstChild.src); box.appendChild(d);
  }
  const add = document.createElement('button'); add.className = 'add'; add.textContent = '＋';
  add.onclick = () => $('#tp-photo-in').click(); box.appendChild(add);
}
function shrink(file, max = 1600){
  return new Promise(res => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob(b => res(b || file), 'image/jpeg', .85);
    };
    img.onerror = () => { URL.revokeObjectURL(u); res(file); };
    img.src = u;
  });
}
$('#tp-photo-in').onchange = async e => {
  const p = S.progress[topicId]; p.photos ??= [];
  for (const f of e.target.files){ const k = mediaId(); try { await DB.put(k, await shrink(f)); p.photos.push(k); } catch(err){ toast('Не хватает места'); } }
  e.target.value = ''; save(); renderPhotos();
};
function viewPhoto(k, src){
  $('#v-img').src = src; $('#viewer').hidden = false;
  $('#v-close').onclick = () => $('#viewer').hidden = true;
  $('#v-del').onclick = async () => {
    if (!await ask('Удалить фото?', {input: false, ok: 'Удалить'})) return;
    const p = S.progress[topicId]; p.photos = p.photos.filter(x => x !== k); save(); DB.del(k).catch(() => {});
    $('#viewer').hidden = true; renderPhotos();
  };
}
let savedT;
$('#tp-notes').oninput = e => {
  setNotes(topicId, e.target.value);
  const s = $('#tp-saved'); s.classList.add('on'); clearTimeout(savedT); savedT = setTimeout(() => s.classList.remove('on'), 1200);
};
$('#tp-rerec').onclick = () => { freeUrls(); recFor = topicId; go('record'); };
$('#tp-back').onclick = () => { freeUrls(); G.stack = pathOf(topicId).slice(0, -1); go('gallery'); };

// ================= настройки =================
let edStack = [];
function renderSettings(){
  setTint('#FFE14D');
  edStack = []; showSetMain(true);
  $('#set-topics-count').textContent = `${leaves.length}`;
  $('#set-sc').checked = S.settings.useShortcut;
}
function showSetMain(on){
  $('#set-main').hidden = !on; $('#set-editor').hidden = on;
  $('#set-crumbs').innerHTML = on ? '' : ['Темы', ...edStack.map(id => byId[id].name)].map((s, i, a) => i === a.length - 1 ? `<b>${esc(s)}</b>` : esc(s)).join(' › ');
}
$('#set-back').onclick = () => {
  if ($('#set-editor').hidden) return go('home');
  if (edStack.length) { edStack.pop(); renderEditor(); } else showSetMain(true);
};
$('#set-topics').onclick = () => { edStack = []; renderEditor(); };
$('#set-sc').onchange = e => { S.settings.useShortcut = e.target.checked; save(); };

function renderEditor(){
  showSetMain(false);
  const pid = edStack[edStack.length - 1], list = pid ? byId[pid].children : S.tree;
  setTint(pid ? colorOf(pid) : '#FFE14D');
  $('#ed-list').innerHTML = list.map(n => {
    const sub = isLeaf(n) ? (S.progress[n.id] ? 'пройдено ✓' : '') : `${leafCount(n)} тем · пройдено ${doneCount(n)}`;
    return `<div class="item" data-id="${n.id}"><span class="dot" style="background:${colorOf(n.id)}"></span>
      <div class="nm">${esc(n.name)}${sub ? `<small>${sub}</small>` : ''}</div>
      <button data-act="ren" aria-label="Переименовать">✎</button><button data-act="del" aria-label="Удалить">🗑</button>
      ${isLeaf(n) ? '' : '<button data-act="open" aria-label="Открыть">›</button>'}</div>`;
  }).join('') || '<p class="hint">Пусто</p>';
  $('#ed-add').textContent = ['＋ Область', '＋ Раздел', '＋ Тема'][Math.min(edStack.length, 2)];
}
$('#ed-list').onclick = async e => {
  const row = e.target.closest('.item'); if (!row) return;
  const n = byId[row.dataset.id], act = e.target.closest('button')?.dataset.act || (isLeaf(n) ? null : 'open');
  if (act === 'open') { edStack.push(n.id); renderEditor(); }
  if (act === 'ren') { const v = await ask('Название', {value: n.name}); if (v) { n.name = v; save(); renderEditor(); } }
  if (act === 'del') {
    const d = doneCount(n);
    if (!await ask(`Удалить «${n.name}»?` + (d ? ` Пройденных тем внутри: ${d}, их видео и фото тоже удалятся.` : ''), {input: false, ok: 'Удалить'})) return;
    (function drop(x){ if (isLeaf(x)) { dropMedia(S.progress[x.id]); delete S.progress[x.id]; if (S.today.topicId === x.id) S.today = newToday(); } else x.children.forEach(drop); })(n);
    const pid = parentOf[n.id], arr = pid ? byId[pid].children : S.tree;
    arr.splice(arr.indexOf(n), 1);
    save(); reindex(); renderEditor();
  }
};
$('#ed-add').onclick = async () => {
  const depth = edStack.length, v = await ask(['Новая область', 'Новый раздел', 'Новая тема'][Math.min(depth, 2)], {search: true, ok: 'Добавить'}); if (!v) return;
  const pid = edStack[depth - 1], arr = pid ? byId[pid].children : S.tree;
  const node = depth >= 2 ? {name: v} : {name: v, children: []};
  if (!depth) node.color = PALETTE[S.tree.length % PALETTE.length];
  arr.push(node); ensureIds(S.tree); save(); reindex(); renderEditor();
};

// экспорт/импорт: темы + пройденное + заметки (видео и фото остаются на телефоне)
$('#set-export').onclick = () => {
  const data = {app: 'tema-dnya', version: 2, exported: new Date().toISOString(), tree: S.tree, progress: S.progress};
  shareFile(new File([JSON.stringify(data, null, 1)], `tema-dnya-${dayKey()}.json`, {type: 'application/json'}));
};
$('#set-import').onclick = () => $('#set-import-in').click();
$('#set-import-in').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const text = await f.text();
  if (!text.trim().startsWith('{')) return mergeText(text);
  try {
    const d = JSON.parse(text);
    if (!Array.isArray(d.tree)) throw new Error('в файле нет списка тем');
    const cnt = (function c(ns){ return ns.reduce((s, n) => s + (n.children ? c(n.children) : 1), 0); })(d.tree);
    if (!await ask(`Заменить темы? В файле ${cnt} тем и ${Object.keys(d.progress || {}).length} пройденных.`, {input: false, ok: 'Заменить'})) return;
    // медиа сохраняем, если тема с таким id осталась
    const old = S.progress;
    S.tree = d.tree; ensureIds(S.tree); reindex();
    S.progress = {};
    for (const [id, p] of Object.entries(d.progress || {})) if (byId[id]) S.progress[id] = Object.assign({}, p, {video: old[id]?.video || p.video || null, photos: old[id]?.photos || p.photos || []});
    if (S.today.topicId && !byId[S.today.topicId]) S.today = newToday();
    save(); renderSettings(); toast('Импортировано');
  } catch(err){ toast('Ошибка: ' + err.message); }
};

// импорт текста "# Область / ## Раздел / тема": добавляет к текущим, дубли пропускает
async function mergeText(text){
  const add = parseTopics(text);
  const seen = new Set(leaves.map(l => norm(l.name)));
  const tree = JSON.parse(JSON.stringify(S.tree));
  let added = 0, dup = 0;
  const merge = (src, dst, depth) => {
    for (const n of src){
      if (!n.children) { const k = norm(n.name); if (seen.has(k)) dup++; else { seen.add(k); dst.push({name: n.name}); added++; } continue; }
      let t = dst.find(x => x.children && norm(x.name) === norm(n.name));
      if (!t) { t = {name: n.name, children: [], _new: true}; if (!depth) t.color = n.color || PALETTE[tree.length % PALETTE.length]; dst.push(t); }
      merge(n.children, t.children, depth + 1);
    }
  };
  merge(add, tree, 0);
  if (!added) { toast(dup ? `Новых тем нет, дублей: ${dup}` : 'В файле не найдено тем'); return; }
  if (!await ask(`Добавить ${added} новых тем? Дублей пропущено: ${dup}.`, {input: false, ok: 'Добавить'})) return;
  // новые разделы, где всё оказалось дублями, не оставляем
  const prune = ns => ns.filter(n => { if (!n.children) return true; n.children = prune(n.children); const keep = !n._new || n.children.length; delete n._new; return keep; });
  S.tree = prune(tree);
  ensureIds(S.tree); reindex(); save(); renderSettings(); toast(`Добавлено ${added} тем`);
}

// ================= старт =================
go('home');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
