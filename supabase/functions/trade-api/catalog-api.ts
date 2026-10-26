// The caller has already verified Auth and active operator membership.
// Mutations repeat authorization in the database and commit with their audit event.
export async function handleCatalog(action: string, body: Record<string, any>, ctx: {
  db: any; userId: string; role: string | null;
  out: (body: unknown, status?: number) => Response;
}): Promise<Response | null> {
  if (!action.startsWith('catalog.') && !action.startsWith('sectors.')) return null;
  const {db, role, out, userId} = ctx;
  if (!role) return out({error: 'Operator access required'}, 403);
  if (action === 'catalog.list') {
    const {data, error} = await db.from('Product')
      .select('id,name,slug,description,sectorId,status,visibility,updatedAt,skus:SKU(id,skuCode,name,unit,minimumOrderQty,currency,specifications,media:Media(url,type,sortOrder))')
      .eq('organizationId', 'septlion-operator').order('updatedAt', {ascending: false}).limit(200);
    return error ? out({error: 'تعذر قراءة المنتجات'}, 503) : out({items: data || []});
  }
  if (action === 'sectors.list') {
    const {data, error} = await db.from('Sector').select('id,code,name,description,updatedAt').order('name').limit(200);
    return error ? out({error: 'تعذر قراءة القطاعات'}, 503) : out({items: data || []});
  }
  if (!['catalog.save', 'catalog.publish', 'catalog.archive', 'sectors.save'].includes(action)) return out({error: 'Unsupported action'}, 400);
  if (role !== 'ADMIN') return out({error: 'Admin access required'}, 403);
  if (!body.input || typeof body.input !== 'object' || Array.isArray(body.input)) return out({error: 'Invalid input'}, 400);
  if (typeof body.key !== 'string' || !/^[a-zA-Z0-9_-]{12,100}$/.test(body.key)) return out({error: 'Invalid idempotency key'}, 400);
  if (['catalog.publish', 'catalog.archive'].includes(action) && body.input.confirm !== true) return out({error: 'Explicit confirmation required'}, 400);
  const {data, error} = await db.rpc('mutate_operator_catalog', {p_user_id: userId, p_action: action, p_input: body.input, p_key: body.key});
  if (error) {
    const code = String(error.message || '');
    const status = code.includes('access_denied') ? 403 : /conflict|duplicate|archived/.test(code) ? 409 : code.includes('not_found') ? 404 : 400;
    return out({error: status === 409 ? 'تغير السجل أو تكرر الرمز. حدّث البيانات قبل المحاولة.' : status === 403 ? 'Admin access required' : 'تعذر الحفظ. راجع الحقول والقطاع والتعبئات.'}, status);
  }
  return out(data);
}
