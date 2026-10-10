const crypto = require('crypto');
const { sql, send, currentUser, readBody, route } = require('./_lib');
const ST = ['pending', 'confirmed', 'maybe', 'notconnected', 'rejected'];
const s = (v, n) => String(v || '').trim().slice(0, n);
const clean = b => ({ name: s(b.name, 200), location: s(b.location, 100), phone: s(b.phone, 50), status: ST.includes(b.status) ? b.status : 'pending', by: s(b.by, 60), notes: s(b.notes, 2000) });
const out = r => ({ id: r.id, name: r.name, location: r.location, phone: r.phone, status: r.status, by: r.by_name, notes: r.notes, updatedAt: new Date(r.updated_at).getTime(), updatedBy: r.updated_by });

module.exports = route(['GET', 'POST', 'PUT', 'DELETE'], async (req, res) => {
  const u = await currentUser(req);
  if (!u) return send(res, 401, { error: 'Not signed in.' });
  const id = req.query && req.query.id;
  if (req.method === 'GET') return send(res, 200, { contacts: (await sql`SELECT * FROM sp_contacts ORDER BY updated_at DESC`).map(out) });
  if (req.method === 'DELETE') {
    if (!id) return send(res, 400, { error: 'Missing id.' });
    await sql`DELETE FROM sp_contacts WHERE id = ${id}`;
    return send(res, 200, { ok: true });
  }
  const c = clean(await readBody(req));
  if (!c.name) return send(res, 400, { error: 'Name is required.' });
  if (req.method === 'POST') {
    const nid = crypto.randomUUID();
    await sql`INSERT INTO sp_contacts(id,name,location,phone,status,by_name,notes,updated_by) VALUES (${nid}, ${c.name}, ${c.location}, ${c.phone}, ${c.status}, ${c.by}, ${c.notes}, ${u.name})`;
    return send(res, 200, { id: nid });
  }
  if (!id) return send(res, 400, { error: 'Missing id.' });
  await sql`UPDATE sp_contacts SET name=${c.name}, location=${c.location}, phone=${c.phone}, status=${c.status}, by_name=${c.by}, notes=${c.notes}, updated_at=now(), updated_by=${u.name} WHERE id=${id}`;
  send(res, 200, { ok: true });
});
