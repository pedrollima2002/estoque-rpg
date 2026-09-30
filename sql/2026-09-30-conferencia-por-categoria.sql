-- Conferencia mensal separada por categoria.
-- Execute este arquivo uma unica vez no Supabase SQL Editor antes de publicar o novo front-end.

begin;

alter table public.conferencias
  add column if not exists categoria text;

-- Identifica historicos antigos que pertenciam integralmente a uma categoria.
with categorias_historicas as (
  select
    ci.conferencia_id,
    min(p.categoria) as categoria
  from public.conferencia_itens ci
  join public.produtos p on p.id = ci.produto_id
  group by ci.conferencia_id
  having count(distinct p.categoria) = 1
)
update public.conferencias c
set categoria = h.categoria
from categorias_historicas h
where c.id = h.conferencia_id
  and nullif(btrim(c.categoria), '') is null;

-- Conferencias abertas pela funcao antiga continham a loja inteira e nao
-- podem ser retomadas no novo fluxo por categoria.
update public.conferencias
set
  status = 'cancelada',
  finalizada_em = coalesce(finalizada_em, now()),
  updated_at = now()
where status = 'em_andamento';

create index if not exists conferencias_categoria_created_at_idx
  on public.conferencias (categoria, created_at desc);

create unique index if not exists conferencias_uma_em_andamento_idx
  on public.conferencias ((status))
  where status = 'em_andamento';

drop function if exists public.iniciar_conferencia();

create or replace function public.iniciar_conferencia(p_categoria text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_total integer;
  v_categoria text := public.normalizar_texto_estoque(p_categoria);
  v_categoria_aberta text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.' using errcode = '42501';
  end if;

  if v_categoria = '' then
    raise exception 'Escolha uma categoria para iniciar a conferencia.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('rpg_iniciar_conferencia'));

  select id, categoria
  into v_id, v_categoria_aberta
  from public.conferencias
  where status = 'em_andamento'
  order by created_at desc
  limit 1;

  if v_id is not null then
    if public.normalizar_texto_estoque(v_categoria_aberta) <> v_categoria then
      raise exception 'Existe uma conferencia em andamento para a categoria %. Finalize ou cancele antes de iniciar outra.',
        v_categoria_aberta using errcode = '22023';
    end if;

    select count(*) into v_total
    from public.conferencia_itens
    where conferencia_id = v_id;

    return jsonb_build_object(
      'id', v_id,
      'categoria', v_categoria_aberta,
      'resumida', true,
      'total', v_total
    );
  end if;

  select count(*) into v_total
  from public.produtos
  where ativo = true
    and quantidade > 0
    and public.normalizar_texto_estoque(categoria) = v_categoria;

  if v_total = 0 then
    raise exception 'A categoria selecionada nao possui produtos com estoque.' using errcode = '22023';
  end if;

  insert into public.conferencias (categoria, criado_por, criado_por_email)
  values (v_categoria, auth.uid(), coalesce(auth.jwt() ->> 'email', ''))
  returning id into v_id;

  insert into public.conferencia_itens (
    conferencia_id, produto_id, quantidade_sistema
  )
  select v_id, id, quantidade
  from public.produtos
  where ativo = true
    and quantidade > 0
    and public.normalizar_texto_estoque(categoria) = v_categoria;

  get diagnostics v_total = row_count;

  return jsonb_build_object(
    'id', v_id,
    'categoria', v_categoria,
    'resumida', false,
    'total', v_total
  );
end;
$$;

revoke all on function public.iniciar_conferencia(text) from public, anon;
grant execute on function public.iniciar_conferencia(text) to authenticated;

commit;

-- Verificacao esperada: a coluna categoria e a funcao com argumento devem aparecer.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'conferencias'
  and column_name = 'categoria';

select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name = 'iniciar_conferencia';
