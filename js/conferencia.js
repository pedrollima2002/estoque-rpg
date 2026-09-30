import { supabase } from './supabase-config.js';

export async function obterConferenciaAberta() {
  const { data, error } = await supabase
    .from('conferencias')
    .select('*')
    .eq('status', 'em_andamento')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function iniciarConferencia(categoria) {
  const { data, error } = await supabase.rpc('iniciar_conferencia', {
    p_categoria: categoria
  });
  if (error) throw error;
  return data;
}

export async function listarItensConferencia(conferenciaId) {
  const { data, error } = await supabase
    .from('conferencia_itens')
    .select(`
      id,
      conferencia_id,
      produto_id,
      quantidade_sistema,
      quantidade_contada,
      conferido_em,
      produtos (
        id,
        nome,
        descricao,
        categoria,
        subcategoria,
        cor,
        tamanho,
        quantidade,
        ativo
      )
    `)
    .eq('conferencia_id', conferenciaId);

  if (error) throw error;

  return (data ?? []).sort((a, b) => {
    const produtoA = a.produtos ?? {};
    const produtoB = b.produtos ?? {};
    return [produtoA.subcategoria, produtoA.nome, produtoA.cor, produtoA.tamanho]
      .map((valor) => valor ?? '')
      .join('|')
      .localeCompare(
        [produtoB.subcategoria, produtoB.nome, produtoB.cor, produtoB.tamanho]
          .map((valor) => valor ?? '')
          .join('|'),
        'pt-BR'
      );
  });
}

export async function salvarContagemItem(itemId, quantidade) {
  const { data, error } = await supabase
    .from('conferencia_itens')
    .update({
      quantidade_contada: Number(quantidade),
      conferido_em: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function aplicarAjustesConferencia(conferenciaId) {
  const { data, error } = await supabase.rpc('aplicar_ajustes_conferencia', {
    p_conferencia_id: conferenciaId
  });

  if (error) throw error;
  return data;
}

export async function cancelarConferencia(conferenciaId) {
  const { error } = await supabase.rpc('cancelar_conferencia', {
    p_conferencia_id: conferenciaId
  });

  if (error) throw error;
}
