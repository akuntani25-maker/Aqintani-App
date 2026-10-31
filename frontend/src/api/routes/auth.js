// Pengganti backend/routers/auth_routes.py
import { db, supabase, callRpc, HttpError, ROLE_PERMISSIONS, requireAdmin } from '../core';

export async function loadProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !data) return null;
  return { ...data, created_at: data.created_at };
}

export default function register(route) {
  route('GET', '/auth/me', async ({ user }) => user);

  route('POST', '/auth/register', async ({ user, body }) => {
    requireAdmin(user);
    return callRpc('admin_create_user', {
      p_email: body.email, p_password: body.password, p_name: body.name,
      p_role: body.role || 'cashier', p_canvasser_id: body.canvasser_id || null,
    });
  });

  route('PUT', '/auth/profile', async ({ body }) => {
    if (!body.name && !body.email && !body.new_password) throw new HttpError(400, 'No fields to update');
    return callRpc('update_my_profile', {
      p_name: body.name || null, p_email: body.email || null,
      p_current_password: body.current_password || null, p_new_password: body.new_password || null,
    });
  });

  route('GET', '/users', async ({ user }) => {
    requireAdmin(user);
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (error) throw new HttpError(400, error.message);
    return data;
  });

  route('PUT', '/users/:id', async ({ user, params, body }) => {
    requireAdmin(user);
    return callRpc('admin_update_user', {
      p_id: params.id, p_name: body.name ?? null, p_role: body.role ?? null,
      p_password: body.password || null, p_canvasser_id: body.canvasser_id ?? null,
    });
  });

  route('DELETE', '/users/:id', async ({ user, params }) => {
    requireAdmin(user);
    await callRpc('admin_delete_user', { p_id: params.id });
    return { message: 'User deleted' };
  });

  route('GET', '/role-permissions', async ({ user }) => ({
    permissions: ROLE_PERMISSIONS, current_role: user?.role || '',
    current_permissions: ROLE_PERMISSIONS[user?.role] || [],
  }));

  route('GET', '/store-settings', async () => {
    const s = await db.store_settings.findOne({});
    return s || { store_name: 'UD. AQIN TANI', address: '', phone: '', email: '', logo_url: '' };
  });

  route('PUT', '/store-settings', async ({ user, body }) => {
    requireAdmin(user);
    const doc = {
      store_name: body.store_name || '', address: body.address || '', phone: body.phone || '',
      email: body.email || '', logo_url: body.logo_url || '',
    };
    await db.store_settings.deleteMany({});
    await db.store_settings.insertOne(doc);
    return doc;
  });
}
