# RPG Multimarcas - Controle de Estoque

Sistema web de estoque compartilhado da RPG Multimarcas. A aplicação foi desenhada para a rotina de uma loja de roupas: cadastro rápido de cores e tamanhos, movimentação segura, histórico auditável, conferência física e uso confortável no celular ou computador.

## Tecnologias

- HTML5 e CSS3 responsivo.
- JavaScript com módulos nativos, sem framework pesado.
- Supabase Auth para login por e-mail e senha.
- PostgreSQL/Supabase Database para produtos, movimentações e conferências.
- Supabase RPC para operações transacionais de estoque.
- Row Level Security para restringir o acesso a usuários autenticados.
- Supabase Realtime para sincronização entre os usuários.
- GitHub Pages para hospedagem do frontend.

## Funcionalidades

- Login restrito a usuários cadastrados no Supabase.
- Dashboard com total de peças, variações, estoque baixo, zerados, valor do estoque, entradas e saídas do mês.
- Produtos organizados automaticamente por categorias.
- Pesquisa e filtros gerais em todas as categorias.
- Filtros dentro de cada categoria.
- Visualização individual ou agrupada por modelo.
- Cadastro por matriz de cores e tamanhos.
- Cadastro por linhas mantido como alternativa, com cópia da linha anterior.
- Sugestões baseadas nos dados já existentes para categoria, subcategoria, cor e tamanho.
- Detecção de variações duplicadas, ignorando diferenças de caixa e espaços extras.
- Opção de somar a quantidade ao registro existente.
- Botões rápidos `+1` e `-1`.
- Modal para entrada, venda, devolução, troca, perda/avaria e ajuste manual.
- Bloqueio de estoque negativo.
- Histórico paginado com filtros por período, produto, categoria, usuário e tipo.
- Arquivamento e restauração de produtos sem apagar o histórico.
- Exclusão permanente somente para produtos arquivados e com confirmação forte.
- Conferência física com progresso salvo, busca, navegação, resumo de divergências e aplicação confirmada.
- Realtime para atualização entre os sócios.
- Navegação lateral no desktop e barra inferior no celular.

## Cadastro Por Variações

1. Preencha uma vez nome, categoria, subcategoria, descrição, valor e estoque mínimo.
2. Adicione todas as cores disponíveis.
3. Adicione todos os tamanhos disponíveis.
4. Informe as quantidades na matriz gerada automaticamente.
5. Confirme o cadastro.

Combinações com quantidade zero não são cadastradas. Isso evita criar registros sem necessidade. Se uma combinação já existir, o sistema mostra o estoque atual e a quantidade nova, oferecendo a opção de somar ao registro existente.

A chave lógica de uma variação é:

```text
nome + categoria + subcategoria + cor + tamanho
```

Esses textos são normalizados em letras maiúsculas e com espaços internos padronizados.

## Movimentação De Estoque

Toda alteração de quantidade passa pela função PostgreSQL `movimentar_estoque`.

A função:

1. valida o usuário autenticado;
2. bloqueia a linha do produto durante a operação;
3. calcula a nova quantidade no banco;
4. impede estoque negativo;
5. atualiza o produto;
6. grava o histórico com valor anterior, valor novo, diferença, tipo, motivo e usuário;
7. confirma tudo em uma única transação.

Os botões `+1` e `-1`, o modal de movimentação, a soma de duplicados e os ajustes de conferência usam essa arquitetura.

## Conferência

Ao iniciar uma conferência, o banco cria uma fotografia das quantidades dos produtos ativos. Cada contagem física é salva individualmente, portanto é possível sair e continuar depois.

Quando todos os itens forem contados, o sistema mostra:

- total conferido;
- produtos sem diferença;
- produtos com diferença;
- quantidade atual, encontrada e diferença de cada divergência.

O estoque não é alterado automaticamente. A correção só ocorre após a confirmação em **Aplicar correções**. Todos os ajustes são transacionais e registrados como `ajuste_conferencia`.

## Arquitetura

```text
estoque-rpg/
|-- assets/
|   `-- README.md
|-- css/
|   `-- style.css
|-- js/
|   |-- app.js
|   |-- auth.js
|   |-- conferencia.js
|   |-- historico.js
|   |-- movimentacoes.js
|   |-- produtos.js
|   |-- supabase-config.js
|   `-- utils.js
|-- sql/
|   |-- 2026-08-15-evolucao-estoque.sql
|   |-- adicionar-subcategoria-valor.sql
|   `-- padronizar-produtos-maiusculas.sql
|-- index.html
`-- README.md
```

Responsabilidades principais:

- `app.js`: estado da interface, navegação e coordenação dos fluxos.
- `produtos.js`: leitura, cadastro, edição e arquivamento de produtos.
- `movimentacoes.js`: chamada única à RPC de movimentação.
- `historico.js`: filtros, paginação e leitura das movimentações.
- `conferencia.js`: criação, salvamento e aplicação da conferência.
- `auth.js`: sessão, login e logout.
- `utils.js`: normalização, formatação e segurança de HTML.

## Banco De Dados

### Atualização obrigatória do banco existente

Antes de publicar esta versão, execute no **Supabase > SQL Editor** o arquivo completo:

```text
sql/2026-08-15-evolucao-estoque.sql
```

A migration usa `ALTER TABLE`, `CREATE TABLE`, `CREATE INDEX` e `CREATE OR REPLACE FUNCTION`. Ela não apaga produtos, movimentações ou usuários existentes.

Novas colunas em `produtos`:

- `ativo`
- `arquivado_em`
- `estoque_minimo`

Novas colunas em `movimentacoes`:

- `diferenca`
- `motivo`
- `usuario_nome`
- `produto_categoria`
- `produto_subcategoria`
- `produto_cor`
- `produto_tamanho`

Novas tabelas:

- `conferencias`
- `conferencia_itens`

Novas funções RPC:

- `movimentar_estoque`
- `cadastrar_variacoes`
- `editar_produto`
- `definir_produto_arquivado`
- `excluir_produto_permanentemente`
- `iniciar_conferencia`
- `cancelar_conferencia`
- `aplicar_ajustes_conferencia`

Principais medidas de segurança:

- leitura permitida apenas para o papel `authenticated`;
- inserção e exclusão direta de produtos removidas do navegador;
- alteração direta da coluna `quantidade` removida do navegador;
- funções RPC liberadas apenas para usuários autenticados;
- trigger de normalização e prevenção de novas variações duplicadas;
- movimentação com bloqueio de linha e transação atômica;
- histórico e conferências protegidos por RLS.

### Conferência depois da migration

O final do arquivo SQL contém consultas opcionais para verificar produtos ativos e tipos do histórico. Também é recomendável abrir o sistema e confirmar:

1. os produtos antigos continuam visíveis;
2. o histórico antigo continua disponível;
3. `+1` e `-1` atualizam a quantidade;
4. a movimentação aparece no histórico com usuário e diferença.

## Identidade Visual

Coloque os arquivos oficiais na pasta `assets`:

```text
assets/logo-rpg.png
assets/favicon.png
assets/app-icon.png
```

Nenhuma logo provisória foi inventada. Sem `logo-rpg.png`, a aplicação mostra o nome textual **RPG Multimarcas**.

## Execução Local

Como o projeto usa módulos JavaScript, execute-o por um servidor local.

Com Python:

```bash
python -m http.server 5500
```

Depois acesse:

```text
http://127.0.0.1:5500/
```

Também é possível usar a extensão Live Server do Visual Studio Code.

## Configuração Do Supabase

O frontend usa apenas a chave pública `anon` em `js/supabase-config.js`. Nunca coloque a chave `service_role` no navegador ou no GitHub.

No Supabase Auth, mantenha o cadastro público desativado e crie manualmente apenas os usuários autorizados.

Em **Authentication > URL Configuration**, mantenha as URLs autorizadas:

```text
https://pedrollima2002.github.io/estoque-rpg/
http://localhost:5500
http://127.0.0.1:5500
```

## Publicação

O projeto está configurado para GitHub Pages pela branch `main`, pasta `/root`:

[https://pedrollima2002.github.io/estoque-rpg/](https://pedrollima2002.github.io/estoque-rpg/)

Execute a migration antes de enviar esta versão ao GitHub Pages. O frontend novo depende das RPCs para cadastrar e movimentar estoque.

## Testes Recomendados Após A Migration

- Cadastro com várias cores e tamanhos.
- Combinações com quantidade zero.
- Duplicado com caixa ou espaços diferentes.
- Soma de duplicado ao estoque existente.
- Entrada `+5`, venda `-3` e perda `-2` em um produto com 10 unidades.
- Tentativa de retirar quantidade maior que o estoque.
- Duas saídas simultâneas de uma unidade em um produto com 10 unidades; resultado esperado: 8.
- Histórico com quantidade anterior, nova, diferença, tipo, usuário e motivo.
- Arquivar, localizar nos arquivados e restaurar.
- Conferência com divergência e aplicação confirmada.
- Uso em 360 px, 390 px, 412 px, 768 px e desktop.

## Autor

Desenvolvido por **Pedro Henrique Lima**.

- GitHub: [pedrollima2002](https://github.com/pedrollima2002)
- Repositório: [estoque-rpg](https://github.com/pedrollima2002/estoque-rpg)
