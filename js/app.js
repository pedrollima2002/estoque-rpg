import { supabaseConfigurado } from './supabase-config.js';
import {
  entrarComEmailSenha,
  obterSessaoAtual,
  observarAutenticacao,
  sair
} from './auth.js';
import {
  ajustarQuantidade,
  criarProduto,
  editarProduto,
  excluirProduto,
  listarProdutos,
  observarProdutos
} from './produtos.js';
import { listarMovimentacoes, observarMovimentacoes } from './historico.js';

const estado = {
  usuario: null,
  produtos: [],
  movimentacoes: [],
  produtoEditando: null,
  salvandoProdutos: new Set(),
  filtros: {
    busca: '',
    categoria: 'Todos',
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
  filtroCategoria: document.querySelector('#filtro-categoria'),
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
  produtoNome: document.querySelector('#produto-nome'),
  produtoDescricao: document.querySelector('#produto-descricao'),
  produtoCategoria: document.querySelector('#produto-categoria'),
  produtoCor: document.querySelector('#produto-cor'),
  produtoTamanho: document.querySelector('#produto-tamanho'),
  produtoQuantidade: document.querySelector('#produto-quantidade'),
  salvarProdutoBtn: document.querySelector('#salvar-produto-btn'),
  cancelarProdutoBtn: document.querySelector('#cancelar-produto-btn'),
  fecharModalBtn: document.querySelector('#fechar-modal-btn')
};

iniciarAplicativo();

async function iniciarAplicativo() {
  configurarEventos();

  // Sem URL/chave do Supabase, o app não tenta autenticar nem mostrar o estoque.
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

  elementos.busca.addEventListener('input', () => {
    estado.filtros.busca = elementos.busca.value;
    renderizarProdutos();
  });

  [
    [elementos.filtroCategoria, 'categoria'],
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
  preencherFiltro(elementos.filtroCategoria, valoresUnicos('categoria'), estado.filtros.categoria);
  preencherFiltro(elementos.filtroCor, valoresUnicos('cor'), estado.filtros.cor);
  preencherFiltro(elementos.filtroTamanho, valoresUnicos('tamanho'), estado.filtros.tamanho);
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
}

function renderizarProdutos() {
  const produtosFiltrados = filtrarProdutos();
  elementos.produtosVazio.hidden = produtosFiltrados.length > 0;
  elementos.produtosLista.innerHTML = produtosFiltrados.map(montarCartaoProduto).join('');
}

function filtrarProdutos() {
  const termo = normalizarTexto(estado.filtros.busca);

  return estado.produtos.filter((produto) => {
    const nomeCombina = normalizarTexto(produto.nome).includes(termo);
    const categoriaCombina = estado.filtros.categoria === 'Todos' || produto.categoria === estado.filtros.categoria;
    const corCombina = estado.filtros.cor === 'Todos' || produto.cor === estado.filtros.cor;
    const tamanhoCombina = estado.filtros.tamanho === 'Todos' || produto.tamanho === estado.filtros.tamanho;
    const estoqueCombina = filtrarPorEstoque(produto);

    return nomeCombina && categoriaCombina && corCombina && tamanhoCombina && estoqueCombina;
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
  const descricao = produto.descricao || 'Sem descrição';
  let html = '';

  html += '<article class="product-card ' + status.classe + '" data-id="' + escaparHtml(produto.id) + '">';
  html += '<button class="quantity-button minus" type="button" data-action="diminuir" data-id="' + escaparHtml(produto.id) + '" aria-label="Diminuir ' + escaparHtml(produto.nome) + '"' + desabilitado + '>−</button>';
  html += '<div class="product-main">';
  html += '<div class="card-top">';
  html += '<div>';
  html += '<h3>' + escaparHtml(produto.nome) + '</h3>';
  html += '<p class="description">' + escaparHtml(descricao) + '</p>';
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

// Este controle evita cliques repetidos no mesmo produto enquanto a alteração é salva.
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
  elementos.produtoForm.reset();
  elementos.produtoId.value = '';
  elementos.produtoQuantidade.value = '0';
  abrirDialogProduto();
}

function abrirFormularioEditarProduto(produto) {
  estado.produtoEditando = produto;
  elementos.produtoFormTitulo.textContent = 'Editar produto';
  elementos.produtoId.value = produto.id;
  elementos.produtoNome.value = produto.nome;
  elementos.produtoDescricao.value = produto.descricao ?? '';
  elementos.produtoCategoria.value = produto.categoria ?? '';
  elementos.produtoCor.value = produto.cor ?? '';
  elementos.produtoTamanho.value = produto.tamanho ?? '';
  elementos.produtoQuantidade.value = produto.quantidade;
  abrirDialogProduto();
}

function abrirDialogProduto() {
  if (typeof elementos.produtoDialog.showModal === 'function') {
    elementos.produtoDialog.showModal();
  } else {
    elementos.produtoDialog.hidden = false;
  }

  elementos.produtoNome.focus();
}

function fecharFormularioProduto() {
  if (elementos.produtoDialog.open) {
    elementos.produtoDialog.close();
  } else {
    elementos.produtoDialog.hidden = true;
  }
}

async function aoSalvarProduto(evento) {
  evento.preventDefault();
  const produto = lerProdutoDoFormulario();

  if (!produto) {
    return;
  }

  try {
    elementos.salvarProdutoBtn.disabled = true;

    if (estado.produtoEditando) {
      await editarProduto(estado.produtoEditando.id, produto, estado.produtoEditando, estado.usuario);
      mostrarMensagem('Produto editado com sucesso.', 'success');
    } else {
      await criarProduto(produto, estado.usuario);
      mostrarMensagem('Produto cadastrado com sucesso.', 'success');
    }

    fecharFormularioProduto();
    await carregarProdutos();
    await carregarHistorico();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    elementos.salvarProdutoBtn.disabled = false;
  }
}

function lerProdutoDoFormulario() {
  const quantidade = Number(elementos.produtoQuantidade.value);

  if (!elementos.produtoForm.reportValidity()) {
    return null;
  }

  if (!Number.isInteger(quantidade) || quantidade < 0) {
    mostrarMensagem('A quantidade deve ser um número inteiro maior ou igual a zero.', 'error');
    return null;
  }

  return {
    nome: elementos.produtoNome.value,
    descricao: elementos.produtoDescricao.value,
    categoria: elementos.produtoCategoria.value,
    cor: elementos.produtoCor.value,
    tamanho: elementos.produtoTamanho.value,
    quantidade
  };
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

// O Realtime recarrega produtos e histórico quando outro sócio altera o estoque.
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

// Remove acentos da busca para encontrar produtos com ou sem acentuação.
function normalizarTexto(valor) {
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

function formatarData(dataIso) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(dataIso));
}
