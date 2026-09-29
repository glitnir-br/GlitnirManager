// Simples função de hash para senhas (em produção usar bcrypt no backend)
export const hashPassword = (password) => {
  // Implementação simples - em produção NUNCA guardar senhas no frontend!
  // Usar sempre: salted bcrypt no backend
  let hash = 0;
  if (password.length === 0) return hash.toString();

  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
};

export const comparePassword = (password, hash) => {
  return hashPassword(password) === hash;
};

// Para dados sensíveis - mascarar na exibição
export const maskSensitiveData = (data, visibleChars = 4) => {
  if (!data) return '';
  if (data.length <= visibleChars) return '*'.repeat(data.length);
  
  const visible = data.slice(-visibleChars);
  const masked = '*'.repeat(data.length - visibleChars);
  return masked + visible;
};

// Mascarar email
export const maskEmail = (email) => {
  const [name, domain] = email.split('@');
  const maskedName = name[0] + '*'.repeat(Math.max(0, name.length - 2)) + name[name.length - 1];
  return `${maskedName}@${domain}`;
};
