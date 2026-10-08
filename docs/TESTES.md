# Evidências de teste

Este documento separa o que foi realmente verificado do que continua sendo uma recomendação de regressão. Ele não afirma cobertura automatizada do banco que o projeto ainda não possui.

## Verificações executadas

### Aplicação e publicação

- página pública carregando a tela de login;
- login autenticado validado visualmente;
- publicação pelo GitHub Pages confirmada pelo conteúdo público;
- navegação e layout inspecionados em desktop e mobile;
- presença pública do fluxo de conferência por categoria e da ação `Cancelar e sair`;
- sintaxe dos módulos JavaScript verificada com `node --check`.

### Conferência por categoria

- migration executada no Supabase sem erro;
- categorias independentes para conferência;
- apenas produtos ativos e com quantidade maior que zero incluídos;
- retomada de conferência aberta da mesma categoria;
- busca por nome, descrição, categoria, subcategoria, cor e tamanho;
- cancelamento disponível durante a contagem, sem aplicar ajustes;
- correspondência entre seletores do HTML e os módulos JavaScript.

### Documentação do estudo de caso

- demonstração estática sem acesso ao Supabase;
- seis capturas geradas com dados fictícios;
- renderização conferida em 1440 × 900 e 390 × 844;
- caminhos locais do HTML e arquivos essenciais verificados automaticamente.

## Comandos de verificação

```bash
node scripts/validar-projeto.mjs
node --check js/app.js
node --check js/auth.js
node --check js/conferencia.js
node --check js/historico.js
node --check js/movimentacoes.js
node --check js/produtos.js
node --check js/supabase-config.js
node --check js/utils.js
```

## Regressão manual antes de uma mudança de banco

Estes cenários devem ser repetidos em um ambiente autorizado sempre que as RPCs ou migrations forem alteradas:

1. cadastrar múltiplas cores e tamanhos;
2. tentar cadastrar uma variação duplicada;
3. realizar entrada, venda e perda/avaria;
4. tentar retirar quantidade superior ao estoque;
5. confirmar o registro da movimentação no histórico;
6. arquivar e restaurar um produto;
7. iniciar, interromper, retomar e cancelar uma conferência;
8. concluir uma conferência com divergência e aplicar a correção conscientemente.

Os testes que modificam estoque não devem ser executados automaticamente contra a base real.
