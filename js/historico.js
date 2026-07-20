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

function normalizarTextoProduto(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

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
  await registrarMovimentacoes([{
    produtoId,
    produtoNome,
    quantidadeAnterior,
    quantidadeNova,
    tipo,
    usuario
  }]);
}

export async function registrarMovimentacoes(movimentacoes) {
  const { error } = await supabase
    .from('movimentacoes')
    .insert(movimentacoes.map((movimentacao) => ({
      produto_id: movimentacao.produtoId,
      produto_nome: normalizarTextoProduto(movimentacao.produtoNome),
      quantidade_anterior: movimentacao.quantidadeAnterior,
      quantidade_nova: movimentacao.quantidadeNova,
      tipo: movimentacao.tipo,
      usuario_id: movimentacao.usuario?.id ?? null,
      usuario_email: movimentacao.usuario?.email ?? ''
    })));

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
