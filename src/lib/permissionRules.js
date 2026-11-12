export function resolveAllowedPages(role, permissions, legacy, unavailable = false) {
  if (role === 'adm_principal') return legacy.adm_principal || [];
  if (unavailable) return [];
  const configured = permissions.filter((item) => item.role_key === role);
  return configured.length ? configured.filter((item) => item.allowed).map((item) => item.page_key) : (legacy[role] || []);
}
