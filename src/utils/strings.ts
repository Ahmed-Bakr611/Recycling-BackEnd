export const safeName = (name: any): string => {
  if (name == null) return "";
  if (typeof name === 'string') return name;
  if (typeof name === 'object') return (name.en || Object.values(name)[0] || '');
  return String(name);
};
