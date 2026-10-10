const { sql, send, sha, tokenOf, setCookie, route } = require('./_lib');
module.exports = route(['POST'], async (req, res) => {
  const t = tokenOf(req);
  if (t) await sql`DELETE FROM sp_sessions WHERE token_hash = ${sha(t)}`;
  setCookie(res, '', 0);
  send(res, 200, { ok: true });
});
