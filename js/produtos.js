import { supabase } from './supabase-config.js';
import { registrarMovimentacao } from './historico.js';

const CAMPOS_PRODUTO_BASE = [
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

const CAMPOS_PRODUTO_COMPLETO = [
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

let camposProdutoAtivos = CAMPOS_PRODUTO_COMPLETO;
let produtoTemCamposExtras = true;

// Garante que os dados enviados ao Supabase estejam limpos e no formato correto.
function prepararProduto(produto) {
  const valorVenda = produto.valorVenda === '' || produto.valorVenda === null || produto.valorVenda === undefined
    ? null
    : Number(produto.valorVenda);

  const produtoLimpo = {
    nome: produto.nome.trim(),
    descricao: produto.descricao.trim(),
    categoria: produto.categoria.trim(),
    cor: produto.cor.trim(),
    tamanho: produto.tamanho.trim(),
    quantidade: Number(produto.quantidade)
  };

  if (produtoTemCamposExtras) {
    produtoLimpo.subcategoria = produto.subcategoria.trim();
    produtoLimpo.valor_venda = valorVenda;
  }

  return produtoLimpo;
}

function normalizarProdutos(produtos) {
  return (produtos ?? []).map((produto) => ({
    ...produto,
    subcategoria: produto.subcategoria ?? '',
    valor_venda: produto.valor_venda ?? null
  }));
}

function erroDeCampoExtraAusente(error) {
  const mensagem = error?.message ?? '';
  return mensagem.includes('subcategoria') || mensagem.includes('valor_venda');
}

async function selecionarProdutos(campos) {
  return supabase
    .from('produtos')
    .select(campos)
    .order('nome', { ascending: true });
}

export async function listarProdutos() {
  let { data, error } = await selecionarProdutos(CAMPOS_PRODUTO_COMPLETO);

  if (error && erroDeCampoExtraAusente(error)) {
    produtoTemCamposExtras = false;
    camposProdutoAtivos = CAMPOS_PRODUTO_BASE;
    const respostaBase = await selecionarProdutos(CAMPOS_PRODUTO_BASE);
    data = respostaBase.data;
    error = respostaBase.error;
  } else {
    produtoTemCamposExtras = true;
    camposProdutoAtivos = CAMPOS_PRODUTO_COMPLETO;
  }

  if (error) {
    throw error;
  }

  return normalizarProdutos(data);
}

export async function criarProduto(produto, usuario) {
  const novoProduto = prepararProduto(produto);

  const { data, error } = await supabase
    .from('produtos')
    .insert(novoProduto)
    .select(camposProdutoAtivos)
    .single();

  if (error) {
    throw error;
  }

  const produtoCriado = normalizarProdutos([data])[0];

  await registrarMovimentacao({
    produtoId: produtoCriado.id,
    produtoNome: produtoCriado.nome,
    quantidadeAnterior: 0,
    quantidadeNova: produtoCriado.quantidade,
    tipo: 'entrada',
    usuario
  });

  return produtoCriado;
}

export async function editarProduto(produtoId, produto, produtoAnterior, usuario) {
  const produtoAtualizado = prepararProduto(produto);

  const { data, error } = await supabase
    .from('produtos')
    .update(produtoAtualizado)
    .eq('id', produtoId)
    .select(camposProdutoAtivos)
    .single();

  if (error) {
    throw error;
  }

  const produtoEditado = normalizarProdutos([data])[0];

  await registrarMovimentacao({
    produtoId: produtoEditado.id,
    produtoNome: produtoEditado.nome,
    quantidadeAnterior: Number(produtoAnterior.quantidade),
    quantidadeNova: produtoEditado.quantidade,
    tipo: 'edição',
    usuario
  });

  return produtoEditado;
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
    .select(camposProdutoAtivos)
    .single();

  if (error) {
    throw error;
  }

  const produtoAtualizado = normalizarProdutos([data])[0];

  await registrarMovimentacao({
    produtoId: produtoAtualizado.id,
    produtoNome: produtoAtualizado.nome,
    quantidadeAnterior,
    quantidadeNova,
    tipo: delta > 0 ? 'entrada' : 'saída',
    usuario
  });

  return produtoAtualizado;
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
