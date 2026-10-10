const { sql, send, currentUser, route } = require('./_lib');

module.exports = route(['GET'], async (req, res) => {
  const user = await currentUser(req, res);
  const n = (await sql`SELECT count(*)::int AS n FROM sp_users`)[0].n;
  const full = n >= 10;

  if (!user) {
    // Anonymous: don't reveal the exact user count, just whether signup is open.
    return send(res, 200, {
      user: null,
      signupOpen: !full,
      needsCode: !!process.env.SIGNUP_CODE,
    });
  }

  send(res, 200, {
    user,
    slotsLeft: Math.max(0, 10 - n),
    needsCode: !!process.env.SIGNUP_CODE,
  });
});
