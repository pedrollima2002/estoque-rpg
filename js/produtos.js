import { supabase } from './supabase-config.js';
import { normalizarTexto } from './utils.js';

const CAMPOS_COMPLETOS = [
  'id',
  'nome',
  'descricao',
  'subcategoria',
  'categoria',
  'cor',
  'tamanho',
  'quantidade',
  'valor_venda',
  'estoque_minimo',
  'ativo',
  'arquivado_em',
  'created_at',
  'updated_at'
].join(',');

const CAMPOS_ANTIGOS = [
  'id',
  'nome',
  'descricao',
  'subcategoria',
  'categoria',
  'cor',
  'tamanho',
  'quantidade',
  'valor_venda',
  'created_at',
  'updated_at'
].join(',');

function normalizarProduto(produto) {
  return {
    ...produto,
    descricao: produto.descricao ?? '',
    subcategoria: produto.subcategoria ?? '',
    tamanho: produto.tamanho ?? '',
    valor_venda: produto.valor_venda ?? null,
    estoque_minimo: Number(produto.estoque_minimo ?? 3),
    ativo: produto.ativo ?? true,
    arquivado_em: produto.arquivado_em ?? null,
    quantidade: Number(produto.quantidade ?? 0)
  };
}

function prepararVariacao(produto) {
  const valor = produto.valorVenda ?? produto.valor_venda;

  return {
    nome: normalizarTexto(produto.nome),
    descricao: normalizarTexto(produto.descricao),
    subcategoria: normalizarTexto(produto.subcategoria),
    categoria: normalizarTexto(produto.categoria),
    cor: normalizarTexto(produto.cor),
    tamanho: normalizarTexto(produto.tamanho),
    quantidade: Number(produto.quantidade),
    valor_venda: valor === '' || valor === null || valor === undefined ? null : Number(valor),
    estoque_minimo: Number(produto.estoqueMinimo ?? produto.estoque_minimo ?? 3)
  };
}

export async function listarProdutos() {
  let resposta = await supabase
    .from('produtos')
    .select(CAMPOS_COMPLETOS)
    .order('nome', { ascending: true });

  if (resposta.error && /estoque_minimo|ativo|arquivado_em/.test(resposta.error.message ?? '')) {
    resposta = await supabase
      .from('produtos')
      .select(CAMPOS_ANTIGOS)
      .order('nome', { ascending: true });
  }

  if (resposta.error) throw resposta.error;
  return (resposta.data ?? []).map(normalizarProduto);
}

export async function cadastrarVariacoes(variacoes, somarDuplicados = false) {
  const { data, error } = await supabase.rpc('cadastrar_variacoes', {
    p_variacoes: variacoes.map(prepararVariacao),
    p_somar_duplicados: somarDuplicados
  });

  if (error) throw error;
  return data ?? { status: 'sucesso', criados: 0, atualizados: 0, duplicados: [] };
}

export async function criarProdutos(produtos, somarDuplicados = false) {
  return cadastrarVariacoes(produtos, somarDuplicados);
}

export async function editarProduto(produtoId, produto) {
  const produtoLimpo = prepararVariacao({
    ...produto,
    quantidade: 0
  });

  delete produtoLimpo.quantidade;

  const { data, error } = await supabase.rpc('editar_produto', {
    p_produto_id: produtoId,
    p_dados: produtoLimpo
  });

  if (error) throw error;
  return normalizarProduto(data);
}

export async function definirProdutoArquivado(produtoId, arquivar) {
  const { data, error } = await supabase.rpc('definir_produto_arquivado', {
    p_produto_id: produtoId,
    p_arquivar: arquivar
  });

  if (error) throw error;
  return normalizarProduto(data);
}

export async function excluirProdutoPermanentemente(produtoId) {
  const { error } = await supabase.rpc('excluir_produto_permanentemente', {
    p_produto_id: produtoId
  });

  if (error) throw error;
}

export function observarProdutos(callback) {
  const canal = supabase
    .channel('produtos-rpg')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, callback)
    .subscribe();

  return () => supabase.removeChannel(canal);
}
