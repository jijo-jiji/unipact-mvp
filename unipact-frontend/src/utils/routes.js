export const homePathForRole = (role) => {
  if (role === 'COMPANY') return '/company/dashboard';
  if (role === 'ADMIN') return '/admin';
  return '/student/dashboard';
};
