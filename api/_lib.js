const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const sql = neon(process.env.DATABASE_URL);

const SEED = [
['Laptop Hub','Payyanur','+91 88916 30801','maybe'],['Computer Care','Payyanur','+91 4985 202234','maybe'],
['Cybertech IT Solutions','','+91 99473 20515','rejected'],['Malabar Graphics','Payyanur','+91 4985 202442','notconnected'],
['KVR Dream Vehicles (Tata Cars)','','+91 88792 20087','notconnected'],['Federal Bank','Payyanur','1800 425 1199','pending'],
['CADD Centre','Payyanur','+91 96563 33332','notconnected'],['Matrix Group of Educations','','+91 99611 49111','pending'],
['Techcake Cloud Innovations LLP','','+91 95449 57747','pending'],['Shopprix Super Mart','Payyanur','04985 209619','pending'],
['Manifold GATE/NET Coaching','','+91 487 238 2342','pending'],['GATEFORUM','Kannur','62359 96699','rejected'],
['GATE Data Science','','78999 68335','rejected'],['Pioneer','Kannur','90612 23242','rejected'],
['Brilliance PSC Coaching Centre','','+91 4985 209480','rejected'],['Professional PSC Coaching Centre','','+91 70127 78392','rejected'],
["Aadhi's Career Point",'','+91 94955 11004','rejected'],['IBT Institute','Payyanur','+91 4985 201255','notconnected'],
['One Zero PSC Coaching Center','','+91 98474 21610','rejected'],['Inker Robotics','','90615 00800','rejected'],
['Infosys','','080 2852 0261','rejected'],['QSpiders','','96868 00700','rejected'],['IBM India','','080 4011 4047','rejected'],
['Forbes Marshall','','020 6813 8555','rejected'],['TCS iON','','1800 266 6282','rejected'],
['Criti Designs','','73066 12105','maybe'],['yemek','','8157028238','maybe']];

let ready;
function init() {
  if (!ready) ready = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS sp_users (id serial PRIMARY KEY, email text UNIQUE NOT NULL, pw text NOT NULL, slot int UNIQUE NOT NULL CHECK (slot BETWEEN 1 AND 10), created_at timestamptz DEFAULT now())`;
    await sql`CREATE TABLE IF NOT EXISTS sp_sessions (token_hash text PRIMARY KEY, user_id int NOT NULL REFERENCES sp_users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL)`;
    await sql`CREATE TABLE IF NOT EXISTS sp_login_fails (email text PRIMARY KEY, fails int NOT NULL DEFAULT 0, locked_until timestamptz)`;
    await sql`CREATE TABLE IF NOT EXISTS sp_contacts (id text PRIMARY KEY, name text NOT NULL, location text NOT NULL DEFAULT '', phone text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'pending', by_name text NOT NULL DEFAULT '', notes text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(), updated_by text NOT NULL DEFAULT '')`;
    await sql`CREATE TABLE IF NOT EXISTS sp_meta (k text PRIMARY KEY)`;
    const first = await sql`INSERT INTO sp_meta(k) VALUES ('seeded') ON CONFLICT DO NOTHING RETURNING k`;
    if (first.length) {
      await sql`INSERT INTO sp_contacts(id,name,location,phone,status,updated_at)
        SELECT 's'||lpad(i::text,2,'0'), n, l, p, s, now() - (i||' seconds')::interval
        FROM unnest(${SEED.map((_, i) => i + 1)}::int[], ${SEED.map(r => r[0])}::text[], ${SEED.map(r => r[1])}::text[], ${SEED.map(r => r[2])}::text[], ${SEED.map(r => r[3])}::text[]) AS t(i,n,l,p,s)
        ON CONFLICT DO NOTHING`;
    }
  })().catch(e => { ready = null; throw e; });
  return ready;
}

const send = (res, code, obj) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); };
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const hash = async pw => { const s = crypto.randomBytes(16); return s.toString('hex') + ':' + (await scrypt(pw, s, 64)).toString('hex'); };
const verify = async (pw, stored) => { const [s, h] = stored.split(':'); const a = await scrypt(pw, Buffer.from(s, 'hex'), 64), b = Buffer.from(h, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const setCookie = (res, v, age) => res.setHeader('Set-Cookie', `sp_session=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`);
const tokenOf = req => { const m = (req.headers.cookie || '').match(/(?:^|;\s*)sp_session=([a-f0-9]+)/); return m && m[1]; };
async function startSession(res, userId) {
  const t = crypto.randomBytes(32).toString('hex');
  await sql`INSERT INTO sp_sessions(token_hash,user_id,expires_at) VALUES (${sha(t)}, ${userId}, now() + interval '60 days')`;
  setCookie(res, t, 60 * 86400);
}
async function currentUser(req) {
  const t = tokenOf(req); if (!t) return null;
  const r = await sql`SELECT u.id, u.email FROM sp_sessions s JOIN sp_users u ON u.id = s.user_id WHERE s.token_hash = ${sha(t)} AND s.expires_at > now()`;
  return r[0] ? { id: r[0].id, email: r[0].email, name: r[0].email.split('@')[0] } : null;
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return {}; }
}
const route = (methods, fn) => async (req, res) => {
  try {
    if (!methods.includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
    await init(); await fn(req, res);
  } catch (e) { console.error(e); send(res, 500, { error: 'Server error' }); }
};
module.exports = { sql, send, sha, hash, verify, setCookie, tokenOf, startSession, currentUser, readBody, route };
