const { sql, send, verify, startSession, readBody, route } = require('./_lib');
module.exports = route(['POST'], async (req, res) => {
  const b = await readBody(req), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
  const f = (await sql`SELECT locked_until FROM sp_login_fails WHERE email = ${email}`)[0];
  if (f && f.locked_until && new Date(f.locked_until) > new Date()) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
  const u = (await sql`SELECT id, email, pw FROM sp_users WHERE email = ${email}`)[0];
  if (!(u && await verify(pw, u.pw))) {
    await sql`INSERT INTO sp_login_fails(email, fails) VALUES (${email}, 1)
      ON CONFLICT (email) DO UPDATE SET
        fails = CASE WHEN sp_login_fails.fails + 1 >= 8 THEN 0 ELSE sp_login_fails.fails + 1 END,
        locked_until = CASE WHEN sp_login_fails.fails + 1 >= 8 THEN now() + interval '15 minutes' ELSE NULL END`;
    return send(res, 401, { error: 'Wrong email or password.' });
  }
  await sql`DELETE FROM sp_login_fails WHERE email = ${email}`;
  await startSession(res, u.id);
  send(res, 200, { user: { id: u.id, email: u.email, name: u.email.split('@')[0] } });
});
