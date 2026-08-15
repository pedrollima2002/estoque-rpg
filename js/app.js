import { supabaseConfigurado } from './supabase-config.js';
import {
  entrarComEmailSenha,
  obterSessaoAtual,
  observarAutenticacao,
  sair
} from './auth.js';
import {
  cadastrarVariacoes,
  criarProdutos,
  definirProdutoArquivado,
  editarProduto,
  excluirProdutoPermanentemente,
  listarProdutos,
  observarProdutos
} from './produtos.js';
import { movimentarEstoque, TIPOS_MOVIMENTACAO } from './movimentacoes.js';
import {
  listarMovimentacoes,
  obterResumoMovimentacoesMes,
  observarMovimentacoes
} from './historico.js';
import {
  aplicarAjustesConferencia,
  cancelarConferencia,
  iniciarConferencia,
  listarItensConferencia,
  obterConferenciaAberta,
  salvarContagemItem
} from './conferencia.js';
import {
  chaveModelo,
  chaveVariacao,
  escaparHtml,
  formatarDataHora,
  formatarMoeda,
  normalizarBusca,
  normalizarTexto,
  valoresUnicos
} from './utils.js';

const LIMITE_LINHAS = 10;
const LIMITE_HISTORICO = 30;

const estado = {
  usuario: null,
  todosProdutos: [],
  produtos: [],
  arquivados: [],
  resumoMes: { entradas: 0, saidas: 0 },
  secao: 'dashboard',
  categoriaSelecionada: null,
  modoVisualizacao: 'individual',
  produtoEditando: null,
  produtoMovimentando: null,
  sinalAjuste: 1,
  salvando: false,
  salvandoProdutos: new Set(),
  proximaLinhaId: 1,
  coresCadastro: [],
  tamanhosCadastro: [],
  quantidadesMatriz: new Map(),
  resolverDuplicados: null,
  filtrosGerais: filtrosEstoqueVazios(),
  filtrosPasta: filtrosEstoqueVazios(),
  buscaCategoria: '',
  buscaArquivados: '',
  historico: {
    itens: [],
    total: 0,
    pagina: 0,
    filtros: {},
    timer: null
  },
  conferencia: {
    dados: null,
    itens: [],
    indice: 0,
    busca: ''
  },
  cancelarRealtime: [],
  timerProdutos: null,
  timerHistorico: null
};

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => Array.from(document.querySelectorAll(seletor));

const elementos = {
  loginView: $('#login-view'),
  appView: $('#app-view'),
  loginForm: $('#login-form'),
  email: $('#email'),
  senha: $('#senha'),
  entrarBtn: $('#entrar-btn'),
  sairBtn: $('#sair-btn'),
  mobileSairBtn: $('#mobile-sair-btn'),
  usuarioEmail: $('#usuario-email'),
  configAlert: $('#config-alert'),
  toast: $('#toast'),
  loadingOverlay: $('#loading-overlay'),
  loadingText: $('#loading-text'),
  pageTitle: $('#page-title'),
  dashboardSection: $('#dashboard-section'),
  estoqueSection: $('#estoque-section'),
  historicoSection: $('#historico-section'),
  conferenciaSection: $('#conferencia-section'),
  arquivadosSection: $('#arquivados-section'),
  totalPecas: $('#total-pecas'),
  totalModelos: $('#total-modelos'),
  totalBaixo: $('#total-baixo'),
  totalZerados: $('#total-zerados'),
  valorEstoque: $('#valor-estoque'),
  entradasMes: $('#entradas-mes'),
  saidasMes: $('#saidas-mes'),
  atencaoLista: $('#atencao-lista'),
  atencaoVazio: $('#atencao-vazio'),
  categoriasView: $('#categorias-view'),
  produtosView: $('#produtos-view'),
  categoriasConteudo: $('#categorias-conteudo'),
  categoriasLista: $('#categorias-lista'),
  categoriasVazio: $('#categorias-vazio'),
  buscaCategoria: $('#busca-categoria'),
  voltarCategoriasBtn: $('#voltar-categorias-btn'),
  categoriaAtualTitulo: $('#categoria-atual-titulo'),
  resultadoGeralView: $('#resultado-geral-view'),
  resultadoGeralTitulo: $('#resultado-geral-titulo'),
  produtosGeraisLista: $('#produtos-gerais-lista'),
  produtosGeraisVazio: $('#produtos-gerais-vazio'),
  produtosLista: $('#produtos-lista'),
  produtosVazio: $('#produtos-vazio'),
  buscaGeral: $('#busca-geral'),
  filtroGeralCategoria: $('#filtro-geral-categoria'),
  filtroGeralSubcategoria: $('#filtro-geral-subcategoria'),
  filtroGeralCor: $('#filtro-geral-cor'),
  filtroGeralTamanho: $('#filtro-geral-tamanho'),
  filtroGeralEstoque: $('#filtro-geral-estoque'),
  limparFiltrosGeraisBtn: $('#limpar-filtros-gerais-btn'),
  busca: $('#busca'),
  filtroSubcategoria: $('#filtro-subcategoria'),
  filtroCor: $('#filtro-cor'),
  filtroTamanho: $('#filtro-tamanho'),
  filtroEstoque: $('#filtro-estoque'),
  arquivadosLista: $('#arquivados-lista'),
  arquivadosVazio: $('#arquivados-vazio'),
  buscaArquivados: $('#busca-arquivados'),
  historicoLista: $('#historico-lista'),
  historicoVazio: $('#historico-vazio'),
  atualizarHistoricoBtn: $('#atualizar-historico-btn'),
  carregarMaisHistoricoBtn: $('#carregar-mais-historico-btn'),
  historicoInicio: $('#historico-inicio'),
  historicoFim: $('#historico-fim'),
  historicoProduto: $('#historico-produto'),
  historicoCategoria: $('#historico-categoria'),
  historicoUsuario: $('#historico-usuario'),
  historicoTipo: $('#historico-tipo'),
  historicoBusca: $('#historico-busca'),
  variacoesDialog: $('#variacoes-dialog'),
  variacoesForm: $('#variacoes-form'),
  variacaoNome: $('#variacao-nome'),
  variacaoCategoria: $('#variacao-categoria'),
  variacaoSubcategoria: $('#variacao-subcategoria'),
  variacaoDescricao: $('#variacao-descricao'),
  variacaoValor: $('#variacao-valor'),
  variacaoEstoqueMinimo: $('#variacao-estoque-minimo'),
  variacaoCorInput: $('#variacao-cor-input'),
  variacaoTamanhoInput: $('#variacao-tamanho-input'),
  adicionarCorBtn: $('#adicionar-cor-btn'),
  adicionarTamanhoBtn: $('#adicionar-tamanho-btn'),
  coresSelecionadas: $('#cores-selecionadas'),
  tamanhosSelecionados: $('#tamanhos-selecionados'),
  coresSugestoes: $('#cores-sugestoes'),
  tamanhosSugestoes: $('#tamanhos-sugestoes'),
  matrizVazia: $('#matriz-vazia'),
  matrizContainer: $('#matriz-container'),
  variacoesFormErro: $('#variacoes-form-erro'),
  salvarVariacoesBtn: $('#salvar-variacoes-btn'),
  abrirCadastroLinhasBtn: $('#abrir-cadastro-linhas-btn'),
  produtoDialog: $('#produto-dialog'),
  produtoForm: $('#produto-form'),
  produtoFormTitulo: $('#produto-form-titulo'),
  produtosFormLista: $('#produtos-form-lista'),
  produtoFormErro: $('#produto-form-erro'),
  adicionarProdutoLinhaBtn: $('#adicionar-produto-linha-btn'),
  copiarProdutoLinhaBtn: $('#copiar-produto-linha-btn'),
  rowTools: $('#row-tools'),
  salvarProdutoBtn: $('#salvar-produto-btn'),
  duplicadosDialog: $('#duplicados-dialog'),
  duplicadosLista: $('#duplicados-lista'),
  somarDuplicadosBtn: $('#somar-duplicados-btn'),
  movimentacaoDialog: $('#movimentacao-dialog'),
  movimentacaoForm: $('#movimentacao-form'),
  movimentacaoProduto: $('#movimentacao-produto'),
  movimentacaoTipo: $('#movimentacao-tipo'),
  movimentacaoDirecaoGrupo: $('#movimentacao-direcao-grupo'),
  movimentacaoQuantidade: $('#movimentacao-quantidade'),
  movimentacaoMotivo: $('#movimentacao-motivo'),
  movimentacaoPreview: $('#movimentacao-preview'),
  movimentacaoErro: $('#movimentacao-erro'),
  confirmarMovimentacaoBtn: $('#confirmar-movimentacao-btn'),
  conferenciaInicio: $('#conferencia-inicio'),
  conferenciaAtiva: $('#conferencia-ativa'),
  iniciarConferenciaBtn: $('#iniciar-conferencia-btn'),
  conferenciaProgressoTexto: $('#conferencia-progresso-texto'),
  conferenciaProgressoBarra: $('#conferencia-progresso-barra'),
  conferenciaBusca: $('#conferencia-busca'),
  conferenciaItem: $('#conferencia-item'),
  conferenciaAnteriorBtn: $('#conferencia-anterior-btn'),
  conferenciaProximoBtn: $('#conferencia-proximo-btn'),
  conferenciaResumo: $('#conferencia-resumo'),
  conferenciaResumoMetricas: $('#conferencia-resumo-metricas'),
  conferenciaDivergencias: $('#conferencia-divergencias'),
  cancelarConferenciaBtn: $('#cancelar-conferencia-btn'),
  aplicarConferenciaBtn: $('#aplicar-conferencia-btn')
};

iniciarAplicativo();

async function iniciarAplicativo() {
  configurarLogos();
  configurarEventos();
  preencherTiposMovimentacao();

  if (!supabaseConfigurado) {
    elementos.configAlert.hidden = false;
    elementos.configAlert.textContent = 'Configure a URL e a chave pública do Supabase antes de entrar.';
    elementos.entrarBtn.disabled = true;
    return;
  }

  try {
    mostrarCarregamento(true, 'Abrindo o estoque...');
    const sessao = await obterSessaoAtual();
    await aplicarSessao(sessao);
    observarAutenticacao(aplicarSessao);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
    mostrarTelaLogin();
  } finally {
    mostrarCarregamento(false);
  }
}

function configurarLogos() {
  $$('[data-brand-logo]').forEach((imagem) => {
    const fallback = imagem.parentElement.querySelector('[data-brand-fallback]');
    const mostrarFallback = () => {
      imagem.hidden = true;
      if (fallback) fallback.hidden = false;
    };
    const mostrarLogo = () => {
      imagem.hidden = false;
      if (fallback) fallback.hidden = true;
    };

    imagem.addEventListener('error', mostrarFallback);
    imagem.addEventListener('load', mostrarLogo);
    if (imagem.complete) {
      imagem.naturalWidth > 0 ? mostrarLogo() : mostrarFallback();
    }
  });
}

function configurarEventos() {
  elementos.loginForm.addEventListener('submit', aoEntrar);
  elementos.sairBtn.addEventListener('click', aoSair);
  elementos.mobileSairBtn.addEventListener('click', aoSair);

  document.addEventListener('click', aoClicarDocumento);

  elementos.buscaCategoria.addEventListener('input', () => {
    estado.buscaCategoria = elementos.buscaCategoria.value;
    renderizarCategorias();
  });
  elementos.categoriasLista.addEventListener('click', aoClicarCategoria);
  elementos.voltarCategoriasBtn.addEventListener('click', voltarParaCategorias);

  configurarFiltrosEstoque();
  [elementos.produtosLista, elementos.produtosGeraisLista, elementos.arquivadosLista]
    .forEach((lista) => lista.addEventListener('click', aoClicarProduto));

  $$('[data-view-mode]').forEach((botao) => {
    botao.addEventListener('click', () => alterarModoVisualizacao(botao.dataset.viewMode));
  });

  elementos.buscaArquivados.addEventListener('input', () => {
    estado.buscaArquivados = elementos.buscaArquivados.value;
    renderizarArquivados();
  });

  elementos.atualizarHistoricoBtn.addEventListener('click', () => carregarHistorico(true));
  elementos.carregarMaisHistoricoBtn.addEventListener('click', () => carregarHistorico(false));
  configurarFiltrosHistorico();

  elementos.adicionarCorBtn.addEventListener('click', () => adicionarTokenCadastro('cor'));
  elementos.adicionarTamanhoBtn.addEventListener('click', () => adicionarTokenCadastro('tamanho'));
  elementos.variacaoCorInput.addEventListener('keydown', (evento) => adicionarTokenComEnter(evento, 'cor'));
  elementos.variacaoTamanhoInput.addEventListener('keydown', (evento) => adicionarTokenComEnter(evento, 'tamanho'));
  elementos.coresSelecionadas.addEventListener('click', removerTokenCadastro);
  elementos.tamanhosSelecionados.addEventListener('click', removerTokenCadastro);
  elementos.coresSugestoes.addEventListener('click', selecionarSugestaoToken);
  elementos.tamanhosSugestoes.addEventListener('click', selecionarSugestaoToken);
  elementos.matrizContainer.addEventListener('input', aoAlterarMatriz);
  elementos.variacoesForm.addEventListener('submit', aoSalvarVariacoes);
  elementos.abrirCadastroLinhasBtn.addEventListener('click', abrirCadastroPorLinhas);

  elementos.produtoForm.addEventListener('submit', aoSalvarProdutosPorLinha);
  elementos.adicionarProdutoLinhaBtn.addEventListener('click', () => adicionarLinhaProduto());
  elementos.copiarProdutoLinhaBtn.addEventListener('click', copiarLinhaProduto);
  elementos.produtosFormLista.addEventListener('click', aoClicarFormularioLinhas);

  elementos.duplicadosDialog.addEventListener('click', aoResponderDuplicados);
  elementos.duplicadosDialog.addEventListener('cancel', (evento) => {
    evento.preventDefault();
    if (estado.resolverDuplicados) {
      const resolver = estado.resolverDuplicados;
      estado.resolverDuplicados = null;
      fecharDialog(elementos.duplicadosDialog);
      resolver('cancelar');
    }
  });

  elementos.movimentacaoTipo.addEventListener('change', atualizarFormularioMovimentacao);
  elementos.movimentacaoQuantidade.addEventListener('input', atualizarPreviewMovimentacao);
  elementos.movimentacaoForm.addEventListener('submit', aoConfirmarMovimentacao);
  $$('[data-adjustment-sign]').forEach((botao) => {
    botao.addEventListener('click', () => {
      estado.sinalAjuste = Number(botao.dataset.adjustmentSign);
      $$('[data-adjustment-sign]').forEach((item) => item.classList.toggle('active', item === botao));
      atualizarPreviewMovimentacao();
    });
  });

  elementos.iniciarConferenciaBtn.addEventListener('click', aoIniciarConferencia);
  elementos.conferenciaAnteriorBtn.addEventListener('click', () => navegarConferencia(-1));
  elementos.conferenciaProximoBtn.addEventListener('click', salvarEAvancarConferencia);
  elementos.conferenciaBusca.addEventListener('input', aoBuscarNaConferencia);
  elementos.cancelarConferenciaBtn.addEventListener('click', aoCancelarConferencia);
  elementos.aplicarConferenciaBtn.addEventListener('click', aoAplicarConferencia);
}

function aoClicarDocumento(evento) {
  const fechar = evento.target.closest('[data-close-dialog]');
  if (fechar) {
    fecharDialog(document.getElementById(fechar.dataset.closeDialog));
    return;
  }

  const novoProduto = evento.target.closest('[data-action="novo-produto"]');
  if (novoProduto) {
    abrirCadastroVariacoes();
    return;
  }

  const navegacao = evento.target.closest('[data-section]');
  if (navegacao) {
    trocarSecao(navegacao.dataset.section);

    if (navegacao.dataset.filterAttention) {
      estado.filtrosGerais.estoque = 'atencao';
      elementos.filtroGeralEstoque.value = 'atencao';
      renderizarEstoque();
    }
  }
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
    mostrarCarregamento(true, 'Entrando...');
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
    await sair();
    await aplicarSessao(null);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

async function aplicarSessao(sessao) {
  if (!sessao?.user) {
    estado.usuario = null;
    estado.todosProdutos = [];
    pararRealtime();
    mostrarTelaLogin();
    return;
  }

  estado.usuario = sessao.user;
  elementos.usuarioEmail.textContent = sessao.user.email;
  mostrarTelaApp();

  await Promise.all([
    carregarProdutos(),
    carregarResumoMes(),
    carregarHistorico(true)
  ]);
  iniciarRealtime();
}

function mostrarTelaLogin() {
  elementos.loginView.hidden = false;
  elementos.appView.hidden = true;
}

function mostrarTelaApp() {
  elementos.loginView.hidden = true;
  elementos.appView.hidden = false;
  trocarSecao(estado.secao);
}

function trocarSecao(secao) {
  const titulos = {
    dashboard: 'Visão geral',
    estoque: 'Estoque',
    historico: 'Histórico',
    conferencia: 'Conferência',
    arquivados: 'Arquivados'
  };

  if (!titulos[secao]) return;

  estado.secao = secao;
  elementos.pageTitle.textContent = titulos[secao];
  $$('.app-section').forEach((section) => {
    section.hidden = section.id !== `${secao}-section`;
  });
  $$('[data-section]').forEach((botao) => {
    botao.classList.toggle('active', botao.dataset.section === secao);
  });

  if (secao === 'historico') carregarHistorico(true);
  if (secao === 'conferencia') carregarConferencia();
  if (secao === 'estoque') renderizarEstoque();
  if (secao === 'arquivados') renderizarArquivados();
}

async function carregarProdutos() {
  try {
    estado.todosProdutos = await listarProdutos();
    estado.produtos = estado.todosProdutos.filter((produto) => produto.ativo);
    estado.arquivados = estado.todosProdutos.filter((produto) => !produto.ativo);
    garantirCategoriaSelecionada();
    atualizarOpcoesDinamicas();
    renderizarDashboard();
    renderizarEstoque();
    renderizarArquivados();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

async function carregarResumoMes() {
  try {
    estado.resumoMes = await obterResumoMovimentacoesMes();
    renderizarDashboard();
  } catch (erro) {
    estado.resumoMes = { entradas: 0, saidas: 0 };
    if (!erro?.message?.includes('diferenca')) {
      mostrarMensagem(traduzirErro(erro), 'error');
    }
  }
}

function renderizarDashboard() {
  const totalPecas = estado.produtos.reduce((soma, produto) => soma + produto.quantidade, 0);
  const baixo = estado.produtos.filter((produto) => produto.quantidade > 0 && produto.quantidade <= produto.estoque_minimo);
  const zerados = estado.produtos.filter((produto) => produto.quantidade === 0);
  const valor = estado.produtos.reduce((soma, produto) => {
    return soma + produto.quantidade * Number(produto.valor_venda ?? 0);
  }, 0);

  elementos.totalPecas.textContent = totalPecas.toLocaleString('pt-BR');
  elementos.totalModelos.textContent = estado.produtos.length.toLocaleString('pt-BR');
  elementos.totalBaixo.textContent = baixo.length.toLocaleString('pt-BR');
  elementos.totalZerados.textContent = zerados.length.toLocaleString('pt-BR');
  elementos.valorEstoque.textContent = formatarMoeda(valor);
  elementos.entradasMes.textContent = `+${estado.resumoMes.entradas.toLocaleString('pt-BR')}`;
  elementos.saidasMes.textContent = `-${estado.resumoMes.saidas.toLocaleString('pt-BR')}`;

  const atencao = [...zerados, ...baixo]
    .sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome, 'pt-BR'))
    .slice(0, 8);

  elementos.atencaoVazio.hidden = atencao.length > 0;
  elementos.atencaoLista.innerHTML = atencao.map((produto) => `
    <article class="attention-item">
      <div>
        <h3>${escaparHtml(produto.nome)}</h3>
        <p>${escaparHtml([produto.cor, produto.tamanho].filter(Boolean).join(' • '))}</p>
        <small>${produto.quantidade === 0 ? 'Sem estoque' : 'Estoque baixo'}</small>
      </div>
      <span class="attention-count">${produto.quantidade}</span>
    </article>
  `).join('');
}

function atualizarOpcoesDinamicas() {
  estado.filtrosGerais.categoria = preencherFiltro(elementos.filtroGeralCategoria, valoresUnicos(estado.produtos, 'categoria'), estado.filtrosGerais.categoria);
  estado.filtrosGerais.subcategoria = preencherFiltro(elementos.filtroGeralSubcategoria, valoresUnicos(estado.produtos, 'subcategoria'), estado.filtrosGerais.subcategoria);
  estado.filtrosGerais.cor = preencherFiltro(elementos.filtroGeralCor, valoresUnicos(estado.produtos, 'cor'), estado.filtrosGerais.cor);
  estado.filtrosGerais.tamanho = preencherFiltro(elementos.filtroGeralTamanho, valoresUnicos(estado.produtos, 'tamanho'), estado.filtrosGerais.tamanho);
  preencherFiltro(elementos.historicoCategoria, valoresUnicos(estado.todosProdutos, 'categoria'), elementos.historicoCategoria.value, 'Todas');

  preencherDatalist('#categorias-datalist', valoresUnicos(estado.produtos, 'categoria'));
  preencherDatalist('#subcategorias-datalist', valoresUnicos(estado.produtos, 'subcategoria'));
  preencherDatalist('#cores-datalist', valoresUnicos(estado.produtos, 'cor'));
  preencherDatalist('#tamanhos-datalist', valoresUnicos(estado.produtos, 'tamanho'));
}

function preencherDatalist(seletor, opcoes) {
  $(seletor).innerHTML = opcoes.map((opcao) => `<option value="${escaparHtml(opcao)}"></option>`).join('');
}

function configurarFiltrosEstoque() {
  elementos.buscaGeral.addEventListener('input', () => {
    estado.filtrosGerais.busca = elementos.buscaGeral.value;
    renderizarEstoque();
  });
  elementos.busca.addEventListener('input', () => {
    estado.filtrosPasta.busca = elementos.busca.value;
    renderizarProdutosDaPasta();
  });

  [
    [elementos.filtroGeralCategoria, 'categoria'],
    [elementos.filtroGeralSubcategoria, 'subcategoria'],
    [elementos.filtroGeralCor, 'cor'],
    [elementos.filtroGeralTamanho, 'tamanho'],
    [elementos.filtroGeralEstoque, 'estoque']
  ].forEach(([elemento, campo]) => {
    elemento.addEventListener('change', () => {
      estado.filtrosGerais[campo] = elemento.value;
      renderizarEstoque();
    });
  });

  [
    [elementos.filtroSubcategoria, 'subcategoria'],
    [elementos.filtroCor, 'cor'],
    [elementos.filtroTamanho, 'tamanho'],
    [elementos.filtroEstoque, 'estoque']
  ].forEach(([elemento, campo]) => {
    elemento.addEventListener('change', () => {
      estado.filtrosPasta[campo] = elemento.value;
      renderizarProdutosDaPasta();
    });
  });

  elementos.limparFiltrosGeraisBtn.addEventListener('click', limparFiltrosGerais);
}

function filtrosEstoqueVazios() {
  return {
    busca: '',
    categoria: 'Todos',
    subcategoria: 'Todos',
    cor: 'Todos',
    tamanho: 'Todos',
    estoque: 'todos'
  };
}

function preencherFiltro(select, opcoes, valorAtual, rotuloTodos = 'Todos') {
  const existe = valorAtual === 'Todos' || valorAtual === '' || opcoes.includes(valorAtual);
  const selecionado = existe ? valorAtual : (rotuloTodos === 'Todas' ? '' : 'Todos');
  const valorTodos = rotuloTodos === 'Todas' ? '' : 'Todos';
  select.innerHTML = `<option value="${valorTodos}">${rotuloTodos}</option>` + opcoes
    .map((opcao) => `<option value="${escaparHtml(opcao)}">${escaparHtml(opcao)}</option>`)
    .join('');
  select.value = selecionado;
  return selecionado;
}

function garantirCategoriaSelecionada() {
  if (!estado.categoriaSelecionada) return;
  if (!valoresUnicos(estado.produtos, 'categoria').includes(estado.categoriaSelecionada)) {
    estado.categoriaSelecionada = null;
    estado.filtrosPasta = filtrosEstoqueVazios();
  }
}

function renderizarEstoque() {
  const pastaAberta = Boolean(estado.categoriaSelecionada);
  elementos.categoriasView.hidden = pastaAberta;
  elementos.produtosView.hidden = !pastaAberta;

  if (pastaAberta) {
    atualizarFiltrosPasta();
    renderizarProdutosDaPasta();
  } else {
    renderizarCategorias();
  }
}

function renderizarCategorias() {
  const filtrosAtivos = filtrosGeraisAtivos();
  elementos.categoriasConteudo.hidden = filtrosAtivos;
  elementos.resultadoGeralView.hidden = !filtrosAtivos;
  elementos.limparFiltrosGeraisBtn.hidden = !filtrosAtivos;

  if (filtrosAtivos) {
    const produtos = filtrarColecao(estado.produtos, estado.filtrosGerais);
    elementos.resultadoGeralTitulo.textContent = `${produtos.length} ${produtos.length === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
    elementos.produtosGeraisVazio.hidden = produtos.length > 0;
    elementos.produtosGeraisLista.innerHTML = montarColecaoProdutos(produtos);
    return;
  }

  const termo = normalizarBusca(estado.buscaCategoria);
  const categorias = obterResumoCategorias().filter((item) => normalizarBusca(item.nome).includes(termo));
  elementos.categoriasVazio.hidden = categorias.length > 0;
  elementos.categoriasLista.innerHTML = categorias.map((categoria) => `
    <button class="category-card" type="button" data-category="${escaparHtml(categoria.nome)}">
      <span class="folder-label">Categoria</span>
      <strong>${escaparHtml(categoria.nome)}</strong>
      <span>${categoria.pecas} ${categoria.pecas === 1 ? 'peça' : 'peças'} em ${categoria.variacoes} ${categoria.variacoes === 1 ? 'variação' : 'variações'}</span>
      ${categoria.atencao > 0 ? `<small>${categoria.atencao} precisam de atenção</small>` : ''}
    </button>
  `).join('');
}

function obterResumoCategorias() {
  const mapa = new Map();
  estado.produtos.forEach((produto) => {
    const categoria = produto.categoria || 'SEM CATEGORIA';
    const item = mapa.get(categoria) ?? { nome: categoria, pecas: 0, variacoes: 0, atencao: 0 };
    item.pecas += produto.quantidade;
    item.variacoes += 1;
    item.atencao += produto.quantidade <= produto.estoque_minimo ? 1 : 0;
    mapa.set(categoria, item);
  });
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function filtrosGeraisAtivos() {
  const filtros = estado.filtrosGerais;
  return Boolean(normalizarBusca(filtros.busca))
    || filtros.categoria !== 'Todos'
    || filtros.subcategoria !== 'Todos'
    || filtros.cor !== 'Todos'
    || filtros.tamanho !== 'Todos'
    || filtros.estoque !== 'todos';
}

function filtrarColecao(produtos, filtros) {
  const termo = normalizarBusca(filtros.busca);

  return produtos.filter((produto) => {
    const textoProduto = normalizarBusca([
      produto.nome,
      produto.descricao,
      produto.categoria,
      produto.subcategoria,
      produto.cor,
      produto.tamanho
    ].join(' '));
    const buscaCombina = !termo || textoProduto.includes(termo);
    const categoriaCombina = filtros.categoria === 'Todos' || produto.categoria === filtros.categoria;
    const subcategoriaCombina = filtros.subcategoria === 'Todos' || produto.subcategoria === filtros.subcategoria;
    const corCombina = filtros.cor === 'Todos' || produto.cor === filtros.cor;
    const tamanhoCombina = filtros.tamanho === 'Todos' || produto.tamanho === filtros.tamanho;
    const baixo = produto.quantidade > 0 && produto.quantidade <= produto.estoque_minimo;
    const estoqueCombina = filtros.estoque === 'todos'
      || (filtros.estoque === 'baixo' && baixo)
      || (filtros.estoque === 'zerado' && produto.quantidade === 0)
      || (filtros.estoque === 'atencao' && (baixo || produto.quantidade === 0));

    return buscaCombina && categoriaCombina && subcategoriaCombina && corCombina && tamanhoCombina && estoqueCombina;
  });
}

function limparFiltrosGerais() {
  estado.filtrosGerais = filtrosEstoqueVazios();
  elementos.buscaGeral.value = '';
  atualizarOpcoesDinamicas();
  elementos.filtroGeralEstoque.value = 'todos';
  renderizarEstoque();
}

function aoClicarCategoria(evento) {
  const botao = evento.target.closest('[data-category]');
  if (!botao) return;
  estado.categoriaSelecionada = botao.dataset.category;
  estado.filtrosPasta = filtrosEstoqueVazios();
  elementos.busca.value = '';
  renderizarEstoque();
}

function voltarParaCategorias() {
  estado.categoriaSelecionada = null;
  estado.filtrosPasta = filtrosEstoqueVazios();
  renderizarEstoque();
}

function atualizarFiltrosPasta() {
  const produtos = estado.produtos.filter((produto) => produto.categoria === estado.categoriaSelecionada);
  elementos.categoriaAtualTitulo.textContent = estado.categoriaSelecionada;
  estado.filtrosPasta.subcategoria = preencherFiltro(elementos.filtroSubcategoria, valoresUnicos(produtos, 'subcategoria'), estado.filtrosPasta.subcategoria);
  estado.filtrosPasta.cor = preencherFiltro(elementos.filtroCor, valoresUnicos(produtos, 'cor'), estado.filtrosPasta.cor);
  estado.filtrosPasta.tamanho = preencherFiltro(elementos.filtroTamanho, valoresUnicos(produtos, 'tamanho'), estado.filtrosPasta.tamanho);
  elementos.filtroEstoque.value = estado.filtrosPasta.estoque;
}

function renderizarProdutosDaPasta() {
  const produtosCategoria = estado.produtos.filter((produto) => produto.categoria === estado.categoriaSelecionada);
  const produtos = filtrarColecao(produtosCategoria, estado.filtrosPasta);
  elementos.produtosVazio.hidden = produtos.length > 0;
  elementos.produtosLista.innerHTML = montarColecaoProdutos(produtos);
}

function alterarModoVisualizacao(modo) {
  estado.modoVisualizacao = modo;
  $$('[data-view-mode]').forEach((botao) => botao.classList.toggle('active', botao.dataset.viewMode === modo));
  renderizarEstoque();
}

function montarColecaoProdutos(produtos) {
  return estado.modoVisualizacao === 'modelo'
    ? agruparProdutos(produtos).map(montarCartaoModelo).join('')
    : produtos.map(montarCartaoProduto).join('');
}

function agruparProdutos(produtos) {
  const grupos = new Map();
  produtos.forEach((produto) => {
    const chave = chaveModelo(produto);
    const grupo = grupos.get(chave) ?? { base: produto, variantes: [], total: 0 };
    grupo.variantes.push(produto);
    grupo.total += produto.quantidade;
    grupos.set(chave, grupo);
  });
  return [...grupos.values()].sort((a, b) => a.base.nome.localeCompare(b.base.nome, 'pt-BR'));
}

function obterStatusEstoque(produto) {
  if (produto.quantidade === 0) return { classe: 'empty', texto: 'Sem estoque' };
  if (produto.quantidade <= produto.estoque_minimo) return { classe: 'low', texto: 'Estoque baixo' };
  return { classe: 'normal', texto: 'Normal' };
}

function montarCartaoProduto(produto) {
  const status = obterStatusEstoque(produto);
  const desabilitado = estado.salvandoProdutos.has(produto.id) ? ' disabled' : '';
  return `
    <article class="product-card ${status.classe}" data-id="${escaparHtml(produto.id)}">
      <button class="quantity-button minus" type="button" data-action="diminuir" data-id="${escaparHtml(produto.id)}" aria-label="Retirar uma unidade de ${escaparHtml(produto.nome)}"${desabilitado}>−</button>
      <div class="product-main">
        <div class="card-top">
          <div>
            <h3>${escaparHtml(produto.nome)}</h3>
            ${produto.descricao ? `<p>${escaparHtml(produto.descricao)}</p>` : ''}
            ${produto.valor_venda !== null ? `<p class="price-line">Venda: <strong>${formatarMoeda(produto.valor_venda)}</strong></p>` : ''}
          </div>
          <details class="card-menu">
            <summary aria-label="Opções do produto">⋯</summary>
            <div class="menu-content">
              <button type="button" data-action="movimentar" data-id="${escaparHtml(produto.id)}">Movimentar estoque</button>
              <button type="button" data-action="editar" data-id="${escaparHtml(produto.id)}">Editar produto</button>
              <button class="danger-menu-item" type="button" data-action="arquivar" data-id="${escaparHtml(produto.id)}">Arquivar produto</button>
            </div>
          </details>
        </div>
        <div class="tags">
          ${montarTag(produto.categoria)}
          ${produto.subcategoria ? montarTag(produto.subcategoria) : ''}
          ${montarTag(produto.cor)}
          ${produto.tamanho ? montarTag(produto.tamanho) : ''}
        </div>
        <p class="stock-line"><strong>${produto.quantidade}</strong><span>${produto.quantidade === 1 ? 'unidade' : 'unidades'}</span><span class="status-badge ${status.classe}">${status.texto}</span></p>
      </div>
      <button class="quantity-button plus" type="button" data-action="aumentar" data-id="${escaparHtml(produto.id)}" aria-label="Adicionar uma unidade a ${escaparHtml(produto.nome)}"${desabilitado}>+</button>
    </article>
  `;
}

function montarCartaoModelo(grupo) {
  const temZerado = grupo.variantes.some((produto) => produto.quantidade === 0);
  const temBaixo = grupo.variantes.some((produto) => produto.quantidade > 0 && produto.quantidade <= produto.estoque_minimo);
  const classe = temZerado ? 'empty' : temBaixo ? 'low' : 'normal';
  const base = grupo.base;
  const cores = valoresUnicos(grupo.variantes, 'cor').length;
  const tamanhos = valoresUnicos(grupo.variantes, 'tamanho').length;

  return `
    <details class="model-card ${classe}">
      <summary>
        <div class="model-summary">
          <h3>${escaparHtml(base.nome)}</h3>
          <p>${escaparHtml([base.categoria, base.subcategoria].filter(Boolean).join(' • '))}</p>
          ${base.valor_venda !== null ? `<p class="price-line"><strong>${formatarMoeda(base.valor_venda)}</strong></p>` : ''}
          <div class="tags"><span class="tag">${cores} ${cores === 1 ? 'cor' : 'cores'}</span><span class="tag">${tamanhos} ${tamanhos === 1 ? 'tamanho' : 'tamanhos'}</span></div>
        </div>
        <div class="model-total">${grupo.total}<small> unidades</small><br><span class="status-badge ${classe}">${temZerado ? 'Há zerados' : temBaixo ? 'Estoque baixo' : 'Normal'}</span></div>
      </summary>
      <div class="model-variants">
        ${grupo.variantes.map((produto) => `
          <div class="variant-row" data-id="${escaparHtml(produto.id)}">
            <div class="variant-info"><strong>${escaparHtml(produto.cor)}${produto.tamanho ? ` • ${escaparHtml(produto.tamanho)}` : ''}</strong><p>${produto.quantidade} em estoque</p></div>
            <button class="variant-action minus" type="button" data-action="diminuir" data-id="${escaparHtml(produto.id)}" aria-label="Retirar uma unidade">−</button>
            <span class="variant-qty">${produto.quantidade}</span>
            <button class="variant-action plus" type="button" data-action="aumentar" data-id="${escaparHtml(produto.id)}" aria-label="Adicionar uma unidade">+</button>
            <button class="variant-menu-button" type="button" data-action="movimentar" data-id="${escaparHtml(produto.id)}" aria-label="Movimentar esta variação">Mov.</button>
          </div>
        `).join('')}
      </div>
    </details>
  `;
}

function montarTag(valor) {
  return `<span class="tag">${escaparHtml(valor || 'Não informado')}</span>`;
}

async function aoClicarProduto(evento) {
  const botao = evento.target.closest('[data-action][data-id]');
  if (!botao) return;
  const produto = estado.todosProdutos.find((item) => item.id === botao.dataset.id);
  if (!produto) return;

  const acao = botao.dataset.action;
  if (acao === 'aumentar') await ajustarRapido(produto, 1);
  if (acao === 'diminuir') await ajustarRapido(produto, -1);
  if (acao === 'movimentar') abrirMovimentacao(produto);
  if (acao === 'editar') abrirEdicaoProduto(produto);
  if (acao === 'arquivar') await arquivarProduto(produto);
  if (acao === 'restaurar') await restaurarProduto(produto);
  if (acao === 'excluir-permanente') await excluirPermanentemente(produto);
}

async function ajustarRapido(produto, diferenca) {
  if (estado.salvandoProdutos.has(produto.id)) return;
  if (diferenca < 0 && produto.quantidade === 0) {
    mostrarMensagem('O produto já está sem estoque.', 'error');
    return;
  }
  if (diferenca < 0 && produto.quantidade === 1 && !confirm('Este produto ficará sem estoque. Deseja continuar?')) return;

  try {
    estado.salvandoProdutos.add(produto.id);
    renderizarEstoque();
    await movimentarEstoque(
      produto.id,
      diferenca,
      diferenca > 0 ? 'entrada' : 'venda',
      diferenca > 0 ? 'Entrada rápida (+1)' : 'Saída rápida (-1)'
    );
    mostrarMensagem('Estoque atualizado.', 'success');
    await Promise.all([carregarProdutos(), carregarResumoMes(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    estado.salvandoProdutos.delete(produto.id);
    renderizarEstoque();
  }
}

function preencherTiposMovimentacao() {
  elementos.movimentacaoTipo.innerHTML = Object.entries(TIPOS_MOVIMENTACAO)
    .map(([valor, tipo]) => `<option value="${valor}">${escaparHtml(tipo.rotulo)}</option>`)
    .join('');
}

function abrirMovimentacao(produto) {
  estado.produtoMovimentando = produto;
  estado.sinalAjuste = 1;
  elementos.movimentacaoForm.reset();
  elementos.movimentacaoTipo.value = 'entrada';
  elementos.movimentacaoProduto.innerHTML = `
    <h3>${escaparHtml(produto.nome)}</h3>
    <p>${escaparHtml([produto.cor, produto.tamanho].filter(Boolean).join(' • '))}</p>
    <p>Estoque atual: <strong>${produto.quantidade}</strong></p>
  `;
  elementos.movimentacaoErro.hidden = true;
  $$('[data-adjustment-sign]').forEach((botao) => botao.classList.toggle('active', botao.dataset.adjustmentSign === '1'));
  atualizarFormularioMovimentacao();
  abrirDialog(elementos.movimentacaoDialog);
  elementos.movimentacaoQuantidade.focus();
}

function atualizarFormularioMovimentacao() {
  const tipo = TIPOS_MOVIMENTACAO[elementos.movimentacaoTipo.value];
  elementos.movimentacaoDirecaoGrupo.hidden = tipo.sinal !== null;
  if (tipo.sinal !== null) estado.sinalAjuste = tipo.sinal;
  elementos.movimentacaoMotivo.placeholder = tipo.exigeMotivo ? 'Informe o motivo desta movimentação' : 'Opcional para esta movimentação';
  atualizarPreviewMovimentacao();
}

function atualizarPreviewMovimentacao() {
  const produto = estado.produtoMovimentando;
  if (!produto) return;
  const quantidade = Math.max(0, Number(elementos.movimentacaoQuantidade.value || 0));
  const diferenca = quantidade * estado.sinalAjuste;
  const novoEstoque = produto.quantidade + diferenca;
  elementos.movimentacaoPreview.innerHTML = `
    <div><span>Estoque atual</span><strong>${produto.quantidade}</strong></div>
    <div><span>Movimentação</span><strong>${diferenca > 0 ? '+' : ''}${diferenca}</strong></div>
    <div><span>Novo estoque</span><strong>${novoEstoque}</strong></div>
  `;
  elementos.movimentacaoErro.hidden = novoEstoque >= 0;
  elementos.movimentacaoErro.textContent = novoEstoque < 0 ? 'A movimentação deixaria o estoque negativo.' : '';
}

async function aoConfirmarMovimentacao(evento) {
  evento.preventDefault();
  if (estado.salvando || !estado.produtoMovimentando) return;

  const tipoValor = elementos.movimentacaoTipo.value;
  const tipo = TIPOS_MOVIMENTACAO[tipoValor];
  const quantidade = Number(elementos.movimentacaoQuantidade.value);
  const motivo = elementos.movimentacaoMotivo.value.trim();
  const diferenca = quantidade * estado.sinalAjuste;
  const novoEstoque = estado.produtoMovimentando.quantidade + diferenca;

  if (!Number.isInteger(quantidade) || quantidade <= 0) return mostrarErroMovimentacao('Informe uma quantidade inteira maior que zero.');
  if (novoEstoque < 0) return mostrarErroMovimentacao('Estoque insuficiente para esta movimentação.');
  if (tipo.exigeMotivo && !motivo) return mostrarErroMovimentacao('Informe o motivo desta movimentação.');
  if (quantidade >= 10 && !confirm(`Confirmar movimentação de ${quantidade} unidades?`)) return;

  try {
    estado.salvando = true;
    elementos.confirmarMovimentacaoBtn.disabled = true;
    elementos.confirmarMovimentacaoBtn.textContent = 'Movimentando...';
    const resultado = await movimentarEstoque(estado.produtoMovimentando.id, diferenca, tipoValor, motivo);
    fecharDialog(elementos.movimentacaoDialog);
    mostrarMensagem(`Movimentação realizada. Novo estoque: ${resultado.quantidade_nova}.`, 'success');
    await Promise.all([carregarProdutos(), carregarResumoMes(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarErroMovimentacao(traduzirErro(erro));
  } finally {
    estado.salvando = false;
    elementos.confirmarMovimentacaoBtn.disabled = false;
    elementos.confirmarMovimentacaoBtn.textContent = 'Confirmar movimentação';
  }
}

function mostrarErroMovimentacao(mensagem) {
  elementos.movimentacaoErro.textContent = mensagem;
  elementos.movimentacaoErro.hidden = false;
}

function abrirCadastroVariacoes() {
  elementos.variacoesForm.reset();
  elementos.variacaoEstoqueMinimo.value = '3';
  elementos.variacoesFormErro.hidden = true;
  estado.coresCadastro = [];
  estado.tamanhosCadastro = [];
  estado.quantidadesMatriz.clear();
  renderizarSeletoresVariacao();
  renderizarMatriz();
  abrirDialog(elementos.variacoesDialog);
  elementos.variacaoNome.focus();
}

function adicionarTokenComEnter(evento, tipo) {
  if (evento.key !== 'Enter') return;
  evento.preventDefault();
  adicionarTokenCadastro(tipo);
}

function adicionarTokenCadastro(tipo, valorInformado = null) {
  const input = tipo === 'cor' ? elementos.variacaoCorInput : elementos.variacaoTamanhoInput;
  const lista = tipo === 'cor' ? estado.coresCadastro : estado.tamanhosCadastro;
  const valor = normalizarTexto(valorInformado ?? input.value);
  if (!valor) return;

  if (lista.some((item) => normalizarBusca(item) === normalizarBusca(valor))) {
    mostrarErroVariacoes(`${tipo === 'cor' ? 'Cor' : 'Tamanho'} já adicionado neste cadastro.`);
    return;
  }

  lista.push(valor);
  input.value = '';
  elementos.variacoesFormErro.hidden = true;
  renderizarSeletoresVariacao();
  renderizarMatriz();
  input.focus();
}

function removerTokenCadastro(evento) {
  const botao = evento.target.closest('[data-remove-token]');
  if (!botao) return;
  const lista = botao.dataset.tokenType === 'cor' ? estado.coresCadastro : estado.tamanhosCadastro;
  lista.splice(Number(botao.dataset.removeToken), 1);
  renderizarSeletoresVariacao();
  renderizarMatriz();
}

function selecionarSugestaoToken(evento) {
  const botao = evento.target.closest('[data-token-suggestion]');
  if (!botao) return;
  adicionarTokenCadastro(botao.dataset.tokenType, botao.dataset.tokenSuggestion);
}

function renderizarSeletoresVariacao() {
  elementos.coresSelecionadas.innerHTML = montarTokens(estado.coresCadastro, 'cor');
  elementos.tamanhosSelecionados.innerHTML = montarTokens(estado.tamanhosCadastro, 'tamanho');
  elementos.coresSugestoes.innerHTML = montarSugestoesTokens(valoresUnicos(estado.produtos, 'cor'), estado.coresCadastro, 'cor');
  elementos.tamanhosSugestoes.innerHTML = montarSugestoesTokens(valoresUnicos(estado.produtos, 'tamanho'), estado.tamanhosCadastro, 'tamanho');
}

function montarTokens(lista, tipo) {
  return lista.map((valor, indice) => `
    <span class="token">${escaparHtml(valor)}<button type="button" data-token-type="${tipo}" data-remove-token="${indice}" aria-label="Remover ${escaparHtml(valor)}">×</button></span>
  `).join('');
}

function montarSugestoesTokens(opcoes, selecionados, tipo) {
  return opcoes.slice(0, 18).map((valor) => {
    const selecionado = selecionados.some((item) => normalizarBusca(item) === normalizarBusca(valor));
    return `<button class="option-chip${selecionado ? ' selected' : ''}" type="button" data-token-type="${tipo}" data-token-suggestion="${escaparHtml(valor)}"${selecionado ? ' disabled' : ''}>${escaparHtml(valor)}</button>`;
  }).join('');
}

function renderizarMatriz() {
  const pronta = estado.coresCadastro.length > 0 && estado.tamanhosCadastro.length > 0;
  elementos.matrizVazia.hidden = pronta;
  elementos.matrizContainer.hidden = !pronta;
  if (!pronta) {
    elementos.matrizContainer.innerHTML = '';
    return;
  }

  elementos.matrizContainer.innerHTML = `
    <table class="variation-matrix">
      <thead><tr><th>Cor</th>${estado.tamanhosCadastro.map((tamanho) => `<th>${escaparHtml(tamanho)}</th>`).join('')}</tr></thead>
      <tbody>
        ${estado.coresCadastro.map((cor) => `
          <tr>
            <td>${escaparHtml(cor)}</td>
            ${estado.tamanhosCadastro.map((tamanho) => {
              const chave = chaveMatriz(cor, tamanho);
              const valor = estado.quantidadesMatriz.get(chave) ?? 0;
              return `<td><input type="number" min="0" step="1" inputmode="numeric" value="${valor}" data-matrix-key="${escaparHtml(chave)}" aria-label="Quantidade ${escaparHtml(cor)} ${escaparHtml(tamanho)}"></td>`;
            }).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function chaveMatriz(cor, tamanho) {
  return `${normalizarTexto(cor)}::${normalizarTexto(tamanho)}`;
}

function aoAlterarMatriz(evento) {
  const input = evento.target.closest('[data-matrix-key]');
  if (!input) return;
  estado.quantidadesMatriz.set(input.dataset.matrixKey, input.value);
}

function lerVariacoesDaMatriz() {
  const base = lerProdutoBaseVariacoes();
  if (!base) return null;
  if (estado.coresCadastro.length === 0) return mostrarErroVariacoes('Adicione pelo menos uma cor.');
  if (estado.tamanhosCadastro.length === 0) return mostrarErroVariacoes('Adicione pelo menos um tamanho.');

  const variacoes = [];
  for (const cor of estado.coresCadastro) {
    for (const tamanho of estado.tamanhosCadastro) {
      const valor = estado.quantidadesMatriz.get(chaveMatriz(cor, tamanho)) ?? 0;
      const quantidade = Number(valor);
      if (!Number.isInteger(quantidade) || quantidade < 0) {
        return mostrarErroVariacoes(`Quantidade inválida para ${cor} • ${tamanho}.`);
      }
      if (quantidade > 0) variacoes.push({ ...base, cor, tamanho, quantidade });
    }
  }

  if (variacoes.length === 0) return mostrarErroVariacoes('Informe quantidade maior que zero em pelo menos uma variação.');
  return variacoes;
}

function lerProdutoBaseVariacoes() {
  const nome = normalizarTexto(elementos.variacaoNome.value);
  const categoria = normalizarTexto(elementos.variacaoCategoria.value);
  const valorTexto = elementos.variacaoValor.value;
  const estoqueMinimo = Number(elementos.variacaoEstoqueMinimo.value);

  if (!nome) return mostrarErroVariacoes('Informe o nome do produto.');
  if (!categoria) return mostrarErroVariacoes('Informe a categoria.');
  if (valorTexto !== '' && (Number.isNaN(Number(valorTexto)) || Number(valorTexto) < 0)) return mostrarErroVariacoes('Informe um valor de venda válido.');
  if (!Number.isInteger(estoqueMinimo) || estoqueMinimo < 0) return mostrarErroVariacoes('Informe um estoque mínimo válido.');

  return {
    nome,
    categoria,
    subcategoria: normalizarTexto(elementos.variacaoSubcategoria.value),
    descricao: normalizarTexto(elementos.variacaoDescricao.value),
    valorVenda: valorTexto === '' ? null : Number(valorTexto),
    estoqueMinimo
  };
}

function mostrarErroVariacoes(mensagem) {
  elementos.variacoesFormErro.textContent = mensagem;
  elementos.variacoesFormErro.hidden = false;
  return null;
}

async function aoSalvarVariacoes(evento) {
  evento.preventDefault();
  if (estado.salvando) return;
  const variacoes = lerVariacoesDaMatriz();
  if (!variacoes) return;

  try {
    definirSalvandoVariacoes(true);
    let resultado = await cadastrarVariacoes(variacoes, false);
    if (resultado.status === 'duplicados') {
      const escolha = await confirmarDuplicados(resultado.duplicados);
      if (escolha !== 'somar') return;
      resultado = await cadastrarVariacoes(variacoes, true);
    }

    fecharDialog(elementos.variacoesDialog);
    mostrarMensagem(mensagemResultadoCadastro(resultado), 'success');
    await Promise.all([carregarProdutos(), carregarResumoMes(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarErroVariacoes(traduzirErro(erro));
  } finally {
    definirSalvandoVariacoes(false);
  }
}

function definirSalvandoVariacoes(salvando) {
  estado.salvando = salvando;
  elementos.salvarVariacoesBtn.disabled = salvando;
  elementos.salvarVariacoesBtn.textContent = salvando ? 'Cadastrando...' : 'Cadastrar variações';
}

function mensagemResultadoCadastro(resultado) {
  const partes = [];
  if (resultado.criados) partes.push(`${resultado.criados} ${resultado.criados === 1 ? 'variação cadastrada' : 'variações cadastradas'}`);
  if (resultado.atualizados) partes.push(`${resultado.atualizados} ${resultado.atualizados === 1 ? 'estoque atualizado' : 'estoques atualizados'}`);
  return `${partes.join(' e ') || 'Cadastro concluído'}.`;
}

function confirmarDuplicados(duplicados) {
  const temArquivado = duplicados.some((item) => !item.ativo);
  elementos.duplicadosLista.innerHTML = duplicados.map((item) => `
    <article class="duplicate-item${item.ativo ? '' : ' archived'}">
      <h3>${escaparHtml(item.nome)}</h3>
      <p>${escaparHtml([item.cor, item.tamanho].filter(Boolean).join(' • '))}</p>
      <p>Estoque atual: <strong>${item.quantidade_atual}</strong> • Adicionar: <strong>${item.quantidade_adicionar}</strong> • Novo total: <strong>${Number(item.quantidade_atual) + Number(item.quantidade_adicionar)}</strong></p>
      ${item.ativo ? '' : '<p><strong>Esta variação está arquivada. Restaure-a antes de cadastrar novamente.</strong></p>'}
    </article>
  `).join('');
  elementos.somarDuplicadosBtn.disabled = temArquivado;
  abrirDialog(elementos.duplicadosDialog);

  return new Promise((resolver) => {
    estado.resolverDuplicados = resolver;
  });
}

function aoResponderDuplicados(evento) {
  const botao = evento.target.closest('[data-duplicate-choice]');
  if (!botao || !estado.resolverDuplicados) return;
  const resolver = estado.resolverDuplicados;
  estado.resolverDuplicados = null;
  fecharDialog(elementos.duplicadosDialog);
  resolver(botao.dataset.duplicateChoice);
}

function abrirCadastroPorLinhas() {
  fecharDialog(elementos.variacoesDialog);
  estado.produtoEditando = null;
  elementos.produtoFormTitulo.textContent = 'Novos produtos por linhas';
  elementos.produtoFormErro.hidden = true;
  elementos.produtosFormLista.innerHTML = '';
  estado.proximaLinhaId = 1;
  adicionarLinhaProduto({ quantidade: 0 }, false);
  atualizarBotoesLinhas();
  abrirDialog(elementos.produtoDialog);
}

function abrirEdicaoProduto(produto) {
  estado.produtoEditando = produto;
  elementos.produtoFormTitulo.textContent = 'Editar produto';
  elementos.produtoFormErro.hidden = true;
  elementos.produtosFormLista.innerHTML = '';
  estado.proximaLinhaId = 1;
  adicionarLinhaProduto({
    nome: produto.nome,
    descricao: produto.descricao,
    subcategoria: produto.subcategoria,
    categoria: produto.categoria,
    cor: produto.cor,
    tamanho: produto.tamanho,
    quantidade: produto.quantidade,
    valorVenda: produto.valor_venda,
    estoqueMinimo: produto.estoque_minimo
  }, false, true);
  atualizarBotoesLinhas();
  abrirDialog(elementos.produtoDialog);
}

function adicionarLinhaProduto(valores = {}, focar = true, forcar = false) {
  const linhas = obterLinhasProduto();
  if (!forcar && (estado.produtoEditando || linhas.length >= LIMITE_LINHAS)) return;
  const id = estado.proximaLinhaId++;
  elementos.produtosFormLista.insertAdjacentHTML('beforeend', montarLinhaProduto(id, valores));
  atualizarLinhasProduto();
  if (focar) obterLinhasProduto().at(-1)?.querySelector('[data-field="nome"]')?.focus();
}

function montarLinhaProduto(id, valores) {
  const somenteLeitura = estado.produtoEditando ? ' readonly title="Use Movimentar estoque para alterar a quantidade"' : '';
  return `
    <article class="product-form-card" data-product-row>
      <div class="product-form-header">
        <h3>Produto</h3>
        <button class="button danger-text-button compact-button" type="button" data-remove-row>Remover</button>
      </div>
      <div class="form-grid">
        ${campoLinha(id, 'nome', 'Nome do produto', valores.nome, true)}
        ${campoLinha(id, 'descricao', 'Descrição', valores.descricao)}
        ${campoLinha(id, 'categoria', 'Categoria', valores.categoria, true, 'categorias-datalist')}
        ${campoLinha(id, 'subcategoria', 'Subcategoria', valores.subcategoria, false, 'subcategorias-datalist')}
        ${campoLinha(id, 'cor', 'Cor', valores.cor, true, 'cores-datalist')}
        ${campoLinha(id, 'tamanho', 'Tamanho', valores.tamanho, false, 'tamanhos-datalist')}
        <label for="linha-${id}-quantidade">Quantidade
          <input id="linha-${id}-quantidade" data-field="quantidade" type="number" min="0" step="1" value="${escaparHtml(valores.quantidade ?? 0)}"${somenteLeitura}>
        </label>
        <label for="linha-${id}-valorVenda">Valor de venda
          <input id="linha-${id}-valorVenda" data-field="valorVenda" type="number" min="0" step="0.01" value="${escaparHtml(valores.valorVenda ?? '')}">
        </label>
        <label for="linha-${id}-estoqueMinimo">Estoque mínimo
          <input id="linha-${id}-estoqueMinimo" data-field="estoqueMinimo" type="number" min="0" step="1" value="${escaparHtml(valores.estoqueMinimo ?? 3)}">
        </label>
      </div>
    </article>
  `;
}

function campoLinha(id, campo, rotulo, valor = '', obrigatorio = false, lista = '') {
  return `<label for="linha-${id}-${campo}">${rotulo}
    <input id="linha-${id}-${campo}" data-field="${campo}" type="text" maxlength="160" value="${escaparHtml(valor ?? '')}"${lista ? ` list="${lista}"` : ''}${obrigatorio ? ' required' : ''}>
  </label>`;
}

function obterLinhasProduto() {
  return $$('[data-product-row]');
}

function atualizarLinhasProduto() {
  obterLinhasProduto().forEach((linha, indice) => {
    linha.querySelector('h3').textContent = `Produto ${indice + 1}`;
    linha.querySelector('[data-remove-row]').hidden = Boolean(estado.produtoEditando) || indice === 0;
  });
  atualizarBotoesLinhas();
}

function atualizarBotoesLinhas() {
  const total = obterLinhasProduto().length;
  elementos.rowTools.hidden = Boolean(estado.produtoEditando);
  elementos.adicionarProdutoLinhaBtn.disabled = total >= LIMITE_LINHAS || estado.salvando;
  elementos.copiarProdutoLinhaBtn.disabled = total >= LIMITE_LINHAS || total === 0 || estado.salvando;
  elementos.salvarProdutoBtn.textContent = estado.produtoEditando ? 'Salvar alterações' : 'Cadastrar produtos';
}

function copiarLinhaProduto() {
  const ultima = obterLinhasProduto().at(-1);
  if (!ultima) return;
  adicionarLinhaProduto(lerLinhaProduto(ultima));
}

function aoClicarFormularioLinhas(evento) {
  const botao = evento.target.closest('[data-remove-row]');
  if (!botao || estado.produtoEditando) return;
  botao.closest('[data-product-row]')?.remove();
  atualizarLinhasProduto();
}

function lerLinhaProduto(linha) {
  const dados = {};
  linha.querySelectorAll('[data-field]').forEach((campo) => {
    dados[campo.dataset.field] = campo.value;
  });
  return dados;
}

function validarLinhaProduto(dados, indice) {
  const produto = {
    nome: normalizarTexto(dados.nome),
    descricao: normalizarTexto(dados.descricao),
    categoria: normalizarTexto(dados.categoria),
    subcategoria: normalizarTexto(dados.subcategoria),
    cor: normalizarTexto(dados.cor),
    tamanho: normalizarTexto(dados.tamanho),
    quantidade: Number(dados.quantidade),
    valorVenda: dados.valorVenda === '' ? null : Number(dados.valorVenda),
    estoqueMinimo: Number(dados.estoqueMinimo)
  };

  if (!produto.nome || !produto.categoria || !produto.cor) throw new Error(`Preencha nome, categoria e cor no produto ${indice + 1}.`);
  if (!Number.isInteger(produto.quantidade) || produto.quantidade < 0) throw new Error(`Quantidade inválida no produto ${indice + 1}.`);
  if (produto.valorVenda !== null && (Number.isNaN(produto.valorVenda) || produto.valorVenda < 0)) throw new Error(`Valor inválido no produto ${indice + 1}.`);
  if (!Number.isInteger(produto.estoqueMinimo) || produto.estoqueMinimo < 0) throw new Error(`Estoque mínimo inválido no produto ${indice + 1}.`);
  return produto;
}

async function aoSalvarProdutosPorLinha(evento) {
  evento.preventDefault();
  if (estado.salvando) return;

  try {
    const produtos = obterLinhasProduto().map((linha, indice) => validarLinhaProduto(lerLinhaProduto(linha), indice));
    elementos.produtoFormErro.hidden = true;
    estado.salvando = true;
    elementos.salvarProdutoBtn.disabled = true;
    elementos.salvarProdutoBtn.textContent = 'Salvando...';

    if (estado.produtoEditando) {
      const produto = produtos[0];
      const duplicado = estado.todosProdutos.find((item) => item.id !== estado.produtoEditando.id && chaveVariacao(item) === chaveVariacao(produto));
      if (duplicado) throw new Error('Já existe outra variação com o mesmo nome, categoria, subcategoria, cor e tamanho.');
      await editarProduto(estado.produtoEditando.id, produto);
      mostrarMensagem('Produto editado com sucesso.', 'success');
    } else {
      let resultado = await criarProdutos(produtos, false);
      if (resultado.status === 'duplicados') {
        const escolha = await confirmarDuplicados(resultado.duplicados);
        if (escolha !== 'somar') return;
        resultado = await criarProdutos(produtos, true);
      }
      mostrarMensagem(mensagemResultadoCadastro(resultado), 'success');
    }

    fecharDialog(elementos.produtoDialog);
    await Promise.all([carregarProdutos(), carregarResumoMes(), carregarHistorico(true)]);
  } catch (erro) {
    elementos.produtoFormErro.textContent = traduzirErro(erro);
    elementos.produtoFormErro.hidden = false;
  } finally {
    estado.salvando = false;
    elementos.salvarProdutoBtn.disabled = false;
    atualizarBotoesLinhas();
  }
}

async function arquivarProduto(produto) {
  if (!confirm(`Arquivar ${produto.nome} - ${produto.cor} ${produto.tamanho}?`)) return;
  try {
    mostrarCarregamento(true, 'Arquivando produto...');
    await definirProdutoArquivado(produto.id, true);
    mostrarMensagem('Produto arquivado.', 'success');
    await Promise.all([carregarProdutos(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    mostrarCarregamento(false);
  }
}

async function restaurarProduto(produto) {
  try {
    mostrarCarregamento(true, 'Restaurando produto...');
    await definirProdutoArquivado(produto.id, false);
    mostrarMensagem('Produto restaurado.', 'success');
    await Promise.all([carregarProdutos(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    mostrarCarregamento(false);
  }
}

async function excluirPermanentemente(produto) {
  const confirmacao = prompt(`Esta ação não poderá ser desfeita. Digite EXCLUIR para apagar permanentemente ${produto.nome}.`);
  if (confirmacao !== 'EXCLUIR') return;
  try {
    mostrarCarregamento(true, 'Excluindo produto...');
    await excluirProdutoPermanentemente(produto.id);
    mostrarMensagem('Produto excluído permanentemente. O histórico foi preservado.', 'success');
    await Promise.all([carregarProdutos(), carregarHistorico(true)]);
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    mostrarCarregamento(false);
  }
}

function renderizarArquivados() {
  const termo = normalizarBusca(estado.buscaArquivados);
  const produtos = estado.arquivados.filter((produto) => normalizarBusca([
    produto.nome, produto.categoria, produto.subcategoria, produto.cor, produto.tamanho
  ].join(' ')).includes(termo));
  elementos.arquivadosVazio.hidden = produtos.length > 0;
  elementos.arquivadosLista.innerHTML = produtos.map((produto) => `
    <article class="product-card archived" data-id="${escaparHtml(produto.id)}">
      <div class="product-main">
        <div class="card-top">
          <div><h3>${escaparHtml(produto.nome)}</h3><p>${escaparHtml([produto.cor, produto.tamanho].filter(Boolean).join(' • '))}</p></div>
        </div>
        <div class="tags">${montarTag(produto.categoria)}${produto.subcategoria ? montarTag(produto.subcategoria) : ''}</div>
        <p class="stock-line"><strong>${produto.quantidade}</strong><span>unidades preservadas</span></p>
      </div>
      <details class="card-menu">
        <summary aria-label="Opções do produto arquivado">⋯</summary>
        <div class="menu-content">
          <button type="button" data-action="restaurar" data-id="${escaparHtml(produto.id)}">Restaurar produto</button>
          <button class="danger-menu-item" type="button" data-action="excluir-permanente" data-id="${escaparHtml(produto.id)}">Excluir permanentemente</button>
        </div>
      </details>
    </article>
  `).join('');
}

function configurarFiltrosHistorico() {
  [
    elementos.historicoInicio,
    elementos.historicoFim,
    elementos.historicoProduto,
    elementos.historicoCategoria,
    elementos.historicoUsuario,
    elementos.historicoTipo,
    elementos.historicoBusca
  ].forEach((campo) => {
    const evento = campo.tagName === 'SELECT' || campo.type === 'date' ? 'change' : 'input';
    campo.addEventListener(evento, agendarFiltroHistorico);
  });

  $$('[data-period]').forEach((botao) => {
    botao.addEventListener('click', () => aplicarPeriodoHistorico(botao.dataset.period));
  });
}

function agendarFiltroHistorico() {
  clearTimeout(estado.historico.timer);
  estado.historico.timer = setTimeout(() => carregarHistorico(true), 350);
}

function aplicarPeriodoHistorico(periodo) {
  const hoje = new Date();
  let inicio = null;
  let fim = hoje;

  if (periodo === 'hoje') inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (periodo === 'semana') {
    const dia = hoje.getDay() || 7;
    inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - dia + 1);
  }
  if (periodo === 'mes') inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (periodo === 'todos') fim = null;

  elementos.historicoInicio.value = inicio ? dataParaInput(inicio) : '';
  elementos.historicoFim.value = fim ? dataParaInput(fim) : '';
  $$('[data-period]').forEach((botao) => botao.classList.toggle('active', botao.dataset.period === periodo));
  carregarHistorico(true);
}

function dataParaInput(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function lerFiltrosHistorico() {
  const inicio = elementos.historicoInicio.value ? new Date(`${elementos.historicoInicio.value}T00:00:00`).toISOString() : '';
  const fim = elementos.historicoFim.value ? new Date(`${elementos.historicoFim.value}T23:59:59.999`).toISOString() : '';
  return {
    inicio,
    fim,
    produto: elementos.historicoProduto.value,
    categoria: elementos.historicoCategoria.value,
    usuario: elementos.historicoUsuario.value,
    tipo: elementos.historicoTipo.value,
    busca: elementos.historicoBusca.value
  };
}

async function carregarHistorico(reiniciar = true) {
  if (!estado.usuario) return;
  try {
    if (reiniciar) {
      estado.historico.pagina = 0;
      estado.historico.itens = [];
      estado.historico.filtros = lerFiltrosHistorico();
    } else {
      estado.historico.pagina += 1;
    }

    elementos.carregarMaisHistoricoBtn.disabled = true;
    const resposta = await listarMovimentacoes({
      pagina: estado.historico.pagina,
      limite: LIMITE_HISTORICO,
      filtros: estado.historico.filtros
    });
    estado.historico.itens.push(...resposta.itens);
    estado.historico.total = resposta.total;
    renderizarHistorico();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    elementos.carregarMaisHistoricoBtn.disabled = false;
  }
}

function renderizarHistorico() {
  const itens = estado.historico.itens;
  elementos.historicoVazio.hidden = itens.length > 0;
  elementos.carregarMaisHistoricoBtn.hidden = itens.length >= estado.historico.total;
  elementos.historicoLista.innerHTML = itens.map(montarItemHistorico).join('');
}

function montarItemHistorico(item) {
  const diferenca = Number(item.diferenca);
  const classe = diferenca > 0 ? 'positive' : diferenca < 0 ? 'negative' : 'neutral';
  const sinal = diferenca > 0 ? '+' : '';
  const responsavel = item.usuario_nome || item.usuario_email || 'Usuário autenticado';
  return `
    <article class="history-item">
      <div class="history-delta ${classe}">${sinal}${diferenca}</div>
      <div class="history-main">
        <span class="history-type">${escaparHtml(rotuloTipoMovimentacao(item.tipo))}</span>
        <h3>${escaparHtml(item.produto_nome)}</h3>
        ${item.produto_cor || item.produto_tamanho ? `<p>${escaparHtml([item.produto_cor, item.produto_tamanho].filter(Boolean).join(' • '))}</p>` : ''}
        <p>Estoque: <strong>${item.quantidade_anterior} → ${item.quantidade_nova}</strong></p>
        ${item.motivo ? `<p>Motivo: ${escaparHtml(item.motivo)}</p>` : ''}
        <small>Responsável: ${escaparHtml(responsavel)}</small>
      </div>
      <time class="history-date" datetime="${escaparHtml(item.created_at)}">${formatarDataHora(item.created_at)}</time>
    </article>
  `;
}

function rotuloTipoMovimentacao(tipo) {
  const rotulos = {
    cadastro: 'Cadastro', entrada: 'Entrada', saida: 'Saída', venda: 'Venda',
    devolucao: 'Devolução', troca_entrada: 'Troca - entrada', troca_saida: 'Troca - saída',
    perda_avaria: 'Perda/Avaria', ajuste_manual: 'Ajuste manual',
    ajuste_conferencia: 'Ajuste de conferência', edicao: 'Edição',
    arquivamento: 'Arquivamento', restauracao: 'Restauração', exclusao: 'Exclusão'
  };
  return rotulos[tipo] ?? tipo;
}

async function carregarConferencia() {
  if (!estado.usuario) return;
  try {
    const conferencia = await obterConferenciaAberta();
    if (!conferencia) {
      estado.conferencia = { dados: null, itens: [], indice: 0, busca: '' };
      renderizarConferencia();
      return;
    }
    estado.conferencia.dados = conferencia;
    estado.conferencia.itens = await listarItensConferencia(conferencia.id);
    estado.conferencia.indice = Math.max(0, estado.conferencia.itens.findIndex((item) => item.quantidade_contada === null));
    renderizarConferencia();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

async function aoIniciarConferencia() {
  try {
    mostrarCarregamento(true, 'Preparando a conferência...');
    const resultado = await iniciarConferencia();
    estado.conferencia.dados = { id: resultado.id, status: 'em_andamento' };
    estado.conferencia.itens = await listarItensConferencia(resultado.id);
    estado.conferencia.indice = 0;
    mostrarMensagem(resultado.resumida ? 'Conferência em andamento retomada.' : 'Conferência iniciada.', 'success');
    renderizarConferencia();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    mostrarCarregamento(false);
  }
}

function renderizarConferencia() {
  const ativa = Boolean(estado.conferencia.dados);
  elementos.conferenciaInicio.hidden = ativa;
  elementos.conferenciaAtiva.hidden = !ativa;
  if (!ativa) return;

  const total = estado.conferencia.itens.length;
  const conferidos = estado.conferencia.itens.filter((item) => item.quantidade_contada !== null).length;
  const percentual = total ? Math.round((conferidos / total) * 100) : 0;
  elementos.conferenciaProgressoTexto.textContent = `${conferidos} de ${total} produtos conferidos`;
  elementos.conferenciaProgressoBarra.style.width = `${percentual}%`;

  if (conferidos === total && total > 0) {
    renderizarResumoConferencia();
  } else {
    elementos.conferenciaResumo.hidden = true;
  }
  renderizarItemConferencia();
}

function itensVisiveisConferencia() {
  const termo = normalizarBusca(estado.conferencia.busca);
  if (!termo) return estado.conferencia.itens;
  return estado.conferencia.itens.filter((item) => {
    const produto = item.produtos ?? {};
    return normalizarBusca([produto.nome, produto.cor, produto.tamanho, produto.categoria].join(' ')).includes(termo);
  });
}

function renderizarItemConferencia() {
  const itens = itensVisiveisConferencia();
  if (itens.length === 0) {
    elementos.conferenciaItem.innerHTML = '<p class="empty-state">Nenhum produto corresponde à pesquisa.</p>';
    elementos.conferenciaAnteriorBtn.disabled = true;
    elementos.conferenciaProximoBtn.disabled = true;
    return;
  }

  const atualOriginal = estado.conferencia.itens[estado.conferencia.indice];
  let posicao = itens.indexOf(atualOriginal);
  if (posicao < 0) {
    posicao = 0;
    estado.conferencia.indice = estado.conferencia.itens.indexOf(itens[0]);
  }
  const item = itens[posicao];
  const produto = item.produtos ?? {};
  elementos.conferenciaItem.innerHTML = `
    <div class="conference-item-main">
      <p class="eyebrow">Produto ${posicao + 1} de ${itens.length}</p>
      <h2>${escaparHtml(produto.nome ?? 'Produto indisponível')}</h2>
      <p>${escaparHtml([produto.cor, produto.tamanho].filter(Boolean).join(' • '))}</p>
      <p class="conference-system-qty">Quantidade no início da conferência: <strong>${item.quantidade_sistema}</strong></p>
    </div>
    <label class="conference-count-field" for="quantidade-contada-atual">Quantidade encontrada
      <input id="quantidade-contada-atual" type="number" min="0" step="1" inputmode="numeric" value="${item.quantidade_contada ?? ''}" autocomplete="off">
    </label>
  `;
  elementos.conferenciaAnteriorBtn.disabled = posicao === 0;
  elementos.conferenciaProximoBtn.disabled = false;
  elementos.conferenciaProximoBtn.textContent = posicao === itens.length - 1 ? 'Salvar contagem' : 'Salvar e próximo';
}

async function salvarEAvancarConferencia() {
  const itens = itensVisiveisConferencia();
  const itemAtual = estado.conferencia.itens[estado.conferencia.indice];
  const posicao = itens.indexOf(itemAtual);
  const input = $('#quantidade-contada-atual');
  const quantidade = Number(input?.value);
  if (!input || input.value === '' || !Number.isInteger(quantidade) || quantidade < 0) {
    mostrarMensagem('Informe a quantidade física encontrada.', 'error');
    input?.focus();
    return;
  }

  try {
    elementos.conferenciaProximoBtn.disabled = true;
    const salvo = await salvarContagemItem(itemAtual.id, quantidade);
    itemAtual.quantidade_contada = salvo.quantidade_contada;
    itemAtual.conferido_em = salvo.conferido_em;
    if (posicao < itens.length - 1) {
      estado.conferencia.indice = estado.conferencia.itens.indexOf(itens[posicao + 1]);
    } else {
      const proximoNaoConferido = estado.conferencia.itens.findIndex((item) => item.quantidade_contada === null);
      if (proximoNaoConferido >= 0) estado.conferencia.indice = proximoNaoConferido;
    }
    if (estado.conferencia.itens.every((item) => item.quantidade_contada !== null)) {
      estado.conferencia.itens = await listarItensConferencia(estado.conferencia.dados.id);
    }
    mostrarMensagem('Contagem salva.', 'success');
    renderizarConferencia();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    elementos.conferenciaProximoBtn.disabled = false;
  }
}

function navegarConferencia(direcao) {
  const itens = itensVisiveisConferencia();
  const atual = estado.conferencia.itens[estado.conferencia.indice];
  const posicao = itens.indexOf(atual);
  const novaPosicao = Math.min(Math.max(posicao + direcao, 0), itens.length - 1);
  estado.conferencia.indice = estado.conferencia.itens.indexOf(itens[novaPosicao]);
  renderizarItemConferencia();
}

function aoBuscarNaConferencia() {
  estado.conferencia.busca = elementos.conferenciaBusca.value;
  renderizarItemConferencia();
}

function renderizarResumoConferencia() {
  const itens = estado.conferencia.itens;
  const divergencias = itens.filter((item) => Number(item.quantidade_contada) !== Number(item.produtos?.quantidade ?? item.quantidade_sistema));
  elementos.conferenciaResumo.hidden = false;
  elementos.conferenciaResumoMetricas.innerHTML = `
    <div><span>Conferidos</span><strong>${itens.length}</strong></div>
    <div><span>Sem diferença</span><strong>${itens.length - divergencias.length}</strong></div>
    <div><span>Com diferença</span><strong>${divergencias.length}</strong></div>
  `;
  elementos.conferenciaDivergencias.innerHTML = divergencias.length ? divergencias.map((item) => {
    const sistemaAtual = Number(item.produtos?.quantidade ?? item.quantidade_sistema);
    const diferenca = Number(item.quantidade_contada) - sistemaAtual;
    return `
      <article class="difference-item">
        <div><h3>${escaparHtml(item.produtos?.nome ?? '')}</h3><p>${escaparHtml([item.produtos?.cor, item.produtos?.tamanho].filter(Boolean).join(' • '))}</p><p>Sistema atual: ${sistemaAtual} • Encontrado: ${item.quantidade_contada}</p></div>
        <span class="difference-value">${diferenca > 0 ? '+' : ''}${diferenca}</span>
      </article>
    `;
  }).join('') : '<p class="empty-state">A contagem está igual ao sistema.</p>';
}

async function aoAplicarConferencia() {
  const divergencias = estado.conferencia.itens.filter((item) => Number(item.quantidade_contada) !== Number(item.produtos?.quantidade ?? item.quantidade_sistema));
  if (!confirm(`Aplicar ${divergencias.length} ajustes de estoque? Cada diferença será registrada no histórico.`)) return;
  try {
    mostrarCarregamento(true, 'Aplicando correções...');
    const resultado = await aplicarAjustesConferencia(estado.conferencia.dados.id);
    mostrarMensagem(`${resultado.ajustes} ajustes aplicados com sucesso.`, 'success');
    estado.conferencia = { dados: null, itens: [], indice: 0, busca: '' };
    await Promise.all([carregarProdutos(), carregarResumoMes(), carregarHistorico(true)]);
    renderizarConferencia();
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  } finally {
    mostrarCarregamento(false);
  }
}

async function aoCancelarConferencia() {
  if (!confirm('Cancelar esta conferência? As contagens salvas serão encerradas sem alterar o estoque.')) return;
  try {
    await cancelarConferencia(estado.conferencia.dados.id);
    estado.conferencia = { dados: null, itens: [], indice: 0, busca: '' };
    renderizarConferencia();
    mostrarMensagem('Conferência cancelada. O estoque não foi alterado.', 'success');
  } catch (erro) {
    mostrarMensagem(traduzirErro(erro), 'error');
  }
}

function iniciarRealtime() {
  pararRealtime();
  estado.cancelarRealtime = [
    observarProdutos(() => {
      clearTimeout(estado.timerProdutos);
      estado.timerProdutos = setTimeout(carregarProdutos, 250);
    }),
    observarMovimentacoes(() => {
      clearTimeout(estado.timerHistorico);
      estado.timerHistorico = setTimeout(() => {
        carregarResumoMes();
        if (estado.secao === 'historico') carregarHistorico(true);
      }, 250);
    })
  ];
}

function pararRealtime() {
  estado.cancelarRealtime.forEach((cancelar) => cancelar());
  estado.cancelarRealtime = [];
  clearTimeout(estado.timerProdutos);
  clearTimeout(estado.timerHistorico);
}

function abrirDialog(dialog) {
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.hidden = false;
}

function fecharDialog(dialog) {
  if (!dialog) return;
  if (dialog.open) dialog.close();
  else dialog.hidden = true;
}

function mostrarCarregamento(visivel, texto = 'Carregando...') {
  elementos.loadingText.textContent = texto;
  elementos.loadingOverlay.hidden = !visivel;
}

function mostrarMensagem(mensagem, tipo = 'info') {
  elementos.toast.textContent = mensagem;
  elementos.toast.className = `toast show ${tipo}`;
  clearTimeout(mostrarMensagem.timer);
  mostrarMensagem.timer = setTimeout(() => {
    elementos.toast.className = 'toast';
  }, 4000);
}

function traduzirErro(erro) {
  const mensagem = erro?.message ?? String(erro);
  if (mensagem.includes('Invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (mensagem.includes('Failed to fetch')) return 'Não foi possível conectar ao Supabase. Verifique sua internet e a configuração do projeto.';
  if (mensagem.includes('Could not find the function') || mensagem.includes('schema cache') || mensagem.includes('conferencias')) {
    return 'A atualização do banco ainda não foi aplicada. Execute o arquivo sql/2026-08-15-evolucao-estoque.sql no Supabase.';
  }
  if (mensagem.includes('Estoque insuficiente')) return mensagem.replace('Disponivel', 'Disponível');
  if (mensagem.includes('Usuario nao autenticado')) return 'Sua sessão expirou. Entre novamente.';
  return mensagem;
}
