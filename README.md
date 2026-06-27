# RPG Multimarcas — Controle de Estoque

Criei este projeto para facilitar o controle de estoque da minha loja, a RPG Multimarcas. Antes, a quantidade dos produtos era controlada de forma manual. Com o sistema, eu e meus sócios conseguimos acessar o mesmo estoque, aumentar ou diminuir quantidades e acompanhar o histórico das alterações.

## Funcionalidades

- Login com e-mail e senha.
- Acesso restrito a usuários cadastrados.
- Cadastro de novos produtos.
- Edição e exclusão de produtos.
- Aumento e diminuição rápida da quantidade em estoque.
- Confirmação antes de zerar um produto.
- Busca por nome.
- Filtros por categoria, cor, tamanho e situação do estoque.
- Indicadores com total de peças e modelos cadastrados.
- Avisos de estoque baixo e produto sem estoque.
- Histórico de movimentações.
- Atualização em tempo real entre os usuários.
- Layout responsivo para computador, tablet e celular.

## Tecnologias utilizadas

- HTML5
- CSS3
- JavaScript
- Supabase Auth
- Supabase Database
- Supabase Realtime
- GitHub Pages

## Estrutura do projeto

```text
estoque-rpg/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── produtos.js
│   ├── historico.js
│   └── supabase-config.js
├── README.md
└── .gitignore
```

## Como o sistema funciona

1. O usuário entra com e-mail e senha.
2. O Supabase Auth verifica se o acesso é autorizado.
3. Depois do login, os produtos são carregados da tabela `produtos`.
4. Cada alteração gera um registro na tabela `movimentacoes`.
5. O Supabase Realtime atualiza os dados para os outros usuários conectados.
6. As regras de Row Level Security impedem o acesso de usuários não autenticados.

## Configuração do Supabase

### 1. Criar o projeto

1. Acesse o Supabase.
2. Entre na sua conta.
3. Clique em **New project**.
4. Escolha a organização.
5. Defina o nome do projeto.
6. Crie uma senha segura para o banco.
7. Escolha a região mais próxima.
8. Clique em **Create new project**.

### 2. Criar as tabelas e políticas de segurança

No Supabase, abra o **SQL Editor**, crie uma nova consulta e execute:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text default '',
  subcategoria text default '',
  categoria text not null,
  cor text not null,
  tamanho text default '',
  quantidade integer not null default 0 check (quantidade >= 0),
  valor_venda numeric(10, 2) check (valor_venda is null or valor_venda >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movimentacoes (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid,
  produto_nome text not null,
  quantidade_anterior integer not null,
  quantidade_nova integer not null,
  tipo text not null check (tipo in ('entrada', 'saída', 'edição', 'exclusão')),
  usuario_id uuid,
  usuario_email text default '',
  created_at timestamptz not null default now()
);

create index if not exists produtos_nome_idx
on public.produtos (nome);

create index if not exists produtos_categoria_idx
on public.produtos (categoria);

create index if not exists produtos_cor_idx
on public.produtos (cor);

create index if not exists produtos_tamanho_idx
on public.produtos (tamanho);

create index if not exists movimentacoes_created_at_idx
on public.movimentacoes (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists produtos_set_updated_at
on public.produtos;

create trigger produtos_set_updated_at
before update on public.produtos
for each row
execute function public.set_updated_at();

alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

drop policy if exists
"Produtos visiveis para usuarios autenticados"
on public.produtos;

drop policy if exists
"Produtos criados por usuarios autenticados"
on public.produtos;

drop policy if exists
"Produtos editados por usuarios autenticados"
on public.produtos;

drop policy if exists
"Produtos excluidos por usuarios autenticados"
on public.produtos;

create policy
"Produtos visiveis para usuarios autenticados"
on public.produtos
for select
to authenticated
using (true);

create policy
"Produtos criados por usuarios autenticados"
on public.produtos
for insert
to authenticated
with check (true);

create policy
"Produtos editados por usuarios autenticados"
on public.produtos
for update
to authenticated
using (true)
with check (true);

create policy
"Produtos excluidos por usuarios autenticados"
on public.produtos
for delete
to authenticated
using (true);

drop policy if exists
"Historico visivel para usuarios autenticados"
on public.movimentacoes;

drop policy if exists
"Historico criado por usuarios autenticados"
on public.movimentacoes;

create policy
"Historico visivel para usuarios autenticados"
on public.movimentacoes
for select
to authenticated
using (true);

create policy
"Historico criado por usuarios autenticados"
on public.movimentacoes
for insert
to authenticated
with check (auth.uid() = usuario_id);

alter table public.produtos replica identity full;
alter table public.movimentacoes replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'produtos'
  ) then
    alter publication supabase_realtime
    add table public.produtos;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'movimentacoes'
  ) then
    alter publication supabase_realtime
    add table public.movimentacoes;
  end if;
end $$;
```

### Atualizar banco existente

Se o banco já foi criado antes da inclusão de subcategoria e valor de venda, execute uma vez no **SQL Editor** o arquivo:

```text
sql/adicionar-subcategoria-valor.sql
```

Essa atualização não apaga produtos, histórico ou usuários.

### 3. Ativar autenticação

1. Abra **Authentication**.
2. Acesse **Providers**.
3. Ative o login por e-mail e senha.
4. Cadastre manualmente os usuários que poderão acessar o sistema.
5. Não crie uma tela pública de cadastro.

### 4. Configurar URL e chave pública

Abra o arquivo:

```text
js/supabase-config.js
```

Substitua os valores de exemplo:

```javascript
export const SUPABASE_URL =
  'https://SEU-PROJETO.supabase.co';

export const SUPABASE_ANON_KEY =
  'COLE_AQUI_SUA_CHAVE_ANON_PUBLICA';
```

Use somente a chave pública `anon`.

Nunca coloque a chave `service_role` no código do navegador.

## Executar localmente

Como o projeto utiliza módulos JavaScript, não abra o arquivo `index.html` diretamente.

### Opção 1 — Live Server

1. Abra o projeto no Visual Studio Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html`.
4. Selecione **Open with Live Server**.

### Opção 2 — servidor do Python

Dentro da pasta do projeto, execute:

```bash
python -m http.server 5500
```

Depois, acesse:

```text
http://localhost:5500
```

## Publicação no GitHub Pages

1. Envie o projeto para um repositório no GitHub.
2. Abra **Settings**.
3. Acesse **Pages**.
4. Em **Build and deployment**, escolha **Deploy from a branch**.
5. Selecione a branch `main`.
6. Selecione a pasta `/root`.
7. Clique em **Save**.

Depois da publicação, configure o endereço do GitHub Pages em:

```text
Supabase > Authentication > URL Configuration
```

Adicione o endereço em **Site URL** e **Redirect URLs**.

Exemplo:

```text
https://SEU-USUARIO.github.io/estoque-rpg/
http://localhost:5500
http://127.0.0.1:5500
```

## Segurança

A chave pública `anon` pode ser utilizada no frontend.

A proteção dos dados depende das políticas de **Row Level Security** configuradas no Supabase.

A chave `service_role` é privada e nunca deve ser publicada no GitHub ou utilizada no navegador.

## Possíveis melhorias futuras

- Recuperação de senha.
- Exportação do estoque para CSV.
- Registro de entrada e saída por quantidade personalizada.
- Relatórios de movimentação.
- Controle de permissões por usuário.
- Inclusão de imagens dos produtos.
- Transformação do sistema em PWA.

## Autor

Desenvolvido por **Pedro Henrique Lima**.

- GitHub: [pedrollima2002](https://github.com/pedrollima2002)
- Repositório: [estoque-rpg](https://github.com/pedrollima2002/estoque-rpg)
