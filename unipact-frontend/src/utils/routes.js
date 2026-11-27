export const homePathForRole = (role) => {
  if (role === 'COMPANY') return '/company/dashboard';
  if (role === 'ADMIN') return '/admin';
  if (role === 'STAFF') return '/campus';
  return '/student/dashboard';
};
