# RPG Multimarcas - Controle de estoque

Aplicativo web simples para controlar o estoque da loja RPG Multimarcas. Ele usa HTML, CSS, JavaScript puro, Supabase Auth, Supabase Database e Supabase Realtime. Pode ser publicado gratuitamente no GitHub Pages.

## Estrutura do projeto

~~~text
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
~~~

## Como funciona

- Apenas usuários cadastrados no Supabase conseguem entrar.
- O estoque só aparece depois do login.
- Os produtos são salvos na tabela produtos.
- Cada alteração gera um registro na tabela movimentacoes.
- O Realtime atualiza a tela dos sócios sem recarregar a página.
- A chave anon fica no frontend, mas as regras de Row Level Security bloqueiam usuários não autenticados.
- Nunca coloque a service_role key no navegador.

## 1. Criar o projeto no Supabase

1. Acesse https://supabase.com.
2. Entre na sua conta.
3. Clique em New project.
4. Escolha a organização.
5. Informe um nome, por exemplo estoque-rpg.
6. Crie uma senha segura para o banco.
7. Escolha a região mais próxima.
8. Clique em Create new project.

## 2. Executar o SQL

No Supabase, abra SQL Editor, clique em New query, cole o SQL abaixo e execute.

~~~sql
create extension if not exists "pgcrypto";

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text default '',
  categoria text not null,
  cor text not null,
  tamanho text default '',
  quantidade integer not null default 0 check (quantidade >= 0),
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

create index if not exists produtos_nome_idx on public.produtos (nome);
create index if not exists produtos_categoria_idx on public.produtos (categoria);
create index if not exists produtos_cor_idx on public.produtos (cor);
create index if not exists produtos_tamanho_idx on public.produtos (tamanho);
create index if not exists movimentacoes_created_at_idx on public.movimentacoes (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists produtos_set_updated_at on public.produtos;

create trigger produtos_set_updated_at
before update on public.produtos
for each row
execute function public.set_updated_at();

alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;

drop policy if exists "Produtos visiveis para usuarios autenticados" on public.produtos;
drop policy if exists "Produtos criados por usuarios autenticados" on public.produtos;
drop policy if exists "Produtos editados por usuarios autenticados" on public.produtos;
drop policy if exists "Produtos excluidos por usuarios autenticados" on public.produtos;

create policy "Produtos visiveis para usuarios autenticados"
on public.produtos
for select
to authenticated
using (true);

create policy "Produtos criados por usuarios autenticados"
on public.produtos
for insert
to authenticated
with check (true);

create policy "Produtos editados por usuarios autenticados"
on public.produtos
for update
to authenticated
using (true)
with check (true);

create policy "Produtos excluidos por usuarios autenticados"
on public.produtos
for delete
to authenticated
using (true);

drop policy if exists "Historico visivel para usuarios autenticados" on public.movimentacoes;
drop policy if exists "Historico criado por usuarios autenticados" on public.movimentacoes;

create policy "Historico visivel para usuarios autenticados"
on public.movimentacoes
for select
to authenticated
using (true);

create policy "Historico criado por usuarios autenticados"
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
    alter publication supabase_realtime add table public.produtos;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'movimentacoes'
  ) then
    alter publication supabase_realtime add table public.movimentacoes;
  end if;
end $$;
~~~

## 3. Ativar autenticação por e-mail e senha

1. No Supabase, abra Authentication.
2. Entre em Providers.
3. Ative Email.
4. Deixe e-mail e senha habilitados.
5. Se quiser evitar confirmação por e-mail para os sócios, ajuste essa opção em Authentication > Providers > Email conforme a sua preferência.

## 4. Cadastrar os três usuários

1. Abra Authentication > Users.
2. Clique em Add user.
3. Cadastre o e-mail e a senha do primeiro sócio.
4. Repita o processo para os outros dois sócios.
5. Não crie tela de cadastro público no app.

## 5. Copiar URL e chave anon

1. Abra Project Settings.
2. Clique em API.
3. Copie a Project URL.
4. Copie a chave anon public.
5. Não copie a chave service_role para este projeto.

## 6. Configurar o projeto

Abra js/supabase-config.js e substitua:

~~~js
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'COLE_AQUI_SUA_CHAVE_ANON_PUBLICA';
~~~

por:

~~~js
export const SUPABASE_URL = 'https://sua-url-real.supabase.co';
export const SUPABASE_ANON_KEY = 'sua-chave-anon-publica-real';
~~~

A chave anon pode ficar no frontend porque ela é pública. A segurança vem das regras de Row Level Security configuradas no SQL. A service_role key é privada e nunca deve ser usada no navegador.

## 7. Testar localmente com Live Server

1. Abra a pasta estoque-rpg no Visual Studio Code.
2. Instale a extensão Live Server.
3. Clique com o botão direito em index.html.
4. Clique em Open with Live Server.
5. Entre com um usuário cadastrado no Supabase.

Também é possível abrir um servidor simples com Python dentro da pasta:

~~~bash
python -m http.server 5500
~~~

Depois acesse:

~~~text
http://localhost:5500
~~~

## 8. Criar o repositório no GitHub

1. Acesse https://github.com.
2. Clique em New repository.
3. Use o nome estoque-rpg.
4. Escolha Public ou Private.
5. Clique em Create repository.

## 9. Enviar os arquivos para o GitHub

Dentro da pasta estoque-rpg, execute:

~~~bash
git init
git add .
git commit -m "Cria controle de estoque da RPG Multimarcas"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/estoque-rpg.git
git push -u origin main
~~~

Troque SEU-USUARIO pelo seu usuário do GitHub.

## 10. Ativar o GitHub Pages

1. Abra o repositório no GitHub.
2. Vá em Settings.
3. Clique em Pages.
4. Em Build and deployment, escolha Deploy from a branch.
5. Em Branch, selecione main.
6. Em pasta, selecione /root.
7. Clique em Save.
8. Aguarde o GitHub gerar o link.

O endereço ficará parecido com:

~~~text
https://SEU-USUARIO.github.io/estoque-rpg/
~~~

## 11. Acessar pelo celular

1. Publique o projeto no GitHub Pages.
2. Abra o link do GitHub Pages no navegador do celular.
3. Entre com e-mail e senha de um dos usuários cadastrados.
4. Para facilitar, salve o site na tela inicial do celular.

## 12. Corrigir CORS ou URL de redirecionamento

Se o login não funcionar depois de publicar:

1. No Supabase, abra Authentication > URL Configuration.
2. Em Site URL, coloque o endereço do GitHub Pages.
3. Em Redirect URLs, adicione:

~~~text
https://SEU-USUARIO.github.io/estoque-rpg/
http://localhost:5500
http://127.0.0.1:5500
~~~

Se estiver usando Live Server em outra porta, adicione a URL local exata.

## Produtos de exemplo

Depois do login, cadastre produtos como:

- Camisa Adidas Básica Preta
- Camisa Adidas Listrada Preta
- Camisa Adidas Vazada Preta
- Camisa Adidas Básica Verde
- Camisa Nike Facão Azul-Marinho
- Short Nike Azul-Marinho

## Observações importantes

- A quantidade nunca fica menor que zero.
- Quando a quantidade vai de 1 para 0, o sistema pede confirmação.
- Produtos com 1 a 3 unidades aparecem como Estoque baixo.
- Produtos com 0 unidades aparecem como Sem estoque.
- Botões ficam desativados enquanto a alteração está sendo salva.
- A busca pelo nome funciona enquanto você digita.
- Os produtos aparecem em ordem alfabética.
