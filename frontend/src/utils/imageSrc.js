// Foto produk disimpan di Supabase Storage (URL penuh). Data lama berupa path relatif tetap ditampilkan.
export const imageSrc = (url) => {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/.test(url)) return url;
  return `${process.env.REACT_APP_SUPABASE_URL || ''}${url}`;
};
