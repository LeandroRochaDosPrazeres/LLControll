import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshToken } from '@/lib/mercadolivre/client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ML_API_BASE = 'https://api.mercadolibre.com';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Busca TODOS os IDs de anúncios do vendedor com paginação automática.
 */
async function fetchAllItemIds(
  mlUserId: string,
  accessToken: string
): Promise<string[]> {
  const allIds: string[] = [];
  let offset = 0;
  const limit = 50;
  let total = Infinity;

  while (offset < total) {
    const res = await fetch(
      `${ML_API_BASE}/users/${mlUserId}/items/search?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      throw new Error(`Erro ao buscar IDs dos anúncios (offset ${offset})`);
    }

    const data = await res.json();
    total = data.paging?.total ?? data.results?.length ?? 0;
    allIds.push(...(data.results || []));
    offset += limit;
  }

  return allIds;
}

/**
 * Busca detalhes de itens em lotes de 20 (limite da API multiget do ML).
 */
async function fetchItemsDetails(
  itemIds: string[],
  accessToken: string
): Promise<any[]> {
  const items: any[] = [];
  const BATCH = 20;

  for (let i = 0; i < itemIds.length; i += BATCH) {
    const batch = itemIds.slice(i, i + BATCH);
    const res = await fetch(
      `${ML_API_BASE}/items?ids=${batch.join(',')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      console.error(`Erro no lote ${Math.floor(i / BATCH) + 1}`);
      continue;
    }

    const data = await res.json();
    for (const entry of data) {
      if (entry.code === 200 && entry.body) {
        items.push(entry.body);
      }
    }
  }

  return items;
}

// ─── Endpoint ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Buscar credenciais do ML
    const { data: config, error: configErr } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires_at')
      .eq('user_id', user_id)
      .single();

    if (configErr || !config?.ml_access_token) {
      return NextResponse.json({ error: 'ML não conectado' }, { status: 401 });
    }

    let accessToken = config.ml_access_token;

    // 2. Renovar token se expirado
    if (config.ml_token_expires_at) {
      const expiresAt = new Date(config.ml_token_expires_at);
      if (expiresAt <= new Date()) {
        try {
          const newToken = await refreshToken(config.ml_refresh_token);
          accessToken = newToken.access_token;

          await supabase
            .from('configuracoes')
            .update({
              ml_access_token: newToken.access_token,
              ml_refresh_token: newToken.refresh_token,
              ml_token_expires_at: new Date(
                Date.now() + newToken.expires_in * 1000
              ).toISOString(),
            })
            .eq('user_id', user_id);
        } catch {
          return NextResponse.json(
            { error: 'Erro ao renovar token ML. Reconecte sua conta.' },
            { status: 401 }
          );
        }
      }
    }

    // 3. Buscar TODOS os IDs com paginação
    const allItemIds = await fetchAllItemIds(config.ml_user_id, accessToken);

    // 4. Buscar detalhes em lotes de 20
    const mlItems =
      allItemIds.length > 0
        ? await fetchItemsDetails(allItemIds, accessToken)
        : [];

    // 5. Buscar TODOS os produtos locais vinculados ao ML (1 única query)
    const { data: existingProducts } = await supabase
      .from('produtos')
      .select('id, ml_id, quantidade, valor_venda, nome, foto_url, ativo')
      .eq('user_id', user_id)
      .not('ml_id', 'is', null);

    const existingMap = new Map(
      (existingProducts || []).map((p) => [p.ml_id, p])
    );

    // Conjunto de ml_ids que vieram do ML (para exclusão lógica)
    const mlIdSet = new Set(mlItems.map((item) => item.id));

    // 6. Preparar operações de upsert
    const toInsert: any[] = [];
    const updatePromises: PromiseLike<any>[] = [];
    let created = 0;
    let updated = 0;
    let deactivated = 0;

    for (const item of mlItems) {
      const isActive = item.status === 'active';
      const existing = existingMap.get(item.id);
      const thumbnail =
        item.thumbnail?.replace('http://', 'https://') || null;

      if (existing) {
        // ── Já existe: atualizar se algo mudou ──────────────────
        const needsUpdate =
          existing.quantidade !== item.available_quantity ||
          existing.valor_venda !== item.price ||
          existing.nome !== item.title ||
          existing.foto_url !== thumbnail ||
          existing.ativo !== isActive;

        if (needsUpdate) {
          updatePromises.push(
            supabase
              .from('produtos')
              .update({
                quantidade: item.available_quantity,
                valor_venda: item.price,
                nome: item.title,
                foto_url: thumbnail,
                ativo: isActive,
              })
              .eq('id', existing.id)
          );
          updated++;
        }
      } else {
        // ── Não existe: inserir novo produto ────────────────────
        toInsert.push({
          user_id,
          nome: item.title,
          foto_url: thumbnail,
          quantidade: item.available_quantity,
          valor_pago: 0, // Usuário preenche depois
          valor_venda: item.price,
          ml_id: item.id,
          taxa_tipo: 'classico',
          ativo: isActive,
        });
        created++;
      }
    }

    // 7. Exclusão lógica: desativar produtos cujo ml_id não veio mais do ML
    const idsToDeactivate = (existingProducts || [])
      .filter((p) => p.ativo && p.ml_id && !mlIdSet.has(p.ml_id))
      .map((p) => p.id);

    if (idsToDeactivate.length > 0) {
      updatePromises.push(
        supabase
          .from('produtos')
          .update({ ativo: false })
          .in('id', idsToDeactivate)
      );
      deactivated = idsToDeactivate.length;
    }

    // 8. Executar INSERT em batch (1 única chamada)
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase
        .from('produtos')
        .insert(toInsert);

      if (insertErr) {
        console.error('Erro ao inserir produtos:', insertErr);
      }
    }

    // 9. Executar UPDATEs em paralelo
    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      for (const r of results) {
        if (r.error) console.error('Erro em update:', r.error);
      }
    }

    return NextResponse.json({
      success: true,
      synced: created + updated + deactivated,
      details: {
        created,
        updated,
        deactivated,
        totalML: mlItems.length,
      },
    });
  } catch (err: any) {
    console.error('Erro ao sincronizar estoque:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
