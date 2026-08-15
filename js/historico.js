import { supabase } from './supabase-config.js';
import { escaparFiltroPostgrest, inicioDoMesIso } from './utils.js';

const CAMPOS_COMPLETOS = [
  'id',
  'produto_id',
  'produto_nome',
  'produto_categoria',
  'produto_subcategoria',
  'produto_cor',
  'produto_tamanho',
  'quantidade_anterior',
  'quantidade_nova',
  'diferenca',
  'tipo',
  'motivo',
  'usuario_id',
  'usuario_email',
  'usuario_nome',
  'created_at'
].join(',');

const CAMPOS_ANTIGOS = [
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

function normalizarMovimentacao(item) {
  return {
    ...item,
    diferenca: Number(item.diferenca ?? Number(item.quantidade_nova) - Number(item.quantidade_anterior)),
    motivo: item.motivo ?? '',
    usuario_nome: item.usuario_nome ?? '',
    produto_categoria: item.produto_categoria ?? '',
    produto_subcategoria: item.produto_subcategoria ?? '',
    produto_cor: item.produto_cor ?? '',
    produto_tamanho: item.produto_tamanho ?? ''
  };
}

function aplicarFiltros(query, filtros) {
  if (filtros.inicio) query = query.gte('created_at', filtros.inicio);
  if (filtros.fim) query = query.lte('created_at', filtros.fim);
  if (filtros.produto) query = query.ilike('produto_nome', `%${filtros.produto.trim()}%`);
  if (filtros.categoria) query = query.eq('produto_categoria', filtros.categoria);
  if (filtros.usuario) query = query.ilike('usuario_email', `%${filtros.usuario.trim()}%`);
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo);

  const busca = escaparFiltroPostgrest(filtros.busca);
  if (busca) {
    query = query.or(`produto_nome.ilike.%${busca}%,motivo.ilike.%${busca}%,produto_cor.ilike.%${busca}%,produto_tamanho.ilike.%${busca}%`);
  }

  return query;
}

export async function listarMovimentacoes({ pagina = 0, limite = 30, filtros = {} } = {}) {
  const inicio = pagina * limite;
  const fim = inicio + limite - 1;
  let query = supabase
    .from('movimentacoes')
    .select(CAMPOS_COMPLETOS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(inicio, fim);

  query = aplicarFiltros(query, filtros);
  let resposta = await query;

  if (resposta.error && /produto_categoria|diferenca|motivo|usuario_nome/.test(resposta.error.message ?? '')) {
    resposta = await supabase
      .from('movimentacoes')
      .select(CAMPOS_ANTIGOS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(inicio, fim);
  }

  if (resposta.error) throw resposta.error;

  return {
    itens: (resposta.data ?? []).map(normalizarMovimentacao),
    total: resposta.count ?? 0
  };
}

export async function obterResumoMovimentacoesMes() {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('diferenca,tipo,created_at')
    .gte('created_at', inicioDoMesIso())
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).reduce((resumo, item) => {
    const diferenca = Number(item.diferenca ?? 0);
    if (diferenca > 0) resumo.entradas += diferenca;
    if (diferenca < 0) resumo.saidas += Math.abs(diferenca);
    return resumo;
  }, { entradas: 0, saidas: 0 });
}

export function observarMovimentacoes(callback) {
  const canal = supabase
    .channel('movimentacoes-rpg')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'movimentacoes' }, callback)
    .subscribe();

  return () => supabase.removeChannel(canal);
}
