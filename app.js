'use strict';
const $ = s => document.querySelector(s);
const KEY = 'tema-dnya.v2';
const TIMER_MIN = 20, REC_SEC = 60;
const PALETTE = ['#8FB3C9','#7FB7B0','#A99AC4','#9CC5A1','#B5C46B','#E8907F','#E7A6B8','#EBA061','#EEC55A','#C9C77A','#A9C0D4','#86C3C7','#D2AE7E','#E59A79','#C3A5C6','#E88FA0'];
// старые яркие цвета областей -> ретро
const RETRO = {'#7DA2FF':'#8FB3C9','#4FD1FF':'#7FB7B0','#B69CFF':'#A99AC4','#3EE0C5':'#9CC5A1','#7BE37B':'#B5C46B','#FF7A8A':'#E8907F','#FF8FD8':'#E7A6B8','#FFA24C':'#EBA061','#EEC55A':'#EEC55A','#C8F05A':'#C9C77A','#9CC2FF':'#A9C0D4','#5CE1E6':'#86C3C7','#E6B26A':'#D2AE7E','#FF9C73':'#E59A79','#D7A6FF':'#C3A5C6','#F2C879':'#E3C48E','#FF6FB0':'#E88FA0'};
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
    if (path === '') n.color = RETRO[(n.color || '').toUpperCase()] || n.color || PALETTE[i % PALETTE.length];
    if (n.children) ensureIds(n.children, path + '/' + n.name, used);
  });
}
function newToday(){ return {date: dayKey(), topicId: null, timerEnd: null, phase: 'idle'}; }
function loadState(){
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
  if (!s || !Array.isArray(s.tree)) s = {tree: parseTopics(DEFAULT_TOPICS), progress: {}, topicsVer: TOPICS_VER};
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
const colorOf = id => (areaOf(id) && areaOf(id).color) || '#EEC55A';
function pathOf(id){ const p = []; for (let a = id; a; a = parentOf[a]) p.unshift(a); return p; }
function doneCount(n){ return isLeaf(n) ? (S.progress[n.id] ? 1 : 0) : n.children.reduce((s, c) => s + doneCount(c), 0); }
function leafCount(n){ return isLeaf(n) ? 1 : n.children.reduce((s, c) => s + leafCount(c), 0); }
function splitEmoji(name){ const m = name.match(/^(\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*)\s*(.*)$/u); return m ? [m[1], m[2]] : ['', name]; }
const areaName = id => splitEmoji(areaOf(id).name)[1];

// анимированные иконки областей (ключ — название без эмодзи)
const INF = 'M32 32c-6-8-10-12-16-12a12 12 0 0 0 0 24c6 0 10-4 16-12s10-12 16-12a12 12 0 0 1 0 24c-6 0-10-4-16-12z';
const EYE = 'M4 32s11-17 28-17 28 17 28 17-11 17-28 17S4 32 4 32z';
const FLASK = 'M26 6h12M28 6v18L13 51a5 5 0 0 0 4.5 7h29a5 5 0 0 0 4.5-7L36 24V6';
const ICONS = {
  'математика': `<circle class="f" cx="32" cy="32" r="22"/><path class="thin" d="M4 32h56M32 4v56"/><g class="vc a-rot"><path d="M32 32h22"/><circle class="r" cx="54" cy="32" r="4.5"/></g><circle class="d" cx="32" cy="32" r="2.5"/>`,
  'физика': `<g class="vc a-rot"><ellipse cx="32" cy="32" rx="27" ry="10"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="27" ry="10" transform="rotate(120 32 32)"/><circle class="r" cx="59" cy="32" r="3.5"/><circle class="r" cx="45.5" cy="55.4" r="3.5"/><circle class="r" cx="18.5" cy="8.6" r="3.5"/></g><circle class="y o a-beat" cx="32" cy="32" r="6"/>`,
  'космос': `<ellipse cx="32" cy="34" rx="27" ry="8" transform="rotate(-18 32 34)"/><circle class="f" cx="32" cy="34" r="14"/><path class="thin" d="M20 29c6 3 18 3 24 0M19 38c6 3 20 3 26 0"/><path d="M5 34a27 8 0 0 0 54 0" transform="rotate(-18 32 34)"/><g class="vc a-rot" style="transform-origin:32px 34px"><circle class="y" cx="32" cy="4" r="3.5"/></g><path class="o a-blink" d="M8 6v6M5 9h6"/><path class="o a-blink d2" d="M55 52v6M52 55h6"/><path class="o a-blink d3" d="M56 6v4M54 8h4"/>`,
  'химия': `<path class="f" stroke="none" d="${FLASK}"/><path class="r" stroke="none" d="M18.5 42h27l5.5 9.5a5 5 0 0 1-4.5 6.5h-29a5 5 0 0 1-4.5-6.5z"/><path d="${FLASK}"/><circle class="d a-rise" cx="28" cy="52" r="2"/><circle class="d a-rise d2" cx="35" cy="48" r="1.6"/><circle class="d a-rise d4" cx="31" cy="54" r="1.3"/>`,
  'биология': `<g class="vc a-twist"><path class="thin" d="M25 12h14M30 20h4M24 26h16M24 38h16M30 44h4M25 52h14"/><path d="M20 4c0 14 24 14 24 28s-24 14-24 28"/><path style="stroke:var(--red)" d="M44 4c0 14-24 14-24 28s24 14 24 28"/></g>`,
  'тело и здоровье': `<g class="o a-beat"><path class="r" d="M32 55S7 40 7 23a12.5 12.5 0 0 1 25-4 12.5 12.5 0 0 1 25 4c0 17-25 32-25 32z"/><path style="stroke:var(--card)" d="M15 23a8 8 0 0 1 7-7"/></g>`,
  'мозг': `<path class="f" d="M32 12c-4-6-15-5-16 3-8 1-11 10-6 15-4 6 0 14 7 14 1 8 11 10 15 3 4 7 14 5 15-3 7 0 11-8 7-14 5-5 2-14-6-15-1-8-12-9-16-3z"/><path d="M32 12v41"/><path class="thin" d="M20 24c4 0 6 3 6 6M44 24c-4 0-6 3-6 6M18 38c4-1 7 1 8 4M46 38c-4-1-7 1-8 4"/><circle class="r a-blink" cx="22" cy="21" r="3"/><circle class="r a-blink d2" cx="43" cy="31" r="3"/><circle class="r a-blink d3" cx="24" cy="42" r="3"/><circle class="r a-blink d4" cx="40" cy="47" r="2.5"/>`,
  'психология': `<path class="f" d="M40 58V47c8 0 12-5 12-11l5-6-5-3C52 14 43 6 31 6 18 6 9 15 9 28c0 8 4 14 9 17v13"/><path class="o a-rot" style="stroke:var(--red)" d="M31 27a2.5 2.5 0 1 1 2.5 2.5 5 5 0 1 1-5-5 7.5 7.5 0 1 1 7.5 7.5"/>`,
  'мышление': `<path class="y" d="M24 44c0-7-9-11-9-21a17 17 0 0 1 34 0c0 10-9 14-9 21z"/><path d="M25 50h14M27 56h10"/><path class="thin" d="M29 44V32l3 3 3-3v12"/><path class="a-blink" d="M32 -5v5M10 4l4 4M54 4l-4 4M2 22h5M62 22h-5"/>`,
  'экономика и решения': `<path d="M32 12v42M20 56h24"/><g class="vc a-rock" style="transform-origin:32px 12px"><path d="M8 12h48"/><path class="y" d="M8 12 2 28h12z"/><path class="y" d="M56 12l-6 16h12z"/></g><circle class="r" cx="32" cy="11" r="3.5"/>`,
  'философия': `<path d="${INF}" style="stroke-width:7;opacity:.15"/><path d="${INF}"/><path class="a-trace" pathLength="100" d="${INF}" style="stroke:var(--red);stroke-width:5"/>`,
  'технологии': `<g class="o a-rot"><circle cx="26" cy="27" r="17" style="stroke-width:7;stroke-dasharray:5.3 3.6"/><circle class="f" cx="26" cy="27" r="13"/><circle cx="26" cy="27" r="4"/></g><g class="o" style="animation:a-rot 4.67s linear infinite reverse"><circle cx="48" cy="49" r="10" style="stroke-width:6;stroke-dasharray:4.5 3.35"/><circle class="y" cx="48" cy="49" r="7"/><circle cx="48" cy="49" r="2.5"/></g>`,
  'земля': `<defs><clipPath id="clip-globe"><circle cx="32" cy="32" r="24"/></clipPath></defs><circle class="f" cx="32" cy="32" r="24"/><g clip-path="url(#clip-globe)"><path class="thin" d="M8 32h48M11 20h42M11 44h42"/><ellipse class="vc a-meridian" cx="32" cy="32" rx="22" ry="24"/><ellipse class="vc a-meridian" style="animation-delay:-2s;stroke:var(--red)" cx="32" cy="32" rx="22" ry="24"/></g><circle cx="32" cy="32" r="24"/><path class="thin" d="M32 8v48"/>`,
  'язык': `<path class="f" d="M12 12h40a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H30L18 54V44h-6a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6z"/><circle class="d a-hop d2" cx="21" cy="28" r="3.2"/><circle class="d a-hop d1" cx="32" cy="28" r="3.2"/><circle class="r a-hop" cx="43" cy="28" r="3.2"/>`,
  'общество': `<g class="a-hop d2"><circle class="f" cx="14" cy="27" r="6"/><path class="f" d="M4 52a10 10 0 0 1 20 0z"/></g><g class="a-hop d1"><circle class="y" cx="32" cy="20" r="7"/><path class="y" d="M20 52a12 12 0 0 1 24 0z"/></g><g class="a-hop"><circle class="f" cx="50" cy="27" r="6"/><path class="f" d="M40 52a10 10 0 0 1 20 0z"/></g><path d="M2 56h60"/>`,
  'история идей': `<path class="f" d="M21 6c0 14 10 20 10 26S21 44 21 58h22c0-14-10-20-10-26s10-12 10-26z"/><path class="r o a-sand-top" stroke="none" d="M24 13h16c-1.5 6-5 9-8 12-3-3-6.5-6-8-12z"/><path class="a-fall" style="stroke:var(--red);stroke-width:2" d="M32 30v24"/><path class="r o a-sand-bot" stroke="none" d="M22 57c2-6 5-9 10-10 5 1 8 4 10 10z"/><path d="M16 6h32M16 58h32"/>`,
  'искусство и восприятие': `<defs><clipPath id="clip-eye"><path d="${EYE}"/></clipPath></defs><g class="vc a-lid"><path class="f" d="${EYE}"/><g clip-path="url(#clip-eye)"><g class="a-look"><circle class="r" cx="32" cy="32" r="10"/><circle class="d" cx="32" cy="32" r="4.5"/><circle cx="35" cy="29" r="1.5" style="fill:var(--card);stroke:none"/></g></g><path d="${EYE}"/></g>`,
  'история': `<path class="f" d="M32 16c-8-4-16-5-24-4v36c8-1 16 0 24 4z"/><path class="f" d="M32 16c8-4 16-5 24-4v36c-8-1-16 0-24 4z"/><path class="vc a-twist" style="fill:var(--mustard);transform-origin:32px 32px;animation-duration:4s" d="M32 16c8-4 16-5 24-4v36c-8-1-16 0-24 4z"/><path class="thin" d="M14 22c5-1 10 0 13 1M14 30c5-1 10 0 13 1M14 38c5-1 10 0 13 1"/><path d="M32 16v36"/>`,
  'война и стратегия': `<g class="vc a-rock" style="animation-duration:4s"><path d="M10 10l44 44M54 10 10 54"/><path d="M14 22l8-8M42 14l8 8"/></g><path class="r o a-beat" d="M32 14l14 5v10c0 10-6 16-14 20-8-4-14-10-14-20V19z"/><path style="stroke:var(--card)" d="M32 22v18M26 30h12"/>`,
  'религии и мифы': `<path class="a-blink" d="M32 -2v4M14 6l3 3M50 6l-3 3"/><path class="y o a-flicker" d="M32 8c6 7 8 11 8 15a8 8 0 0 1-16 0c0-4 2-8 8-15z"/><path d="M32 22v8"/><path class="f" d="M23 30h18v26H23z"/><path class="thin" d="M27 36v14"/><path d="M14 58h36"/>`,
  'животные': `<path class="y" d="M32 32c9 0 16 9 16 16 0 6-6 8-16 8s-16-2-16-8c0-7 7-16 16-16z"/><circle class="d a-hop" cx="13" cy="27" r="5"/><circle class="d a-hop d1" cx="24" cy="15" r="5.5"/><circle class="d a-hop d2" cx="40" cy="15" r="5.5"/><circle class="d a-hop d3" cx="51" cy="27" r="5"/>`,
  'растения и грибы': `<g class="vc a-rock" style="transform-origin:32px 48px;animation-duration:3.5s"><path d="M32 48V22"/><path class="f" d="M32 36c-4-10-14-13-21-10 2 9 11 14 21 10z"/><path class="f" d="M32 28c3-10 13-14 21-11-1 9-11 15-21 11z"/><circle class="r" cx="32" cy="18" r="4"/></g><path class="r" d="M20 46h24l-3 12H23z"/>`,
  'океан': `<defs><clipPath id="clip-sea"><circle cx="32" cy="32" r="24"/></clipPath></defs><circle class="f" cx="32" cy="32" r="24"/><g clip-path="url(#clip-sea)"><path class="y" stroke="none" d="M0 0h64v20H0z" style="opacity:.5"/><circle class="r" cx="44" cy="20" r="5" stroke="none"/><path class="a-wave" style="fill:var(--ink);opacity:.18" d="M-16 34q4-5 8 0t8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0V70H-16z"/><path class="a-wave" style="animation-duration:1.6s;animation-direction:reverse" d="M-16 42q4-5 8 0t8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0 8 0"/></g><circle cx="32" cy="32" r="24"/>`,
  'еда и кухня': `<path class="a-rise" d="M24 22c-3-4 3-6 0-10"/><path class="a-rise d2" d="M32 22c-3-4 3-6 0-10"/><path class="a-rise d4" d="M40 22c-3-4 3-6 0-10"/><path class="r" d="M12 30h40v14a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z"/><path d="M8 30h48M12 36H5M52 36h7"/>`,
  'выживание и безопасность': `<path class="r o a-flicker" d="M32 6c10 10 14 18 14 26a14 14 0 0 1-28 0c0-8 4-16 14-26z"/><path class="y o a-flicker d2" d="M32 22c5 5 7 9 7 13a7 7 0 0 1-14 0c0-4 2-8 7-13z"/><path style="stroke-width:5" d="M12 58l40-10M52 58 12 48"/>`,
  'повседневная наука': `<path class="thin" d="M8 52h48"/><circle class="d a-blink" cx="16" cy="44" r="2"/><circle class="d a-blink d2" cx="30" cy="40" r="2"/><circle class="d a-blink d3" cx="46" cy="44" r="2"/><g class="a-look" style="animation-duration:5s"><circle class="f" cx="30" cy="26" r="13" style="fill-opacity:.85"/><path style="stroke-width:5" d="M40 36l10 10"/><path style="stroke:var(--red)" d="M24 22a7 7 0 0 1 6-4"/></g>`,
  'бизнес и управление': `<path d="M8 56h48"/><path class="f o a-bar" d="M12 40h9v16h-9z"/><path class="y o a-bar d1" d="M26 30h9v26h-9z"/><path class="r o a-bar d2" d="M40 18h9v38h-9z"/><path class="a-blink" d="M10 30 24 18l8 6 18-16M44 8h6v6"/>`,
  'личные финансы': `<path class="f" d="M14 50h24v6H14zM16 44h24v6H16z"/><g class="vc a-twist" style="transform-origin:40px 24px;animation-duration:2.4s"><circle class="y" cx="40" cy="24" r="15"/><circle class="thin" cx="40" cy="24" r="11"/><path d="M37 17h5a4 4 0 0 1 0 8h-5zM37 17v15M34 29h8"/></g>`,
  'право и государство': `<path class="f" d="M28 50h28v6H28z"/><g class="vc a-hammer" style="transform-origin:12px 46px"><path d="M37 21 12 46"/><path class="r" d="M30 8l16 16-7 7-16-16z"/></g>`,
  'города и архитектура': `<path class="f" d="M6 58V30h14v28M20 58V12h16v46M36 58V24h12v34M48 58V38h10v20"/><path d="M2 58h60"/><g class="d"><rect class="a-blink" x="10" y="36" width="4" height="4"/><rect class="a-blink d2" x="24" y="18" width="4" height="4"/><rect class="a-blink d4" x="28" y="30" width="4" height="4"/><rect class="a-blink d1" x="24" y="42" width="4" height="4"/><rect class="a-blink d3" x="40" y="30" width="4" height="4"/><rect class="a-blink d2" x="51" y="44" width="4" height="4"/></g>`,
  'кино и литература': `<path d="M32 50h26"/><g class="o a-rot"><circle class="f" cx="28" cy="30" r="22"/><circle class="r" cx="28" cy="17" r="5"/><circle class="d" cx="40" cy="26" r="5"/><circle class="y" cx="36" cy="41" r="5"/><circle class="d" cx="20" cy="41" r="5"/><circle class="y" cx="16" cy="26" r="5"/><circle class="d" cx="28" cy="30" r="2.5"/></g>`,
  'игры и спорт': `<ellipse class="o a-shadow" cx="32" cy="58" rx="14" ry="3" style="fill:var(--ink);opacity:.25;stroke:none"/><g class="a-bounce"><circle class="r" cx="32" cy="22" r="16"/><path style="stroke:var(--card)" d="M16 22h32M32 6v32M21 10c5 8 5 16 0 24M43 10c-5 8-5 16 0 24"/></g>`,
  'страны и культуры': `<circle class="f" cx="32" cy="32" r="24"/><circle class="thin" cx="32" cy="32" r="19"/><path class="thin" d="M32 4v6M32 54v6M4 32h6M54 32h6"/><g class="vc a-rock" style="animation-duration:2.6s"><path class="r" d="M32 12l5 20h-10z"/><path class="f" d="M32 52l5-20h-10z"/></g><circle class="d" cx="32" cy="32" r="2.5"/>`,
  'интернет и медиа': `<circle class="r" cx="32" cy="50" r="4"/><path class="a-blink d4" d="M24 42a11 11 0 0 1 16 0"/><path class="a-blink d2" d="M16 34a22 22 0 0 1 32 0"/><path class="a-blink" d="M8 26a33 33 0 0 1 48 0"/>`,
  'транспорт и инженерия': `<g class="a-hop" style="animation-duration:1.6s"><path class="r o a-flicker" d="M27 42h10l-5 14z"/><path class="f" d="M32 4c9 8 11 22 8 38H24C21 26 23 12 32 4z"/><circle class="y" cx="32" cy="22" r="4.5"/><path class="f" d="M24 32l-8 10h9M40 32l8 10h-9"/></g>`,
  'криминалистика и тайны': `<g class="thin" style="opacity:.9;stroke-width:2"><path d="M20 46c-4-6-5-14-2-21M26 52c-6-8-8-20-3-29 4-6 14-7 18-1M32 54c-3-6-5-14-3-21 1-4 6-4 7 0 2 6 1 13 4 19M38 54c-2-8-1-16-3-22M44 46c2-6 2-14-1-19"/></g><path class="a-scan" style="stroke:var(--red);stroke-width:3" d="M10 12h44"/>`,
  _: `<path class="y o a-rot" style="animation-duration:14s" d="M32 6l7 17 18 2-14 12 4 18-15-9-15 9 4-18L7 25l18-2z"/>`,
};
const areaIcon = id => `<svg class="aico" viewBox="0 0 64 64" aria-hidden="true">${ICONS[areaName(id).toLowerCase().trim()] || ICONS._}</svg>`;
function setTint(c){ document.documentElement.style.setProperty('--c', c || '#EEC55A'); }

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
  ({home: renderHome, spin: renderSpin, study: renderStudy, record: renderRecord, gallery: () => document.fonts.ready.then(() => current === 'gallery' && gBuild()), settings: renderSettings}[name] || (() => {}))();
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
    if (T.phase === 'done') { label = 'Ещё тема'; sub = '✓ ' + topic.name; }
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
  else if (T.phase === 'done') { S.today = newToday(); save(); go('spin'); spin(); }
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
    $('#r-area').textContent = areaName(n.id); $('#r-ico').innerHTML = areaIcon(n.id); $('#r-title').textContent = n.name;
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
  $('#st-area').textContent = areaName(n.id); $('#st-title').textContent = n.name;
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
  $('#rc-area').textContent = areaName(n.id); $('#rc-title').textContent = n.name;
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
  const tint = parent ? colorOf(pid) : '#EEC55A'; setTint(tint);
  // хлебные крошки
  $('#g-crumbs').innerHTML = ['Моё поле', ...G.stack.map(id => splitEmoji(byId[id].name)[1])].map(s => `<span>${esc(s)}</span>`).join('');
  requestAnimationFrame(() => { const c = $('#g-crumbs'); c.scrollLeft = c.scrollWidth; });
  const kids = gLevelKids(), m = Math.min(G.W, G.H);
  const total = parent ? doneCount(parent) : leaves.filter(l => S.progress[l.id]).length;
  $('#g-empty').hidden = total > 0;
  // центр
  const [ce, cn] = parent ? splitEmoji(parent.name) : ['', 'Моё поле'];
  G.center = mkBubble({id: pid || null, center: true, color: tint, r: m * .17, icon: pid ? areaIcon(pid) : '', name: cn, count: total, x: G.W / 2, y: G.H / 2});
  // дети: размер по числу пройденных, суммарная площадь ~ 35% поля
  const max = Math.max(1, ...kids.map(doneCount));
  const w = kids.map(k => isLeaf(k) ? 1 : .55 + .45 * Math.sqrt(doneCount(k) / max));
  const sum = w.reduce((s, x) => s + x * x, 0) || 1;
  const base = Math.min(m * .19, Math.max(28, Math.sqrt(G.W * G.H * .26 / (Math.PI * sum))));
  const sx = spawn ? spawn.x : G.W / 2, sy = spawn ? spawn.y : G.H / 2;
  G.nodes = kids.map((k, i) => {
    const [e, n] = splitEmoji(k.name), ang = i / kids.length * Math.PI * 2 + Math.random() * .3;
    return mkBubble({id: k.id, leaf: isLeaf(k), color: colorOf(k.id), r: Math.min(m * .26, Math.max(base * w[i], minR(n))), icon: areaIcon(k.id), name: n,
      count: isLeaf(k) ? 0 : doneCount(k), x: sx + Math.cos(ang) * 20, y: sy + Math.sin(ang) * 20, delay: i * 40});
  });
  cancelAnimationFrame(G.raf); G.raf = requestAnimationFrame(gStep);
}
// подбор шрифта: самое длинное слово влезает в строку, всего не больше 3 строк
const mctx = document.createElement('canvas').getContext('2d');
function fitText(t, w, max, min, script){
  let fs = max, words = t.split(/\s+/), lines = 1;
  for (; fs > min; fs -= .5){
    mctx.font = script ? `${fs}px Lobster` : `700 ${fs}px "PT Serif"`;
    const sp = mctx.measureText(' ').width; let line = 0; lines = 1; let ok = true;
    for (const wd of words){ const ww = mctx.measureText(wd).width; if (ww > w) { ok = false; break; } if (line && line + sp + ww > w) { lines++; line = ww; } else line += (line ? sp : 0) + ww; }
    if (ok && lines <= 3) break;
  }
  return {fs, lines};
}
const longestWord = t => Math.max(...t.split(/\s+/).map(w => w.length));
// минимальный радиус, при котором название влезает в 3 строки шрифтом 12px
const minR = t => Math.max(40, 1.8 * Math.min(t.length, 52), 4.8 * longestWord(t) + 14);
function mkBubble(o){
  const el = document.createElement('div');
  el.className = 'bubble pop' + (o.center ? ' center' : '');
  el.style.cssText = `--bc:${o.color};width:${2 * o.r}px;height:${2 * o.r}px;animation-delay:${o.delay || 0}ms`;
  // подпись целиком внутри круга: шрифт под длину, иконка — на оставшееся место
  const name = o.name.length > 52 ? o.name.slice(0, 50) + '…' : o.name;
  const W = 1.5 * o.r, Wt = W - (o.center ? 6 : 24), fit = fitText(name, Wt, o.center ? 24 : 17, o.center ? 14 : 11, o.center);
  const fs = fit.fs, lines = fit.lines, ih = Math.min(o.r * (o.center ? .8 : .9), 1.6 * o.r - lines * fs * 1.15 - 16);
  const icon = o.icon && ih >= 20 ? o.icon.replace('class="aico"', `class="aico" style="width:${ih}px;height:${ih}px"`) : '';
  el.innerHTML = `${icon}<div class="n" style="--fs:${fs}px;--mw:${W}px">${esc(name)}</div>${o.count && !o.center ? `<div class="k">${o.count}</div>` : ''}`;
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
  $('#tp-area').textContent = areaName(id); $('#tp-ico').innerHTML = areaIcon(id); $('#tp-cap').textContent = n.name; $('#tp-title').textContent = n.name;
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
  const add = document.createElement('button'); add.className = 'add'; add.innerHTML = '＋<small>фото</small>';
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
async function addPhotos(files){
  const p = S.progress[topicId]; if (!p) return; p.photos ??= [];
  const imgs = [...files].filter(f => f.type.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
  if (!imgs.length) return toast('Это не картинка');
  for (const f of imgs){ const k = mediaId(); try { await DB.put(k, await shrink(f)); p.photos.push(k); } catch(err){ toast('Не хватает места'); } }
  save(); renderPhotos();
}
$('#tp-photo-in').onchange = e => { addPhotos(e.target.files); e.target.value = ''; };
{
  const zone = $('#s-topic'), box = $('#tp-photos'); let depth = 0;
  const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
  zone.addEventListener('dragenter', e => { if (!hasFiles(e)) return; e.preventDefault(); depth++; box.classList.add('drop'); box.scrollIntoView({block: 'nearest', behavior: 'smooth'}); });
  zone.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
  zone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; box.classList.remove('drop'); } });
  zone.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; box.classList.remove('drop'); addPhotos(e.dataTransfer.files); });
}
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
  setTint('#EEC55A');
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
  setTint(pid ? colorOf(pid) : '#EEC55A');
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
// слить темы add в копию tree; дубли по нормализованному имени пропускаются
function mergeTrees(base, add){
  const tree = JSON.parse(JSON.stringify(base)), seen = new Set();
  (function walk(ns){ for (const n of ns) n.children ? walk(n.children) : seen.add(norm(n.name)); })(tree);
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
  // новые разделы, где всё оказалось дублями, не оставляем
  const prune = ns => ns.filter(n => { if (!n.children) return true; n.children = prune(n.children); const keep = !n._new || n.children.length; delete n._new; return keep; });
  return {tree: prune(tree), added, dup};
}
async function mergeText(text){
  const {tree, added, dup} = mergeTrees(S.tree, parseTopics(text));
  if (!added) { toast(dup ? `Новых тем нет, дублей: ${dup}` : 'В файле не найдено тем'); return; }
  if (!await ask(`Добавить ${added} новых тем? Дублей пропущено: ${dup}.`, {input: false, ok: 'Добавить'})) return;
  S.tree = tree;
  ensureIds(S.tree); reindex(); save(); renderSettings(); toast(`Добавлено ${added} тем`);
}
// обновление встроенного списка у тех, кто уже пользуется: переименовать, затем дописать новое
function migrateTopics(){
  if ((S.topicsVer || 1) >= TOPICS_VER) return;
  for (const st of TOPIC_STEPS.filter(x => x.v > (S.topicsVer || 1))){
    const drop = new Set(st.drop || []);
    S.tree = (function walk(ns){
      return ns.filter(n => {
        if (n.children) { n.children = walk(n.children); return n.children.length > 0; }
        if (drop.has(n.name) && !S.progress[n.id]) return false;   // пройденные не трогаем
        if (st.rename?.[n.name]) n.name = st.rename[n.name];
        return true;
      });
    })(S.tree);
  }
  S.tree = mergeTrees(S.tree, parseTopics(DEFAULT_TOPICS)).tree;
  S.topicsVer = TOPICS_VER; ensureIds(S.tree); reindex(); save();
}

// ================= старт =================
migrateTopics();
go('home');
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
