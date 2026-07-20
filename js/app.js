import { supabaseConfigurado } from './supabase-config.js';
import {
  entrarComEmailSenha,
  obterSessaoAtual,
  observarAutenticacao,
  sair
} from './auth.js';
import {
  ajustarQuantidade,
  criarProdutos,
  editarProduto,
  excluirProduto,
  listarProdutos,
  observarProdutos
} from './produtos.js';
import { listarMovimentacoes, observarMovimentacoes } from './historico.js';

const LIMITE_PRODUTOS_FORMULARIO = 10;

const estado = {
  usuario: null,
  produtos: [],
  movimentacoes: [],
  produtoEditando: null,
  salvandoFormulario: false,
  salvandoProdutos: new Set(),
  proximoFormularioId: 1,
  filtros: {
    busca: '',
    buscaSubcategoria: '',
    categoria: 'Todos',
    subcategoria: 'Todos',
    cor: 'Todos',
    tamanho: 'Todos',
    estoque: 'todos'
  },
  cancelarRealtime: [],
  timerProdutos: null,
  timerHistorico: null
};

const elementos = {
  loginView: document.querySelector('#login-view'),
  appView: document.querySelector('#app-view'),
  loginForm: document.querySelector('#login-form'),
  email: document.querySelector('#email'),
  senha: document.querySelector('#senha'),
  entrarBtn: document.querySelector('#entrar-btn'),
  sairBtn: document.querySelector('#sair-btn'),
  usuarioEmail: document.querySelector('#usuario-email'),
  configAlert: document.querySelector('#config-alert'),
  toast: document.querySelector('#toast'),
  loadingOverlay: document.querySelector('#loading-overlay'),
  tabButtons: document.querySelectorAll('.tab-button'),
  estoqueSection: document.querySelector('#estoque-section'),
  historicoSection: document.querySelector('#historico-section'),
  novoProdutoBtn: document.querySelector('#novo-produto-btn'),
  atualizarHistoricoBtn: document.querySelector('#atualizar-historico-btn'),
  busca: document.querySelector('#busca'),
  buscaSubcategoria: document.querySelector('#busca-subcategoria'),
  filtroCategoria: document.querySelector('#filtro-categoria'),
  filtroSubcategoria: document.querySelector('#filtro-subcategoria'),
  filtroCor: document.querySelector('#filtro-cor'),
  filtroTamanho: document.querySelector('#filtro-tamanho'),
  filtroEstoque: document.querySelector('#filtro-estoque'),
  produtosLista: document.querySelector('#produtos-lista'),
  produtosVazio: document.querySelector('#produtos-vazio'),
  historicoLista: document.querySelector('#historico-lista'),
  historicoVazio: document.querySelector('#historico-vazio'),
  totalPecas: document.querySelector('#total-pecas'),
  totalModelos: document.querySelector('#total-modelos'),
  produtoDialog: document.querySelector('#produto-dialog'),
  produtoForm: document.querySelector('#produto-form'),
  produtoFormTitulo: document.querySelector('#produto-form-titulo'),
  produtoId: document.querySelector('#produto-id'),
  produtosFormLista: document.querySelector('#produtos-form-lista'),
  adicionarProdutoLinhaBtn: document.querySelector('#adicionar-produto-linha-btn'),
  salvarProdutoBtn: document.querySelector('#salvar-produto-btn'),
  cancelarProdutoBtn: document.querySelector('#cancelar-produto-btn'),
  fecharModalBtn: document.querySelector('#fechar-modal-btn')
};

iniciarAplicativo();

async function iniciarAplicativo() {
  configurarEventos();

  if (!supabaseConfigurado) {
    mostrarTelaLogin();
    elementos.configAlert.hidden = false;
    elementos.configAlert.textContent = 'Configure a URL e a chave anon do Supabase em js/supabase-config.js antes de entrar.';
    elementos.entrarBtn.disabled = true;
    return;
  }

  try {
    mostrarCarregamento(true);
    const sessao = await obterSessaoAtual();
    await aplicarSessao(sessao);
    observarAutenticacao(aplicarSessao);
  } catch (erro) {
    mostrarMensagem(erro.message, 'error');
    mostrarTelaLogin();
  } finally {
    mostrarCarregamento(false);
  }
}

function configurarEventos() {
  elementos.loginForm.addEventListener('submit', aoEntrar);
  elementos.sairBtn.addEventListener('click', aoSair);
  elementos.novoProdutoBtn.addEventListener('click', abrirFormularioNovoProduto);
  elementos.produtoForm.addEventListener('submit', aoSalvarProduto);
  elementos.cancelarProdutoBtn.addEventListener('click', fecharFormularioProduto);
  elementos.fecharModalBtn.addEventListener('click', fecharFormularioProduto);
  elementos.atualizarHistoricoBtn.addEventListener('click', carregarHistorico);
  elementos.produtosLista.addEventListener('click', aoClicarProduto);
  elementos.adicionarProdutoLinhaBtn.addEventListener('click', () => adicionarLinhaProduto());
  elementos.produtosFormLista.addEventListener('click', aoClicarFormularioProdutos);
  elementos.produtosFormLista.addEventListener('focusin', aoFocarFormularioProdutos);
  elementos.produtosFormLista.addEventListener('input', aoDigitarFormularioProdutos);
  elementos.produtosFormLista.addEventListener('keydown', aoTeclarFormularioProdutos);
  elementos.produtosFormLista.addEventListener('mousedown', aoSelecionarSugestaoFormulario);

  document.addEventListener('click', (evento) => {
    if (!evento.target.closest('#produto-form')) {
      fecharSugestoesFormulario();
    }
  });

  elementos.busca.addEventListener('input', () => {
    estado.filtros.busca = elementos.busca.value;
    renderizarProdutos();
  });

  elementos.buscaSubcategoria.addEventListener('input', () => {
    estado.filtros.buscaSubcategoria = elementos.buscaSubcategoria.value;
    renderizarProdutos();
  });

  [
    [elementos.filtroCategoria, 'categoria'],
    [elementos.filtroSubcategoria, 'subcategoria'],
    [elementos.filtroCor, 'cor'],
    [elementos.filtroTamanho, 'tamanho'],
    [elementos.filtroEstoque, 'estoque']
  ].forEach(([elemento, chave]) => {
    elemento.addEventListener('change', () => {
      estado.filtros[chave] = elemento.value;
      renderizarProdutos();
    });
  });

  elementos.tabButtons.forEach((botao) => {
    botao.addEventListener('click', () => trocarAba(botao.dataset.tab));
  });
}

async function aoEntrar(evento) {
  evento.preventDefault();
  const email = elementos.email.value.trim();
  const senha = elementos.senha.value;

  if (!email || !senha) {
    mostrarMensagem('Informe e-mail e senha.', 'error');
    return;
  }

  try {
    elementos.entrarBtn.disabled = true;
    mostrarCarregamento(true);
    const sessao = await entrarComEmailSenha(email, senha);
    await aplicarSessao(sessao);
    elementos.loginForm.reset();
    mostrarMensagem('Login realizado com sucesso.', 'success');
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    elementos.entrarBtn.disabled = false;
    mostrarCarregamento(false);
  }
}

async function aoSair() {
  try {
    elementos.sairBtn.disabled = true;
    await sair();
    await aplicarSessao(null);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    elementos.sairBtn.disabled = false;
  }
}

async function aplicarSessao(sessao) {
  if (!sessao?.user) {
    estado.usuario = null;
    estado.produtos = [];
    estado.movimentacoes = [];
    pararRealtime();
    mostrarTelaLogin();
    return;
  }

  estado.usuario = sessao.user;
  elementos.usuarioEmail.textContent = estado.usuario.email;
  mostrarTelaApp();
  await Promise.all([carregarProdutos(), carregarHistorico()]);
  iniciarRealtime();
}

function mostrarTelaLogin() {
  elementos.loginView.hidden = false;
  elementos.appView.hidden = true;
}

function mostrarTelaApp() {
  elementos.loginView.hidden = true;
  elementos.appView.hidden = false;
}

async function carregarProdutos() {
  try {
    estado.produtos = await listarProdutos();
    estado.produtos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    atualizarFiltros();
    atualizarSugestoesFormulario();
    renderizarResumo();
    renderizarProdutos();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

async function carregarHistorico() {
  try {
    estado.movimentacoes = await listarMovimentacoes();
    renderizarHistorico();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

function renderizarResumo() {
  const totalPecas = estado.produtos.reduce((soma, produto) => soma + Number(produto.quantidade), 0);
  elementos.totalPecas.textContent = totalPecas;
  elementos.totalModelos.textContent = estado.produtos.length;
}

function atualizarFiltros() {
  estado.filtros.categoria = preencherFiltro(elementos.filtroCategoria, valoresUnicos('categoria'), estado.filtros.categoria);
  estado.filtros.subcategoria = preencherFiltro(elementos.filtroSubcategoria, valoresUnicos('subcategoria'), estado.filtros.subcategoria);
  estado.filtros.cor = preencherFiltro(elementos.filtroCor, valoresUnicos('cor'), estado.filtros.cor);
  estado.filtros.tamanho = preencherFiltro(elementos.filtroTamanho, valoresUnicos('tamanho'), estado.filtros.tamanho);
  elementos.filtroEstoque.value = estado.filtros.estoque;
}

function valoresUnicos(campo) {
  return [...new Set(
    estado.produtos
      .map((produto) => produto[campo]?.trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function preencherFiltro(select, opcoes, valorAtual) {
  const valorAindaExiste = valorAtual === 'Todos' || opcoes.includes(valorAtual);
  const valorSelecionado = valorAindaExiste ? valorAtual : 'Todos';
  let html = '<option value="Todos">Todos</option>';

  opcoes.forEach((opcao) => {
    html += '<option value="' + escaparHtml(opcao) + '">' + escaparHtml(opcao) + '</option>';
  });

  select.innerHTML = html;
  select.value = valorSelecionado;
  return valorSelecionado;
}

function renderizarProdutos() {
  const produtosFiltrados = filtrarProdutos();
  elementos.produtosVazio.hidden = produtosFiltrados.length > 0;
  elementos.produtosLista.innerHTML = produtosFiltrados.map(montarCartaoProduto).join('');
}

function filtrarProdutos() {
  const termo = normalizarBusca(estado.filtros.busca);
  const termoSubcategoria = normalizarBusca(estado.filtros.buscaSubcategoria);

  return estado.produtos.filter((produto) => {
    const nomeCombina = normalizarBusca(produto.nome).includes(termo);
    const categoriaCombina = estado.filtros.categoria === 'Todos' || produto.categoria === estado.filtros.categoria;
    const subcategoriaCombina = estado.filtros.subcategoria === 'Todos' || produto.subcategoria === estado.filtros.subcategoria;
    const buscaSubcategoriaCombina = normalizarBusca(produto.subcategoria).includes(termoSubcategoria);
    const corCombina = estado.filtros.cor === 'Todos' || produto.cor === estado.filtros.cor;
    const tamanhoCombina = estado.filtros.tamanho === 'Todos' || produto.tamanho === estado.filtros.tamanho;
    const estoqueCombina = filtrarPorEstoque(produto);

    return nomeCombina && categoriaCombina && subcategoriaCombina && buscaSubcategoriaCombina && corCombina && tamanhoCombina && estoqueCombina;
  });
}

function filtrarPorEstoque(produto) {
  const quantidade = Number(produto.quantidade);

  if (estado.filtros.estoque === 'baixo') {
    return quantidade >= 1 && quantidade <= 3;
  }

  if (estado.filtros.estoque === 'zerado') {
    return quantidade === 0;
  }

  return true;
}

function montarCartaoProduto(produto) {
  const status = obterStatusEstoque(produto.quantidade);
  const desabilitado = estado.salvandoProdutos.has(produto.id) ? ' disabled' : '';
  const quantidade = Number(produto.quantidade);
  const descricao = produto.descricao || '';
  let html = '';

  html += '<article class="product-card ' + status.classe + '" data-id="' + escaparHtml(produto.id) + '">';
  html += '<button class="quantity-button minus" type="button" data-action="diminuir" data-id="' + escaparHtml(produto.id) + '" aria-label="Diminuir ' + escaparHtml(produto.nome) + '"' + desabilitado + '>−</button>';
  html += '<div class="product-main">';
  html += '<div class="card-top">';
  html += '<div>';
  html += '<h3>' + escaparHtml(produto.nome) + '</h3>';
  html += descricao ? '<p class="description">' + escaparHtml(descricao) + '</p>' : '';
  html += produto.valor_venda !== null && produto.valor_venda !== undefined ? '<p class="price-line">Venda: <strong>' + formatarMoeda(produto.valor_venda) + '</strong></p>' : '';
  html += '</div>';
  html += '<details class="card-menu">';
  html += '<summary aria-label="Opções do produto">⋯</summary>';
  html += '<div class="menu-content">';
  html += '<button type="button" data-action="editar" data-id="' + escaparHtml(produto.id) + '">Editar produto</button>';
  html += '<button type="button" data-action="excluir" data-id="' + escaparHtml(produto.id) + '">Excluir produto</button>';
  html += '</div>';
  html += '</details>';
  html += '</div>';
  html += '<div class="tags">';
  html += montarTag(produto.categoria);
  html += produto.subcategoria ? montarTag(produto.subcategoria) : '';
  html += montarTag(produto.cor);
  html += produto.tamanho ? montarTag(produto.tamanho) : '';
  html += '</div>';
  html += '<p class="stock-line">';
  html += '<strong>' + quantidade + '</strong>';
  html += '<span>' + (quantidade === 1 ? 'unidade' : 'unidades') + '</span>';
  html += '<span class="status-badge ' + status.classe + '">' + status.texto + '</span>';
  html += '</p>';
  html += '</div>';
  html += '<button class="quantity-button plus" type="button" data-action="aumentar" data-id="' + escaparHtml(produto.id) + '" aria-label="Aumentar ' + escaparHtml(produto.nome) + '"' + desabilitado + '>+</button>';
  html += '</article>';

  return html;
}

function montarTag(valor) {
  return '<span class="tag">' + escaparHtml(valor || 'Não informado') + '</span>';
}

function obterStatusEstoque(quantidadeValor) {
  const quantidade = Number(quantidadeValor);

  if (quantidade === 0) {
    return { classe: 'empty', texto: 'Sem estoque' };
  }

  if (quantidade <= 3) {
    return { classe: 'low', texto: 'Estoque baixo' };
  }

  return { classe: 'normal', texto: 'Normal' };
}

async function aoClicarProduto(evento) {
  const botao = evento.target.closest('button[data-action]');

  if (!botao) {
    return;
  }

  const produto = encontrarProduto(botao.dataset.id);

  if (!produto) {
    return;
  }

  if (botao.dataset.action === 'aumentar') {
    await alterarQuantidade(produto, 1);
  }

  if (botao.dataset.action === 'diminuir') {
    if (Number(produto.quantidade) === 1) {
      const confirmar = confirm('Este produto ficará sem estoque. Deseja continuar?');
      if (!confirmar) {
        return;
      }
    }
    await alterarQuantidade(produto, -1);
  }

  if (botao.dataset.action === 'editar') {
    abrirFormularioEditarProduto(produto);
  }

  if (botao.dataset.action === 'excluir') {
    await confirmarExclusao(produto);
  }
}

async function alterarQuantidade(produto, delta) {
  if (estado.salvandoProdutos.has(produto.id)) {
    return;
  }

  try {
    estado.salvandoProdutos.add(produto.id);
    renderizarProdutos();
    await ajustarQuantidade(produto, delta, estado.usuario);
    await carregarProdutos();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    estado.salvandoProdutos.delete(produto.id);
    renderizarProdutos();
  }
}

function abrirFormularioNovoProduto() {
  estado.produtoEditando = null;
  elementos.produtoFormTitulo.textContent = 'Novo produto';
  elementos.produtoId.value = '';
  limparLinhasProduto();
  adicionarLinhaProduto({ quantidade: 0 }, false);
  definirFormularioSalvando(false);
  abrirDialogProduto();
}

function abrirFormularioEditarProduto(produto) {
  estado.produtoEditando = produto;
  elementos.produtoFormTitulo.textContent = 'Editar produto';
  elementos.produtoId.value = produto.id;
  limparLinhasProduto();
  adicionarLinhaProduto({
    nome: produto.nome,
    descricao: produto.descricao ?? '',
    subcategoria: produto.subcategoria ?? '',
    categoria: produto.categoria ?? '',
    cor: produto.cor ?? '',
    tamanho: produto.tamanho ?? '',
    quantidade: produto.quantidade,
    valorVenda: produto.valor_venda ?? ''
  }, false, true);
  definirFormularioSalvando(false);
  abrirDialogProduto();
}

function abrirDialogProduto() {
  if (typeof elementos.produtoDialog.showModal === 'function') {
    elementos.produtoDialog.showModal();
  } else {
    elementos.produtoDialog.hidden = false;
  }

  const primeiroCampo = elementos.produtosFormLista.querySelector('[data-field="nome"]');
  primeiroCampo?.focus();
}

function fecharFormularioProduto() {
  fecharSugestoesFormulario();

  if (elementos.produtoDialog.open) {
    elementos.produtoDialog.close();
  } else {
    elementos.produtoDialog.hidden = true;
  }
}

function limparLinhasProduto() {
  elementos.produtosFormLista.innerHTML = '';
  estado.proximoFormularioId = 1;
}

function adicionarLinhaProduto(valores = {}, focar = true, forcar = false) {
  if (!forcar && (estado.produtoEditando || obterLinhasProdutoFormulario().length >= LIMITE_PRODUTOS_FORMULARIO)) {
    return;
  }

  elementos.produtosFormLista.insertAdjacentHTML('beforeend', montarLinhaProduto(valores));
  atualizarNumeracaoLinhasProduto();
  atualizarBotaoAdicionarLinha();

  if (focar) {
    const linhas = obterLinhasProdutoFormulario();
    linhas[linhas.length - 1]?.querySelector('[data-field="nome"]')?.focus();
  }
}

function montarLinhaProduto(valores = {}) {
  const rowId = estado.proximoFormularioId++;

  let html = '';
  html += '<article class="product-form-card" data-product-row>';
  html += '<div class="product-form-header">';
  html += '<h3>Produto</h3>';
  html += '<button class="ghost-button remove-row-button" type="button" data-action="remover-linha">Remover produto</button>';
  html += '</div>';
  html += '<div class="form-grid">';
  html += montarCampoTexto(rowId, 'nome', 'Nome do produto', valores.nome, 120, false, true);
  html += montarCampoTexto(rowId, 'descricao', 'Descrição ou variação', valores.descricao, 160);
  html += montarCampoTexto(rowId, 'subcategoria', 'Subcategoria', valores.subcategoria, 80, true);
  html += montarCampoTexto(rowId, 'categoria', 'Categoria', valores.categoria, 80, true, true);
  html += montarCampoTexto(rowId, 'cor', 'Cor', valores.cor, 80, true, true);
  html += montarCampoTexto(rowId, 'tamanho', 'Tamanho', valores.tamanho, 40, true);
  html += montarCampoNumero(rowId, 'quantidade', 'Quantidade', valores.quantidade ?? 0, '1', true);
  html += montarCampoNumero(rowId, 'valorVenda', 'Valor de venda', valores.valorVenda ?? valores.valor_venda ?? '', '0.01', false);
  html += '</div>';
  html += '<p class="row-error" aria-live="polite" hidden></p>';
  html += '</article>';

  return html;
}

function montarCampoTexto(rowId, campo, rotulo, valor = '', maxLength, autocomplete = false, obrigatorio = false) {
  const id = 'produto-' + rowId + '-' + campo;
  const classeLabel = autocomplete ? ' class="autocomplete-field"' : '';
  const autocompleteCampo = autocomplete ? ' data-autocomplete-field="' + escaparAtributo(campo) + '"' : '';
  const ariaObrigatorio = obrigatorio ? ' aria-required="true"' : '';
  const sugestoes = autocomplete ? '<div class="suggestions-list" hidden></div>' : '';

  return (
    '<label' + classeLabel + ' for="' + escaparAtributo(id) + '">' +
      '<span>' + escaparHtml(rotulo) + '</span>' +
      '<input id="' + escaparAtributo(id) + '" class="produto-input" data-field="' + escaparAtributo(campo) + '" type="text" maxlength="' + maxLength + '" value="' + escaparAtributo(valor) + '" autocomplete="off"' + autocompleteCampo + ariaObrigatorio + '>' +
      sugestoes +
    '</label>'
  );
}

function montarCampoNumero(rowId, campo, rotulo, valor = '', step = '1', obrigatorio = false) {
  const id = 'produto-' + rowId + '-' + campo;
  const inputmode = step === '0.01' ? ' inputmode="decimal"' : '';
  const ariaObrigatorio = obrigatorio ? ' aria-required="true"' : '';

  return (
    '<label for="' + escaparAtributo(id) + '">' +
      '<span>' + escaparHtml(rotulo) + '</span>' +
      '<input id="' + escaparAtributo(id) + '" class="produto-input" data-field="' + escaparAtributo(campo) + '" type="number" min="0" step="' + escaparAtributo(step) + '" value="' + escaparAtributo(valor) + '"' + inputmode + ariaObrigatorio + '>' +
    '</label>'
  );
}

function atualizarNumeracaoLinhasProduto() {
  const editando = Boolean(estado.produtoEditando);

  obterLinhasProdutoFormulario().forEach((linha, indice) => {
    linha.dataset.index = String(indice + 1);
    linha.querySelector('.product-form-header h3').textContent = 'Produto ' + (indice + 1);

    const removerBtn = linha.querySelector('[data-action="remover-linha"]');
    removerBtn.hidden = editando || indice === 0;
  });
}

function atualizarBotaoAdicionarLinha() {
  const totalLinhas = obterLinhasProdutoFormulario().length;
  const chegouNoLimite = totalLinhas >= LIMITE_PRODUTOS_FORMULARIO;

  elementos.adicionarProdutoLinhaBtn.hidden = Boolean(estado.produtoEditando);
  elementos.adicionarProdutoLinhaBtn.disabled = estado.salvandoFormulario || chegouNoLimite;
  elementos.adicionarProdutoLinhaBtn.textContent = chegouNoLimite ? 'Limite de 10 produtos' : '+ Adicionar outro produto';
}

function obterLinhasProdutoFormulario() {
  return Array.from(elementos.produtosFormLista.querySelectorAll('[data-product-row]'));
}

function aoClicarFormularioProdutos(evento) {
  const removerBtn = evento.target.closest('[data-action="remover-linha"]');

  if (removerBtn) {
    removerLinhaProduto(removerBtn.closest('[data-product-row]'));
    return;
  }

  const campoAutocomplete = evento.target.closest('input[data-autocomplete-field]');
  if (campoAutocomplete) {
    mostrarSugestoesCampo(campoAutocomplete, false);
  }
}

function aoFocarFormularioProdutos(evento) {
  const campoAutocomplete = evento.target.closest('input[data-autocomplete-field]');
  if (campoAutocomplete) {
    mostrarSugestoesCampo(campoAutocomplete, false);
  }
}

function aoDigitarFormularioProdutos(evento) {
  const linha = evento.target.closest('[data-product-row]');
  if (linha) {
    limparErroLinha(linha);
    evento.target.removeAttribute('aria-invalid');
  }

  const campoAutocomplete = evento.target.closest('input[data-autocomplete-field]');
  if (campoAutocomplete) {
    mostrarSugestoesCampo(campoAutocomplete, true);
  }
}

function aoTeclarFormularioProdutos(evento) {
  if (evento.key === 'Escape') {
    fecharSugestoesFormulario();
  }
}

function aoSelecionarSugestaoFormulario(evento) {
  const botao = evento.target.closest('button[data-suggestion-value]');

  if (!botao) {
    return;
  }

  evento.preventDefault();
  const campo = botao.closest('.autocomplete-field')?.querySelector('input[data-autocomplete-field]');

  if (!campo) {
    return;
  }

  campo.value = botao.dataset.suggestionValue;
  limparErroLinha(campo.closest('[data-product-row]'));
  fecharSugestoesFormulario();
  campo.focus();
}

function removerLinhaProduto(linha) {
  if (!linha || estado.produtoEditando || obterLinhasProdutoFormulario().length <= 1) {
    return;
  }

  linha.remove();
  atualizarNumeracaoLinhasProduto();
  atualizarBotaoAdicionarLinha();
}

function atualizarSugestoesFormulario() {
  elementos.produtosFormLista
    .querySelectorAll('input[data-autocomplete-field]')
    .forEach((input) => renderizarSugestoesCampo(input, ''));
}

function mostrarSugestoesCampo(input, filtrarPorTexto) {
  const lista = renderizarSugestoesCampo(input, filtrarPorTexto ? input.value : '');
  fecharSugestoesFormulario(lista);
  lista.hidden = lista.children.length === 0;
}

function renderizarSugestoesCampo(input, textoFiltro) {
  const lista = input.closest('.autocomplete-field')?.querySelector('.suggestions-list');

  if (!lista) {
    return null;
  }

  const campo = input.dataset.autocompleteField;
  const termo = normalizarBusca(textoFiltro);
  const opcoes = valoresUnicos(campo)
    .filter((opcao) => !termo || normalizarBusca(opcao).includes(termo))
    .slice(0, 80);

  lista.innerHTML = opcoes
    .map((opcao) => '<button type="button" data-suggestion-value="' + escaparAtributo(opcao) + '">' + escaparHtml(opcao) + '</button>')
    .join('');

  return lista;
}

function fecharSugestoesFormulario(listaMantida = null) {
  elementos.produtosFormLista.querySelectorAll('.suggestions-list').forEach((lista) => {
    if (lista !== listaMantida) {
      lista.hidden = true;
    }
  });
}

async function aoSalvarProduto(evento) {
  evento.preventDefault();

  if (estado.salvandoFormulario) {
    return;
  }

  const produtos = lerProdutosDoFormulario();

  if (!produtos) {
    return;
  }

  try {
    definirFormularioSalvando(true);

    if (estado.produtoEditando) {
      await editarProduto(estado.produtoEditando.id, produtos[0], estado.produtoEditando, estado.usuario);
      mostrarMensagem('Produto editado com sucesso.', 'success');
    } else {
      const produtosCriados = await criarProdutos(produtos, estado.usuario);
      mostrarMensagem(montarMensagemCadastroSucesso(produtosCriados.length), 'success');
    }

    fecharFormularioProduto();
    await carregarProdutos();
    await carregarHistorico();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    definirFormularioSalvando(false);
  }
}

function definirFormularioSalvando(salvando) {
  estado.salvandoFormulario = salvando;
  elementos.salvarProdutoBtn.disabled = salvando;
  elementos.salvarProdutoBtn.textContent = obterTextoBotaoSalvar(salvando);
  atualizarBotaoAdicionarLinha();
}

function obterTextoBotaoSalvar(salvando = false) {
  if (salvando) {
    return estado.produtoEditando ? 'Salvando...' : 'Cadastrando...';
  }

  return estado.produtoEditando ? 'Salvar' : 'Cadastrar produtos';
}

function montarMensagemCadastroSucesso(total) {
  return total === 1
    ? '1 PRODUTO CADASTRADO COM SUCESSO!'
    : total + ' PRODUTOS CADASTRADOS COM SUCESSO!';
}

function lerProdutosDoFormulario() {
  limparErrosFormulario();

  const linhas = obterLinhasProdutoFormulario();
  const produtos = [];

  for (let indice = 0; indice < linhas.length; indice += 1) {
    const linha = linhas[indice];
    const dados = lerDadosLinha(linha);
    const numeroProduto = indice + 1;

    if (!estado.produtoEditando && linhaEstaVazia(dados)) {
      continue;
    }

    const resultado = validarDadosLinha(dados, numeroProduto);

    if (resultado.erro) {
      mostrarErroLinha(linha, resultado.erro, resultado.campo);
      return null;
    }

    produtos.push(resultado.produto);
  }

  if (produtos.length === 0) {
    const primeiraLinha = linhas[0];
    mostrarErroLinha(primeiraLinha, 'O PRODUTO 1 ESTÁ INCOMPLETO. PREENCHA OS CAMPOS OBRIGATÓRIOS.', 'nome');
    return null;
  }

  return produtos;
}

function lerDadosLinha(linha) {
  const dados = {};

  linha.querySelectorAll('[data-field]').forEach((campo) => {
    dados[campo.dataset.field] = campo.value;
  });

  return dados;
}

function linhaEstaVazia(dados) {
  const textosVazios = [
    dados.nome,
    dados.descricao,
    dados.subcategoria,
    dados.categoria,
    dados.cor,
    dados.tamanho,
    dados.valorVenda
  ].every((valor) => limparTextoFormulario(valor) === '');

  const quantidade = limparTextoFormulario(dados.quantidade);
  const quantidadeVazia = quantidade === '' || quantidade === '0';

  return textosVazios && quantidadeVazia;
}

function validarDadosLinha(dados, numeroProduto) {
  const nome = limparTextoFormulario(dados.nome);
  const categoria = limparTextoFormulario(dados.categoria);
  const cor = limparTextoFormulario(dados.cor);
  const quantidadeTexto = limparTextoFormulario(dados.quantidade);
  const valorVendaTexto = limparTextoFormulario(dados.valorVenda);

  const camposFaltando = [];

  if (!nome) camposFaltando.push({ campo: 'nome', rotulo: 'NOME DO PRODUTO' });
  if (!categoria) camposFaltando.push({ campo: 'categoria', rotulo: 'CATEGORIA' });
  if (!cor) camposFaltando.push({ campo: 'cor', rotulo: 'COR' });
  if (!quantidadeTexto) camposFaltando.push({ campo: 'quantidade', rotulo: 'QUANTIDADE' });

  if (camposFaltando.length > 0) {
    return {
      erro: 'O PRODUTO ' + numeroProduto + ' ESTÁ INCOMPLETO. PREENCHA: ' + camposFaltando.map((campo) => campo.rotulo).join(', ') + '.',
      campo: camposFaltando[0].campo
    };
  }

  const quantidade = Number(quantidadeTexto);

  if (!Number.isInteger(quantidade) || quantidade < 0) {
    return {
      erro: 'O PRODUTO ' + numeroProduto + ' TEM QUANTIDADE INVÁLIDA. USE UM NÚMERO INTEIRO MAIOR OU IGUAL A ZERO.',
      campo: 'quantidade'
    };
  }

  const valorVenda = valorVendaTexto === '' ? '' : Number(valorVendaTexto);

  if (valorVenda !== '' && (Number.isNaN(valorVenda) || valorVenda < 0)) {
    return {
      erro: 'O PRODUTO ' + numeroProduto + ' TEM VALOR DE VENDA INVÁLIDO. USE UM VALOR MAIOR OU IGUAL A ZERO.',
      campo: 'valorVenda'
    };
  }

  return {
    produto: {
      nome,
      descricao: limparTextoFormulario(dados.descricao),
      subcategoria: obterValorFormulario('subcategoria', dados.subcategoria),
      categoria: obterValorFormulario('categoria', dados.categoria),
      cor: obterValorFormulario('cor', dados.cor),
      tamanho: obterValorFormulario('tamanho', dados.tamanho),
      quantidade,
      valorVenda
    }
  };
}

function mostrarErroLinha(linha, mensagem, campo) {
  if (!linha) {
    mostrarMensagem(mensagem, 'error');
    return;
  }

  linha.classList.add('has-error');

  const aviso = linha.querySelector('.row-error');
  aviso.textContent = mensagem;
  aviso.hidden = false;

  const campoComErro = linha.querySelector('[data-field="' + campo + '"]');
  campoComErro?.setAttribute('aria-invalid', 'true');
  campoComErro?.focus();
  linha.scrollIntoView({ behavior: 'smooth', block: 'center' });
  mostrarMensagem(mensagem, 'error');
}

function limparErrosFormulario() {
  obterLinhasProdutoFormulario().forEach((linha) => limparErroLinha(linha));
}

function limparErroLinha(linha) {
  if (!linha) {
    return;
  }

  linha.classList.remove('has-error');
  linha.querySelectorAll('[aria-invalid="true"]').forEach((campo) => campo.removeAttribute('aria-invalid'));

  const aviso = linha.querySelector('.row-error');
  if (aviso) {
    aviso.textContent = '';
    aviso.hidden = true;
  }
}

function obterValorFormulario(campo, valor) {
  const valorLimpo = limparTextoFormulario(valor);
  const valorNormalizado = normalizarBusca(valorLimpo);

  if (!valorNormalizado) {
    return '';
  }

  const valorExistente = valoresUnicos(campo).find((opcao) => normalizarBusca(opcao) === valorNormalizado);
  return valorExistente ?? valorLimpo;
}

function limparTextoFormulario(valor) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ');
}

async function confirmarExclusao(produto) {
  const confirmar = confirm('Tem certeza de que deseja excluir este produto?');

  if (!confirmar) {
    return;
  }

  try {
    estado.salvandoProdutos.add(produto.id);
    renderizarProdutos();
    await excluirProduto(produto, estado.usuario);
    mostrarMensagem('Produto excluído com sucesso.', 'success');
    await carregarProdutos();
    await carregarHistorico();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    estado.salvandoProdutos.delete(produto.id);
    renderizarProdutos();
  }
}

function renderizarHistorico() {
  elementos.historicoVazio.hidden = estado.movimentacoes.length > 0;
  elementos.historicoLista.innerHTML = estado.movimentacoes.map(montarItemHistorico).join('');
}

function montarItemHistorico(item) {
  let html = '';
  html += '<article class="history-item">';
  html += '<div>';
  html += '<strong>' + escaparHtml(item.produto_nome) + '</strong>: ';
  html += 'quantidade alterada de ' + Number(item.quantidade_anterior) + ' para ' + Number(item.quantidade_nova);
  html += ' por ' + escaparHtml(item.usuario_email || 'usuário autenticado');
  html += ' em ' + formatarData(item.created_at) + '.';
  html += '</div>';
  html += '<div class="history-meta">Tipo: ' + escaparHtml(item.tipo) + '</div>';
  html += '</article>';
  return html;
}

function trocarAba(aba) {
  const historicoAtivo = aba === 'historico';
  elementos.estoqueSection.hidden = historicoAtivo;
  elementos.historicoSection.hidden = !historicoAtivo;

  elementos.tabButtons.forEach((botao) => {
    botao.classList.toggle('active', botao.dataset.tab === aba);
  });

  if (historicoAtivo) {
    carregarHistorico();
  }
}

function iniciarRealtime() {
  pararRealtime();

  estado.cancelarRealtime = [
    observarProdutos(() => agendarCarregamentoProdutos()),
    observarMovimentacoes(() => agendarCarregamentoHistorico())
  ];
}

function pararRealtime() {
  estado.cancelarRealtime.forEach((cancelar) => cancelar());
  estado.cancelarRealtime = [];
  clearTimeout(estado.timerProdutos);
  clearTimeout(estado.timerHistorico);
}

function agendarCarregamentoProdutos() {
  clearTimeout(estado.timerProdutos);
  estado.timerProdutos = setTimeout(carregarProdutos, 250);
}

function agendarCarregamentoHistorico() {
  clearTimeout(estado.timerHistorico);
  estado.timerHistorico = setTimeout(carregarHistorico, 250);
}

function encontrarProduto(id) {
  return estado.produtos.find((produto) => produto.id === id);
}

function mostrarCarregamento(visivel) {
  elementos.loadingOverlay.hidden = !visivel;
}

function mostrarMensagem(mensagem, tipo = 'info') {
  elementos.toast.textContent = mensagem;
  elementos.toast.className = 'toast show ' + tipo;

  window.clearTimeout(mostrarMensagem.timer);
  mostrarMensagem.timer = window.setTimeout(() => {
    elementos.toast.className = 'toast';
  }, 3400);
}

function traduzirErro(erro) {
  const mensagem = erro?.message ?? String(erro);

  if (mensagem.includes('Invalid login credentials')) {
    return 'E-mail ou senha inválidos.';
  }

  if (mensagem.includes('Failed to fetch')) {
    return 'Não foi possível conectar ao Supabase. Verifique a URL, a chave anon e as configurações de domínio.';
  }

  return mensagem;
}

function normalizarBusca(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escaparAtributo(valor) {
  return escaparHtml(valor);
}

function formatarData(dataIso) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(dataIso));
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(valor));
}
