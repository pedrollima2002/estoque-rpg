export function normalizarTexto(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR');
}

export function normalizarBusca(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(valor ?? 0));
}

export function formatarDataHora(valor) {
  if (!valor) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(valor));
}

export function formatarData(valor) {
  if (!valor) return '';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short'
  }).format(new Date(valor));
}

export function valoresUnicos(produtos, campo) {
  return [...new Set(
    produtos
      .map((produto) => String(produto[campo] ?? '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function chaveVariacao(produto) {
  return [
    produto.nome,
    produto.categoria,
    produto.subcategoria,
    produto.cor,
    produto.tamanho
  ].map(normalizarBusca).join('|');
}

export function chaveModelo(produto) {
  return [
    produto.nome,
    produto.categoria,
    produto.subcategoria,
    produto.descricao,
    produto.valor_venda
  ].map(normalizarBusca).join('|');
}

export function inicioDoMesIso() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
}

export function escaparFiltroPostgrest(valor) {
  return String(valor ?? '').replace(/[(),.%]/g, ' ').trim();
}
