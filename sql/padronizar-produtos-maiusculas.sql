-- Padronizacao de produtos e historico para letras maiusculas.
-- Execute primeiro as consultas de conferencia.
-- Depois execute os comandos de atualizacao apenas se a conferencia estiver correta.

-- 1) Conferir como os produtos ficarao.
select
  id,
  nome as nome_atual,
  upper(trim(nome)) as nome_maiusculo,
  descricao as descricao_atual,
  case when descricao is null then null else upper(trim(descricao)) end as descricao_maiuscula,
  subcategoria as subcategoria_atual,
  case when subcategoria is null then null else upper(trim(subcategoria)) end as subcategoria_maiuscula,
  categoria as categoria_atual,
  upper(trim(categoria)) as categoria_maiuscula,
  cor as cor_atual,
  upper(trim(cor)) as cor_maiuscula,
  tamanho as tamanho_atual,
  case when tamanho is null then null else upper(trim(tamanho)) end as tamanho_maiusculo
from public.produtos
order by nome;

-- 2) Atualizar definitivamente os produtos.
update public.produtos
set
  nome = upper(trim(nome)),
  descricao = case when descricao is null then null else upper(trim(descricao)) end,
  subcategoria = case when subcategoria is null then null else upper(trim(subcategoria)) end,
  categoria = upper(trim(categoria)),
  cor = upper(trim(cor)),
  tamanho = case when tamanho is null then null else upper(trim(tamanho)) end;

-- 3) Conferir como o historico ficara.
-- A tabela movimentacoes guarda apenas produto_nome como texto duplicado do produto.
select
  id,
  produto_nome as produto_nome_atual,
  upper(trim(produto_nome)) as produto_nome_maiusculo,
  quantidade_anterior,
  quantidade_nova,
  tipo,
  usuario_email,
  created_at
from public.movimentacoes
order by created_at desc;

-- 4) Atualizar definitivamente o historico antigo.
update public.movimentacoes
set produto_nome = upper(trim(produto_nome));
