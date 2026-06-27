-- Atualizacao do cadastro de produtos da RPG Multimarcas.
-- Execute este SQL uma unica vez no Supabase SQL Editor.
-- Ele nao apaga produtos, historico ou usuarios.

alter table public.produtos
add column if not exists subcategoria text default '';

alter table public.produtos
add column if not exists valor_venda numeric(10, 2);

alter table public.produtos
drop constraint if exists produtos_valor_venda_check;

alter table public.produtos
add constraint produtos_valor_venda_check
check (valor_venda is null or valor_venda >= 0);

comment on column public.produtos.subcategoria is 'Subcategoria opcional do produto.';
comment on column public.produtos.valor_venda is 'Valor de venda opcional do produto.';
