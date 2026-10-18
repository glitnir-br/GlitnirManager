const clean = (value) => String(value || '').trim();

export function humanizePrefab(prefab) {
  return clean(prefab)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-zà-ÿ0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-zà-ÿ])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function itemDisplayName(item) {
  const prefab = clean(item?.prefab);
  const english = clean(item?.english);
  const token = clean(item?.token);
  if (english && english.toLowerCase() !== prefab.toLowerCase()) return english;
  if (token && !token.startsWith('$') && token.toLowerCase() !== prefab.toLowerCase()) return token;
  return humanizePrefab(prefab) || 'Item desconhecido';
}

export function shouldShowPrefab(name, prefab) {
  return Boolean(clean(prefab) && clean(name).toLowerCase() !== clean(prefab).toLowerCase());
}
