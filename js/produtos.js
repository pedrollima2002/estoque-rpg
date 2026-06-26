import { supabase } from './supabase-config.js';
import { registrarMovimentacao } from './historico.js';

const CAMPOS_PRODUTO = [
  'id',
  'nome',
  'descricao',
  'categoria',
  'cor',
  'tamanho',
  'quantidade',
  'created_at',
  'updated_at'
].join(',');

// Garante que os dados enviados ao Supabase estejam limpos e no formato correto.
function prepararProduto(produto) {
  return {
    nome: produto.nome.trim(),
    descricao: produto.descricao.trim(),
    categoria: produto.categoria.trim(),
    cor: produto.cor.trim(),
    tamanho: produto.tamanho.trim(),
    quantidade: Number(produto.quantidade)
  };
}

export async function listarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select(CAMPOS_PRODUTO)
    .order('nome', { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function criarProduto(produto, usuario) {
  const novoProduto = prepararProduto(produto);

  const { data, error } = await supabase
    .from('produtos')
    .insert(novoProduto)
    .select(CAMPOS_PRODUTO)
    .single();

  if (error) {
    throw error;
  }

  await registrarMovimentacao({
    produtoId: data.id,
    produtoNome: data.nome,
    quantidadeAnterior: 0,
    quantidadeNova: data.quantidade,
    tipo: 'entrada',
    usuario
  });

  return data;
}

export async function editarProduto(produtoId, produto, produtoAnterior, usuario) {
  const produtoAtualizado = prepararProduto(produto);

  const { data, error } = await supabase
    .from('produtos')
    .update(produtoAtualizado)
    .eq('id', produtoId)
    .select(CAMPOS_PRODUTO)
    .single();

  if (error) {
    throw error;
  }

  await registrarMovimentacao({
    produtoId: data.id,
    produtoNome: data.nome,
    quantidadeAnterior: Number(produtoAnterior.quantidade),
    quantidadeNova: data.quantidade,
    tipo: 'edição',
    usuario
  });

  return data;
}

export async function excluirProduto(produto, usuario) {
  const { error } = await supabase
    .from('produtos')
    .delete()
    .eq('id', produto.id);

  if (error) {
    throw error;
  }

  await registrarMovimentacao({
    produtoId: produto.id,
    produtoNome: produto.nome,
    quantidadeAnterior: Number(produto.quantidade),
    quantidadeNova: 0,
    tipo: 'exclusão',
    usuario
  });
}

// Aumenta ou diminui uma unidade e registra a movimentação no histórico.
export async function ajustarQuantidade(produto, delta, usuario) {
  const quantidadeAnterior = Number(produto.quantidade);
  const quantidadeNova = Math.max(0, quantidadeAnterior + delta);

  if (quantidadeNova === quantidadeAnterior) {
    return produto;
  }

  const { data, error } = await supabase
    .from('produtos')
    .update({ quantidade: quantidadeNova })
    .eq('id', produto.id)
    .select(CAMPOS_PRODUTO)
    .single();

  if (error) {
    throw error;
  }

  await registrarMovimentacao({
    produtoId: data.id,
    produtoNome: data.nome,
    quantidadeAnterior,
    quantidadeNova,
    tipo: delta > 0 ? 'entrada' : 'saída',
    usuario
  });

  return data;
}

export function observarProdutos(callback) {
  const canal = supabase
    .channel('produtos-rpg')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'produtos' },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(canal);
  };
}
