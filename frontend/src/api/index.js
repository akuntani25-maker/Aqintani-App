// `api` pengganti axios: halaman tetap memanggil api.get('/products') dst.,
// tetapi permintaan dijalankan langsung ke Supabase lewat src/api/routes/*.
import { HttpError, supabase } from './core';
import registerAuth, { loadProfile } from './routes/auth';
import registerProducts from './routes/products';
import registerSuppliers from './routes/suppliers';
import registerPos from './routes/pos';
import registerPartners from './routes/partners';
import registerField from './routes/field';
import registerReports from './routes/reports';
import registerAdmin from './routes/admin';

const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z_]+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; }) + '/?$');
  // rute statis didahulukan daripada rute ber-parameter (mis. /products/low-stock sebelum /products/:id)
  routes.push({ method, re, keys, handler, weight: keys.length });
}
[registerAuth, registerProducts, registerSuppliers, registerPos, registerPartners, registerField, registerReports, registerAdmin].forEach(r => r(route));
routes.sort((a, b) => a.weight - b.weight);

// ---------- pengguna yang sedang login (profil + peran) ----------
let currentUser = null;
let userPromise = null;
export function setCurrentUser(u) { currentUser = u; userPromise = null; }
async function getUser() {
  if (currentUser) return currentUser;
  if (!userPromise) userPromise = loadProfile().then(u => { currentUser = u; return u; }).finally(() => { userPromise = null; });
  return userPromise;
}
supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') currentUser = null; });

function parse(url, config) {
  let path = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\/api(?=\/)/, '');
  const [p, qs] = path.split('?');
  const query = {};
  new URLSearchParams(qs || '').forEach((v, k) => { query[k] = v; });
  Object.entries(config?.params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null) query[k] = String(v); });
  return { path: p, query };
}

async function call(method, url, body, config) {
  const { path, query } = parse(url, config);
  const m = routes.find(r => r.method === method && r.re.test(path));
  if (!m) throw new HttpError(404, `Fitur ${method} ${path} tidak tersedia`);
  const match = path.match(m.re);
  const params = Object.fromEntries(m.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]));
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sesi berakhir, silakan login ulang');
  try {
    const data = await m.handler({ params, query, body: body ?? {}, user });
    return { data, status: 200, headers: {}, config: config || {} };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    console.error(`[api] ${method} ${path}`, e);
    throw new HttpError(500, e?.message || 'Terjadi kesalahan');
  }
}

export const api = {
  get: (url, config) => call('GET', url, undefined, config),
  delete: (url, config) => call('DELETE', url, undefined, config),
  post: (url, body, config) => call('POST', url, body, config),
  put: (url, body, config) => call('PUT', url, body, config),
  patch: (url, body, config) => call('PATCH', url, body, config),
  interceptors: { request: { use() {} }, response: { use() {} } },
  defaults: { headers: { common: {} } },
};

export { supabase, loadProfile };
