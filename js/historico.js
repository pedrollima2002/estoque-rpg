import { supabase } from './supabase-config.js';

const CAMPOS_HISTORICO = [
  'id',
  'produto_id',
  'produto_nome',
  'quantidade_anterior',
  'quantidade_nova',
  'tipo',
  'usuario_id',
  'usuario_email',
  'created_at'
].join(',');

export async function listarMovimentacoes(limite = 50) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select(CAMPOS_HISTORICO)
    .order('created_at', { ascending: false })
    .limit(limite);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// Cada alteração importante do estoque passa por esta função para alimentar a tela Histórico.
export async function registrarMovimentacao({
  produtoId,
  produtoNome,
  quantidadeAnterior,
  quantidadeNova,
  tipo,
  usuario
}) {
  const { error } = await supabase
    .from('movimentacoes')
    .insert({
      produto_id: produtoId,
      produto_nome: produtoNome,
      quantidade_anterior: quantidadeAnterior,
      quantidade_nova: quantidadeNova,
      tipo,
      usuario_id: usuario?.id ?? null,
      usuario_email: usuario?.email ?? ''
    });

  if (error) {
    throw error;
  }
}

export function observarMovimentacoes(callback) {
  const canal = supabase
    .channel('movimentacoes-rpg')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'movimentacoes' },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
