-- Evolucao segura do estoque da RPG Multimarcas.
-- Execute este arquivo uma unica vez no Supabase SQL Editor.
-- A migration preserva produtos, historico e usuarios existentes.

begin;

create extension if not exists "pgcrypto";

-- Produtos ativos, arquivamento e limite individual de estoque baixo.
alter table public.produtos
  add column if not exists ativo boolean;

alter table public.produtos
  add column if not exists arquivado_em timestamptz;

alter table public.produtos
  add column if not exists estoque_minimo integer;

update public.produtos
set
  ativo = coalesce(ativo, true),
  estoque_minimo = coalesce(estoque_minimo, 3);

alter table public.produtos
  alter column ativo set default true,
  alter column ativo set not null,
  alter column estoque_minimo set default 3,
  alter column estoque_minimo set not null;

alter table public.produtos
  drop constraint if exists produtos_estoque_minimo_check;

alter table public.produtos
  add constraint produtos_estoque_minimo_check
  check (estoque_minimo >= 0);

-- O historico antigo continua valido e recebe os novos campos.
alter table public.movimentacoes
  add column if not exists diferenca integer;

alter table public.movimentacoes
  add column if not exists motivo text;

alter table public.movimentacoes
  add column if not exists usuario_nome text;

alter table public.movimentacoes
  add column if not exists produto_categoria text;

alter table public.movimentacoes
  add column if not exists produto_subcategoria text;

alter table public.movimentacoes
  add column if not exists produto_cor text;

alter table public.movimentacoes
  add column if not exists produto_tamanho text;

update public.movimentacoes
set
  diferenca = coalesce(diferenca, quantidade_nova - quantidade_anterior),
  motivo = coalesce(motivo, ''),
  usuario_nome = coalesce(usuario_nome, ''),
  produto_categoria = coalesce(produto_categoria, ''),
  produto_subcategoria = coalesce(produto_subcategoria, ''),
  produto_cor = coalesce(produto_cor, ''),
  produto_tamanho = coalesce(produto_tamanho, ''),
  tipo = case lower(tipo)
    when 'saída' then 'saida'
    when 'edição' then 'edicao'
    when 'exclusão' then 'exclusao'
    else lower(tipo)
  end;

alter table public.movimentacoes
  alter column diferenca set not null,
  alter column diferenca set default 0,
  alter column motivo set default '',
  alter column usuario_nome set default '',
  alter column produto_categoria set default '',
  alter column produto_subcategoria set default '',
  alter column produto_cor set default '',
  alter column produto_tamanho set default '';

alter table public.movimentacoes
  drop constraint if exists movimentacoes_tipo_check;

alter table public.movimentacoes
  add constraint movimentacoes_tipo_check
  check (tipo in (
    'cadastro',
    'entrada',
    'saida',
    'venda',
    'devolucao',
    'troca_entrada',
    'troca_saida',
    'perda_avaria',
    'ajuste_manual',
    'ajuste_conferencia',
    'edicao',
    'arquivamento',
    'restauracao',
    'exclusao'
  ));

create or replace function public.preparar_movimentacao()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.diferenca := new.quantidade_nova - new.quantidade_anterior;
  new.produto_nome := upper(regexp_replace(btrim(new.produto_nome), '[[:space:]]+', ' ', 'g'));
  new.tipo := lower(btrim(new.tipo));

  if new.produto_id is not null then
    select
      coalesce(nullif(new.produto_categoria, ''), p.categoria),
      coalesce(nullif(new.produto_subcategoria, ''), p.subcategoria),
      coalesce(nullif(new.produto_cor, ''), p.cor),
      coalesce(nullif(new.produto_tamanho, ''), p.tamanho)
    into
      new.produto_categoria,
      new.produto_subcategoria,
      new.produto_cor,
      new.produto_tamanho
    from public.produtos p
    where p.id = new.produto_id;
  end if;

  return new;
end;
$$;

drop trigger if exists movimentacoes_preparar on public.movimentacoes;

create trigger movimentacoes_preparar
before insert or update on public.movimentacoes
for each row execute function public.preparar_movimentacao();

-- Conferencias de contagem fisica e seus itens.
create table if not exists public.conferencias (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'aplicada', 'cancelada')),
  criado_por uuid not null,
  criado_por_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finalizada_em timestamptz
);

create table if not exists public.conferencia_itens (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  quantidade_sistema integer not null check (quantidade_sistema >= 0),
  quantidade_contada integer check (quantidade_contada is null or quantidade_contada >= 0),
  conferido_em timestamptz,
  unique (conferencia_id, produto_id)
);

create index if not exists produtos_ativos_categoria_idx
  on public.produtos (ativo, categoria);

create index if not exists produtos_variacao_logica_idx
  on public.produtos (
    upper(btrim(nome)),
    upper(btrim(categoria)),
    upper(btrim(coalesce(subcategoria, ''))),
    upper(btrim(cor)),
    upper(btrim(coalesce(tamanho, '')))
  );

create index if not exists movimentacoes_produto_created_at_idx
  on public.movimentacoes (produto_id, created_at desc);

create index if not exists movimentacoes_tipo_created_at_idx
  on public.movimentacoes (tipo, created_at desc);

create index if not exists movimentacoes_categoria_idx
  on public.movimentacoes (produto_categoria);

create index if not exists movimentacoes_usuario_idx
  on public.movimentacoes (usuario_id, created_at desc);

create index if not exists conferencia_itens_conferencia_idx
  on public.conferencia_itens (conferencia_id);

create or replace function public.normalizar_texto_estoque(p_valor text)
returns text
language sql
immutable
parallel safe
as $$
  select upper(regexp_replace(btrim(coalesce(p_valor, '')), '[[:space:]]+', ' ', 'g'));
$$;

create or replace function public.impedir_variacao_duplicada()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if exists (
    select 1
    from public.produtos p
    where p.id <> new.id
      and public.normalizar_texto_estoque(p.nome) = public.normalizar_texto_estoque(new.nome)
      and public.normalizar_texto_estoque(p.categoria) = public.normalizar_texto_estoque(new.categoria)
      and public.normalizar_texto_estoque(p.subcategoria) = public.normalizar_texto_estoque(new.subcategoria)
      and public.normalizar_texto_estoque(p.cor) = public.normalizar_texto_estoque(new.cor)
      and public.normalizar_texto_estoque(p.tamanho) = public.normalizar_texto_estoque(new.tamanho)
  ) then
    raise exception 'Ja existe uma variacao com o mesmo nome, categoria, subcategoria, cor e tamanho.'
      using errcode = '23505';
  end if;

  new.nome := public.normalizar_texto_estoque(new.nome);
  new.descricao := public.normalizar_texto_estoque(new.descricao);
  new.categoria := public.normalizar_texto_estoque(new.categoria);
  new.subcategoria := public.normalizar_texto_estoque(new.subcategoria);
  new.cor := public.normalizar_texto_estoque(new.cor);
  new.tamanho := public.normalizar_texto_estoque(new.tamanho);
  return new;
end;
$$;

drop trigger if exists produtos_impedir_variacao_duplicada on public.produtos;

create trigger produtos_impedir_variacao_duplicada
before insert or update of nome, categoria, subcategoria, cor, tamanho
on public.produtos
for each row execute function public.impedir_variacao_duplicada();

-- Unica porta para entrada, saida e ajustes de quantidade.
create or replace function public.movimentar_estoque(
  p_produto_id uuid,
  p_diferenca integer,
  p_tipo text,
  p_motivo text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto public.produtos%rowtype;
  v_quantidade_anterior integer;
  v_quantidade_nova integer;
  v_tipo text := lower(btrim(coalesce(p_tipo, '')));
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_nome text := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if p_diferenca is null or p_diferenca = 0 then
    raise exception 'A quantidade da movimentacao deve ser diferente de zero.' using errcode = '22023';
  end if;

  if v_tipo not in (
    'entrada', 'saida', 'venda', 'devolucao', 'troca_entrada',
    'troca_saida', 'perda_avaria', 'ajuste_manual', 'ajuste_conferencia'
  ) then
    raise exception 'Tipo de movimentacao invalido.' using errcode = '22023';
  end if;

  if v_tipo in ('entrada', 'devolucao', 'troca_entrada') and p_diferenca < 0 then
    raise exception 'Este tipo de movimentacao deve adicionar estoque.' using errcode = '22023';
  end if;

  if v_tipo in ('saida', 'venda', 'troca_saida', 'perda_avaria') and p_diferenca > 0 then
    raise exception 'Este tipo de movimentacao deve remover estoque.' using errcode = '22023';
  end if;

  select *
  into v_produto
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.' using errcode = 'P0002';
  end if;

  if not v_produto.ativo then
    raise exception 'Restaure o produto antes de movimentar o estoque.' using errcode = '22023';
  end if;

  v_quantidade_anterior := v_produto.quantidade;
  v_quantidade_nova := v_quantidade_anterior + p_diferenca;

  if v_quantidade_nova < 0 then
    raise exception 'Estoque insuficiente. Disponivel: %.', v_quantidade_anterior using errcode = '22003';
  end if;

  update public.produtos
  set quantidade = v_quantidade_nova
  where id = p_produto_id
  returning * into v_produto;

  insert into public.movimentacoes (
    produto_id, produto_nome, produto_categoria, produto_subcategoria,
    produto_cor, produto_tamanho, quantidade_anterior, quantidade_nova,
    diferenca, tipo, motivo, usuario_id, usuario_email, usuario_nome
  ) values (
    v_produto.id, v_produto.nome, v_produto.categoria, v_produto.subcategoria,
    v_produto.cor, v_produto.tamanho, v_quantidade_anterior, v_quantidade_nova,
    p_diferenca, v_tipo, coalesce(btrim(p_motivo), ''), auth.uid(), v_email, v_nome
  );

  return jsonb_build_object(
    'produto', to_jsonb(v_produto),
    'quantidade_anterior', v_quantidade_anterior,
    'quantidade_nova', v_quantidade_nova,
    'diferenca', p_diferenca,
    'tipo', v_tipo
  );
end;
$$;

-- Cadastro transacional de uma matriz de variacoes.
create or replace function public.cadastrar_variacoes(
  p_variacoes jsonb,
  p_somar_duplicados boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_existente public.produtos%rowtype;
  v_criado public.produtos%rowtype;
  v_nome text;
  v_descricao text;
  v_categoria text;
  v_subcategoria text;
  v_cor text;
  v_tamanho text;
  v_quantidade integer;
  v_valor numeric(10, 2);
  v_estoque_minimo integer;
  v_duplicados jsonb := '[]'::jsonb;
  v_criados integer := 0;
  v_atualizados integer := 0;
  v_email text := coalesce(auth.jwt() ->> 'email', '');
  v_nome_usuario text := coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '');
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if p_variacoes is null or jsonb_typeof(p_variacoes) <> 'array' or jsonb_array_length(p_variacoes) = 0 then
    raise exception 'Nenhuma variacao foi informada.' using errcode = '22023';
  end if;

  -- Serializa apenas cadastros para impedir duplicacao em chamadas simultaneas.
  perform pg_advisory_xact_lock(hashtext('rpg_multimarcas_cadastrar_variacoes'));

  for v_item in select value from jsonb_array_elements(p_variacoes)
  loop
    v_nome := public.normalizar_texto_estoque(v_item ->> 'nome');
    v_categoria := public.normalizar_texto_estoque(v_item ->> 'categoria');
    v_subcategoria := public.normalizar_texto_estoque(v_item ->> 'subcategoria');
    v_cor := public.normalizar_texto_estoque(v_item ->> 'cor');
    v_tamanho := public.normalizar_texto_estoque(v_item ->> 'tamanho');
    v_quantidade := coalesce((v_item ->> 'quantidade')::integer, 0);

    if v_nome = '' or v_categoria = '' or v_cor = '' then
      raise exception 'Nome, categoria e cor sao obrigatorios.' using errcode = '22023';
    end if;

    if v_quantidade < 0 then
      raise exception 'Quantidade invalida para % / % / %.', v_nome, v_cor, v_tamanho using errcode = '22023';
    end if;

    if v_quantidade = 0 then
      continue;
    end if;

    select * into v_existente
    from public.produtos p
    where public.normalizar_texto_estoque(p.nome) = v_nome
      and public.normalizar_texto_estoque(p.categoria) = v_categoria
      and public.normalizar_texto_estoque(p.subcategoria) = v_subcategoria
      and public.normalizar_texto_estoque(p.cor) = v_cor
      and public.normalizar_texto_estoque(p.tamanho) = v_tamanho
    order by p.ativo desc, p.created_at
    limit 1
    for update;

    if found then
      v_duplicados := v_duplicados || jsonb_build_array(jsonb_build_object(
        'id', v_existente.id,
        'nome', v_existente.nome,
        'cor', v_existente.cor,
        'tamanho', v_existente.tamanho,
        'quantidade_atual', v_existente.quantidade,
        'quantidade_adicionar', v_quantidade,
        'ativo', v_existente.ativo
      ));
    end if;
  end loop;

  if jsonb_array_length(v_duplicados) > 0 and not p_somar_duplicados then
    return jsonb_build_object(
      'status', 'duplicados',
      'duplicados', v_duplicados,
      'criados', 0,
      'atualizados', 0
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_variacoes)
  loop
    v_nome := public.normalizar_texto_estoque(v_item ->> 'nome');
    v_descricao := public.normalizar_texto_estoque(v_item ->> 'descricao');
    v_categoria := public.normalizar_texto_estoque(v_item ->> 'categoria');
    v_subcategoria := public.normalizar_texto_estoque(v_item ->> 'subcategoria');
    v_cor := public.normalizar_texto_estoque(v_item ->> 'cor');
    v_tamanho := public.normalizar_texto_estoque(v_item ->> 'tamanho');
    v_quantidade := coalesce((v_item ->> 'quantidade')::integer, 0);
    v_valor := nullif(v_item ->> 'valor_venda', '')::numeric(10, 2);
    v_estoque_minimo := coalesce((v_item ->> 'estoque_minimo')::integer, 3);

    if v_quantidade = 0 then
      continue;
    end if;

    select * into v_existente
    from public.produtos p
    where public.normalizar_texto_estoque(p.nome) = v_nome
      and public.normalizar_texto_estoque(p.categoria) = v_categoria
      and public.normalizar_texto_estoque(p.subcategoria) = v_subcategoria
      and public.normalizar_texto_estoque(p.cor) = v_cor
      and public.normalizar_texto_estoque(p.tamanho) = v_tamanho
    order by p.ativo desc, p.created_at
    limit 1
    for update;

    if found then
      if not v_existente.ativo then
        raise exception 'A variacao % / % / % esta arquivada. Restaure-a antes de somar estoque.', v_nome, v_cor, v_tamanho using errcode = '22023';
      end if;

      perform public.movimentar_estoque(
        v_existente.id,
        v_quantidade,
        'entrada',
        'Soma ao estoque durante cadastro de variacao duplicada'
      );
      v_atualizados := v_atualizados + 1;
    else
      insert into public.produtos (
        nome, descricao, categoria, subcategoria, cor, tamanho,
        quantidade, valor_venda, estoque_minimo, ativo
      ) values (
        v_nome, v_descricao, v_categoria, v_subcategoria, v_cor, v_tamanho,
        v_quantidade, v_valor, v_estoque_minimo, true
      ) returning * into v_criado;

      insert into public.movimentacoes (
        produto_id, produto_nome, produto_categoria, produto_subcategoria,
        produto_cor, produto_tamanho, quantidade_anterior, quantidade_nova,
        diferenca, tipo, motivo, usuario_id, usuario_email, usuario_nome
      ) values (
        v_criado.id, v_criado.nome, v_criado.categoria, v_criado.subcategoria,
        v_criado.cor, v_criado.tamanho, 0, v_criado.quantidade,
        v_criado.quantidade, 'cadastro', 'Cadastro de nova variacao',
        auth.uid(), v_email, v_nome_usuario
      );
      v_criados := v_criados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'sucesso',
    'duplicados', v_duplicados,
    'criados', v_criados,
    'atualizados', v_atualizados
  );
end;
$$;

create or replace function public.editar_produto(
  p_produto_id uuid,
  p_dados jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto public.produtos%rowtype;
  v_nome text := public.normalizar_texto_estoque(p_dados ->> 'nome');
  v_categoria text := public.normalizar_texto_estoque(p_dados ->> 'categoria');
  v_cor text := public.normalizar_texto_estoque(p_dados ->> 'cor');
  v_valor numeric(10, 2) := nullif(p_dados ->> 'valor_venda', '')::numeric(10, 2);
  v_estoque_minimo integer := coalesce((p_dados ->> 'estoque_minimo')::integer, 3);
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if v_nome = '' or v_categoria = '' or v_cor = '' then
    raise exception 'Nome, categoria e cor sao obrigatorios.' using errcode = '22023';
  end if;

  if v_valor is not null and v_valor < 0 then
    raise exception 'Valor de venda invalido.' using errcode = '22023';
  end if;

  if v_estoque_minimo < 0 then
    raise exception 'Estoque minimo invalido.' using errcode = '22023';
  end if;

  select * into v_produto
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.' using errcode = 'P0002';
  end if;

  update public.produtos
  set
    nome = v_nome,
    descricao = public.normalizar_texto_estoque(p_dados ->> 'descricao'),
    categoria = v_categoria,
    subcategoria = public.normalizar_texto_estoque(p_dados ->> 'subcategoria'),
    cor = v_cor,
    tamanho = public.normalizar_texto_estoque(p_dados ->> 'tamanho'),
    valor_venda = v_valor,
    estoque_minimo = v_estoque_minimo
  where id = p_produto_id
  returning * into v_produto;

  insert into public.movimentacoes (
    produto_id, produto_nome, produto_categoria, produto_subcategoria,
    produto_cor, produto_tamanho, quantidade_anterior, quantidade_nova,
    diferenca, tipo, motivo, usuario_id, usuario_email, usuario_nome
  ) values (
    v_produto.id, v_produto.nome, v_produto.categoria, v_produto.subcategoria,
    v_produto.cor, v_produto.tamanho, v_produto.quantidade, v_produto.quantidade,
    0, 'edicao', 'Dados do produto editados', auth.uid(),
    coalesce(auth.jwt() ->> 'email', ''),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')
  );

  return to_jsonb(v_produto);
end;
$$;

create or replace function public.definir_produto_arquivado(
  p_produto_id uuid,
  p_arquivar boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto public.produtos%rowtype;
  v_tipo text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select * into v_produto
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.' using errcode = 'P0002';
  end if;

  if not p_arquivar and exists (
    select 1
    from public.produtos p
    where p.id <> v_produto.id
      and p.ativo = true
      and public.normalizar_texto_estoque(p.nome) = public.normalizar_texto_estoque(v_produto.nome)
      and public.normalizar_texto_estoque(p.categoria) = public.normalizar_texto_estoque(v_produto.categoria)
      and public.normalizar_texto_estoque(p.subcategoria) = public.normalizar_texto_estoque(v_produto.subcategoria)
      and public.normalizar_texto_estoque(p.cor) = public.normalizar_texto_estoque(v_produto.cor)
      and public.normalizar_texto_estoque(p.tamanho) = public.normalizar_texto_estoque(v_produto.tamanho)
  ) then
    raise exception 'Ja existe uma variacao ativa igual a este produto arquivado.' using errcode = '23505';
  end if;

  update public.produtos
  set
    ativo = not p_arquivar,
    arquivado_em = case when p_arquivar then now() else null end
  where id = p_produto_id
  returning * into v_produto;

  v_tipo := case when p_arquivar then 'arquivamento' else 'restauracao' end;

  insert into public.movimentacoes (
    produto_id, produto_nome, produto_categoria, produto_subcategoria,
    produto_cor, produto_tamanho, quantidade_anterior, quantidade_nova,
    diferenca, tipo, motivo, usuario_id, usuario_email, usuario_nome
  ) values (
    v_produto.id, v_produto.nome, v_produto.categoria, v_produto.subcategoria,
    v_produto.cor, v_produto.tamanho, v_produto.quantidade, v_produto.quantidade,
    0, v_tipo, '', auth.uid(), coalesce(auth.jwt() ->> 'email', ''),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')
  );

  return to_jsonb(v_produto);
end;
$$;

create or replace function public.excluir_produto_permanentemente(p_produto_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_produto public.produtos%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select * into v_produto
  from public.produtos
  where id = p_produto_id
  for update;

  if not found then
    raise exception 'Produto nao encontrado.' using errcode = 'P0002';
  end if;

  if v_produto.ativo then
    raise exception 'Arquive o produto antes de exclui-lo permanentemente.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.conferencia_itens ci
    join public.conferencias c on c.id = ci.conferencia_id
    where ci.produto_id = p_produto_id and c.status = 'em_andamento'
  ) then
    raise exception 'O produto participa de uma conferencia em andamento.' using errcode = '22023';
  end if;

  insert into public.movimentacoes (
    produto_id, produto_nome, produto_categoria, produto_subcategoria,
    produto_cor, produto_tamanho, quantidade_anterior, quantidade_nova,
    diferenca, tipo, motivo, usuario_id, usuario_email, usuario_nome
  ) values (
    v_produto.id, v_produto.nome, v_produto.categoria, v_produto.subcategoria,
    v_produto.cor, v_produto.tamanho, v_produto.quantidade, 0,
    -v_produto.quantidade, 'exclusao', 'Exclusao permanente de produto arquivado',
    auth.uid(), coalesce(auth.jwt() ->> 'email', ''),
    coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')
  );

  update public.movimentacoes
  set produto_id = null
  where produto_id = p_produto_id;

  delete from public.produtos where id = p_produto_id;
end;
$$;

create or replace function public.iniciar_conferencia()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_total integer;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select id into v_id
  from public.conferencias
  where status = 'em_andamento'
  order by created_at desc
  limit 1;

  if v_id is not null then
    select count(*) into v_total
    from public.conferencia_itens
    where conferencia_id = v_id;

    return jsonb_build_object('id', v_id, 'resumida', true, 'total', v_total);
  end if;

  insert into public.conferencias (criado_por, criado_por_email)
  values (auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  returning id into v_id;

  insert into public.conferencia_itens (
    conferencia_id, produto_id, quantidade_sistema
  )
  select v_id, id, quantidade
  from public.produtos
  where ativo = true;

  get diagnostics v_total = row_count;

  return jsonb_build_object('id', v_id, 'resumida', false, 'total', v_total);
end;
$$;

create or replace function public.cancelar_conferencia(p_conferencia_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  update public.conferencias
  set status = 'cancelada', finalizada_em = now(), updated_at = now()
  where id = p_conferencia_id and status = 'em_andamento';

  if not found then
    raise exception 'Conferencia nao encontrada ou ja finalizada.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.aplicar_ajustes_conferencia(p_conferencia_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conferencia public.conferencias%rowtype;
  v_item record;
  v_produto public.produtos%rowtype;
  v_diferenca integer;
  v_ajustes integer := 0;
  v_sem_diferenca integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  select * into v_conferencia
  from public.conferencias
  where id = p_conferencia_id
  for update;

  if not found or v_conferencia.status <> 'em_andamento' then
    raise exception 'Conferencia nao encontrada ou ja finalizada.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.conferencia_itens
    where conferencia_id = p_conferencia_id
      and quantidade_contada is null
  ) then
    raise exception 'Conclua a contagem de todos os produtos antes de aplicar.' using errcode = '22023';
  end if;

  for v_item in
    select * from public.conferencia_itens
    where conferencia_id = p_conferencia_id
    order by id
  loop
    select * into v_produto
    from public.produtos
    where id = v_item.produto_id and ativo = true
    for update;

    if not found then
      continue;
    end if;

    v_diferenca := v_item.quantidade_contada - v_produto.quantidade;

    if v_diferenca <> 0 then
      perform public.movimentar_estoque(
        v_produto.id,
        v_diferenca,
        'ajuste_conferencia',
        'Ajuste da conferencia ' || p_conferencia_id::text
      );
      v_ajustes := v_ajustes + 1;
    else
      v_sem_diferenca := v_sem_diferenca + 1;
    end if;
  end loop;

  update public.conferencias
  set status = 'aplicada', finalizada_em = now(), updated_at = now()
  where id = p_conferencia_id;

  return jsonb_build_object(
    'ajustes', v_ajustes,
    'sem_diferenca', v_sem_diferenca,
    'status', 'aplicada'
  );
end;
$$;

-- RLS: somente usuarios autenticados consultam os dados.
alter table public.produtos enable row level security;
alter table public.movimentacoes enable row level security;
alter table public.conferencias enable row level security;
alter table public.conferencia_itens enable row level security;

drop policy if exists "Produtos visiveis para usuarios autenticados" on public.produtos;
create policy "Produtos visiveis para usuarios autenticados"
on public.produtos for select to authenticated using (auth.uid() is not null);

drop policy if exists "Produtos criados por usuarios autenticados" on public.produtos;

drop policy if exists "Produtos editados por usuarios autenticados" on public.produtos;

drop policy if exists "Produtos excluidos por usuarios autenticados" on public.produtos;

drop policy if exists "Historico visivel para usuarios autenticados" on public.movimentacoes;
create policy "Historico visivel para usuarios autenticados"
on public.movimentacoes for select to authenticated using (auth.uid() is not null);

drop policy if exists "Historico criado por usuarios autenticados" on public.movimentacoes;

drop policy if exists "Conferencias visiveis para usuarios autenticados" on public.conferencias;
create policy "Conferencias visiveis para usuarios autenticados"
on public.conferencias for select to authenticated using (auth.uid() is not null);

drop policy if exists "Conferencias atualizadas por usuarios autenticados" on public.conferencias;

drop policy if exists "Itens de conferencia visiveis para usuarios autenticados" on public.conferencia_itens;
create policy "Itens de conferencia visiveis para usuarios autenticados"
on public.conferencia_itens for select to authenticated using (auth.uid() is not null);

drop policy if exists "Itens de conferencia atualizados por usuarios autenticados" on public.conferencia_itens;
create policy "Itens de conferencia atualizados por usuarios autenticados"
on public.conferencia_itens for update to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

-- Escritas passam somente pelas RPCs transacionais.
revoke insert, delete, update on public.produtos from authenticated;
grant select on public.produtos to authenticated;

revoke insert, update, delete on public.movimentacoes from authenticated;
grant select on public.movimentacoes to authenticated;

revoke all on public.conferencias from anon;
revoke all on public.conferencia_itens from anon;
revoke insert, update, delete on public.conferencias from authenticated;
revoke insert, update, delete on public.conferencia_itens from authenticated;
grant select on public.conferencias to authenticated;
grant select on public.conferencia_itens to authenticated;
grant update (quantidade_contada, conferido_em) on public.conferencia_itens to authenticated;

revoke all on function public.movimentar_estoque(uuid, integer, text, text) from public, anon;
revoke all on function public.cadastrar_variacoes(jsonb, boolean) from public, anon;
revoke all on function public.editar_produto(uuid, jsonb) from public, anon;
revoke all on function public.definir_produto_arquivado(uuid, boolean) from public, anon;
revoke all on function public.excluir_produto_permanentemente(uuid) from public, anon;
revoke all on function public.iniciar_conferencia() from public, anon;
revoke all on function public.cancelar_conferencia(uuid) from public, anon;
revoke all on function public.aplicar_ajustes_conferencia(uuid) from public, anon;

grant execute on function public.movimentar_estoque(uuid, integer, text, text) to authenticated;
grant execute on function public.cadastrar_variacoes(jsonb, boolean) to authenticated;
grant execute on function public.editar_produto(uuid, jsonb) to authenticated;
grant execute on function public.definir_produto_arquivado(uuid, boolean) to authenticated;
grant execute on function public.excluir_produto_permanentemente(uuid) to authenticated;
grant execute on function public.iniciar_conferencia() to authenticated;
grant execute on function public.cancelar_conferencia(uuid) to authenticated;
grant execute on function public.aplicar_ajustes_conferencia(uuid) to authenticated;

-- Realtime para novos recursos.
alter table public.produtos replica identity full;
alter table public.movimentacoes replica identity full;
alter table public.conferencias replica identity full;
alter table public.conferencia_itens replica identity full;

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['conferencias', 'conferencia_itens']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = v_tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabela);
    end if;
  end loop;
end $$;

commit;

-- Conferencia opcional depois da execucao:
-- select ativo, count(*) from public.produtos group by ativo;
-- select tipo, count(*) from public.movimentacoes group by tipo order by tipo;
