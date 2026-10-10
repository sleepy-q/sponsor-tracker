const { sql, send, hash, startSession, readBody, route } = require('./_lib');
module.exports = route(['POST'], async (req, res) => {
  const b = await readBody(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { error: 'Enter a valid email.' });
  if (pw.length < 8 || pw.length > 200) return send(res, 400, { error: 'Password must be at least 8 characters.' });
  if (process.env.SIGNUP_CODE && String(b.code || '').trim() !== process.env.SIGNUP_CODE) return send(res, 403, { error: 'Invalid invite code.' });
  if ((await sql`SELECT 1 FROM sp_users WHERE email = ${email}`).length) return send(res, 409, { error: 'That email already has an account.' });
  const free = await sql`SELECT s FROM generate_series(1,10) s WHERE s NOT IN (SELECT slot FROM sp_users) ORDER BY s LIMIT 1`;
  if (!free.length) return send(res, 403, { error: 'All 10 spots are taken.' });
  let u;
  try { u = (await sql`INSERT INTO sp_users(email,pw,slot) VALUES (${email}, ${await hash(pw)}, ${free[0].s}) RETURNING id, email`)[0]; }
  catch (e) { return send(res, 409, { error: 'Sign-up collided. Try again.' }); }
  await startSession(res, u.id);
  send(res, 200, { user: { id: u.id, email: u.email, name: email.split('@')[0] } });
});
