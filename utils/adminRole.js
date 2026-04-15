const DEFAULT_ADMIN_EMAILS = ['info.noturl@gmail.com'];

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const parseAdminEmails = () => {
  const configured = String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  const unique = new Set([...DEFAULT_ADMIN_EMAILS, ...configured].map(normalizeEmail));
  return unique;
};

const adminEmails = parseAdminEmails();

const getRoleForEmail = (email) => (adminEmails.has(normalizeEmail(email)) ? 'admin' : 'user');

const syncUserRoleByEmail = (user, emailValue) => {
  const email = emailValue !== undefined ? emailValue : user?.email;
  const nextRole = getRoleForEmail(email);
  if (user) {
    user.role = nextRole;
  }
  return nextRole;
};

module.exports = {
  normalizeEmail,
  getRoleForEmail,
  syncUserRoleByEmail,
};
