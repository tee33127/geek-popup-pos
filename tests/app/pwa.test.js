// PWA: manifest + ไอคอน + service worker (จำลอง caches/fetch ใน vm เปล่า แล้วตัดเน็ต)
const vm = require('vm'), fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '../../app'), read = f => fs.readFileSync(path.join(APP, f), 'utf8');
let fails = 0; const eq = (n, g, e) => { const ok = JSON.stringify(g) === JSON.stringify(e); if(!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} expected ${JSON.stringify(e)}`); };

/* manifest + ไอคอน */
const man = JSON.parse(read('manifest.webmanifest'));
eq('manifest basics', [man.start_url, man.scope, man.display, man.theme_color], ['./', './', 'standalone', '#1A00B8']);
const pngSize = f => { const b = fs.readFileSync(path.join(APP, f)); return b.readUInt32BE(16) + 'x' + b.readUInt32BE(20); };
eq('icon files match declared sizes', man.icons.map(i => pngSize(i.src)), man.icons.map(i => i.sizes));
eq('has 192 + 512 + maskable', [man.icons.some(i => i.sizes === '192x192'), man.icons.some(i => i.sizes === '512x512'), man.icons.some(i => i.purpose === 'maskable')], [true, true, true]);
const html = read('index.html');
eq('index links manifest', html.includes('<link rel="manifest" href="manifest.webmanifest">'), true);
eq('prototype is not a PWA', /<link rel="manifest"/.test(fs.readFileSync(path.join(__dirname, '../../prototype/pos.html'), 'utf8')), false);

/* รายการไฟล์ใน sw.js ต้องครอบคลุมทุกไฟล์ที่หน้าใช้ และทุกไฟล์ต้องมีจริง */
const swSrc = read('sw.js');
const ctx0 = vm.createContext({self:{addEventListener(){}}});
vm.runInContext(swSrc.replace(/const /g, 'var '), ctx0);
const FILES = ctx0.FILES;
eq('VERSION stamped by build', /^[0-9a-f]{12}$/.test(ctx0.VERSION), true);
const used = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
  .concat(...fs.readdirSync(path.join(APP, 'js'), {recursive:true}).filter(f => f.endsWith('.js')).map(f => [...read('js/' + f).matchAll(/'(img\/[^']+)'/g)].map(m => m[1])))
  .concat(man.icons.map(i => i.src));
eq('every used file is cached', used.filter(f => !FILES.includes(f)), []);
eq('every cached file exists', FILES.filter(f => f !== './' && !fs.existsSync(path.join(APP, f))), []);
eq('start page cached', FILES.includes('./') && FILES.includes('index.html'), true);

/* ไม่มีอีโมจิในแอป (ใช้ไอคอน SVG จาก js/icons.js แทน) */
const emoji = FILES.filter(f => /\.(js|html|css)$/.test(f)).flatMap(f => [...read(f).matchAll(/\p{Extended_Pictographic}/gu)].map(m => f + ' ' + m[0]));
eq('no emoji in app source', emoji, []);
const ic = vm.createContext({}); vm.runInContext(read('js/icons.js').replace(/const /g, 'var '), ic);
const usedIcons = [...new Set(FILES.filter(f => f.endsWith('.js')).concat('../prototype/demo-seed.js').flatMap(f => [...read(f).matchAll(/icon\('(\w+)'/g)].map(m => m[1])))];
eq('every icon used exists', usedIcons.filter(n => !ic.ICONS[n]), []);
eq('icons found in code', usedIcons.length >= 10, true);

/* จำลอง service worker: ติดตั้ง → ตัดเน็ต → ยังเปิดได้ */
(async () => {
  const stores = new Map(), handlers = {}; let online = true, fetched = [];
  class Req { constructor(u, o = {}){ this.url = u; this.cache = o.cache; this.method = o.method || 'GET'; } }
  const norm = u => (typeof u === 'string' ? u : u.url).split('?')[0];
  const cacheObj = () => { const m = new Map(); return {m,
    addAll: rs => Promise.all(rs.map(r => fetchFn(r).then(res => m.set(norm(r), res)))),
    match: r => Promise.resolve(m.get(norm(r)))}; };
  const fetchFn = r => { fetched.push(r); return online ? Promise.resolve({body: norm(r)}) : Promise.reject(new Error('offline')); };
  const caches = {open: k => { if(!stores.has(k)) stores.set(k, cacheObj()); return Promise.resolve(stores.get(k)); },
    keys: () => Promise.resolve([...stores.keys()]), delete: k => Promise.resolve(stores.delete(k))};
  let skipped = false, claimed = false;
  const self = {addEventListener: (t, f) => handlers[t] = f, skipWaiting: () => { skipped = true; }, clients: {claim: () => { claimed = true; }}};
  vm.runInContext(swSrc, vm.createContext({self, caches, fetch: fetchFn, Request: Req, Promise}));
  const fire = async (t, extra = {}) => { let p, resp; handlers[t]({...extra, waitUntil: x => p = x, respondWith: x => resp = x}); await p; return resp; };

  stores.set('geek-pos-old', cacheObj());
  await fire('install');
  const cur = 'geek-pos-' + ctx0.VERSION;
  eq('install caches every file', [...stores.get(cur).m.keys()].sort(), [...FILES].sort());
  eq('install bypasses HTTP cache', fetched.every(r => r.cache === 'reload'), true);
  eq('new version activates right away', skipped, true);
  await fire('activate');
  eq('old version cache removed', [...stores.keys()], [cur]);
  eq('clients claimed', claimed, true);

  online = false;
  const get = async u => { const r = await fire('fetch', {request: new Req(u)}); return r ? (await r).body : 'passthrough'; };
  eq('offline: page + script served from cache', [await get('./'), await get('js/store.js?v=1')], ['./', 'js/store.js']);
  const post = await fire('fetch', {request: new Req('x', {method:'POST'})});
  eq('non-GET not intercepted', post, undefined);
  let err = null; try{ await get('https://example.com/other'); }catch(e){ err = e.message; }
  eq('uncached offline request fails normally', err, 'offline');

  console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
