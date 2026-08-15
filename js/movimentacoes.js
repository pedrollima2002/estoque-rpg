import { supabase } from './supabase-config.js';

export const TIPOS_MOVIMENTACAO = {
  entrada: { rotulo: 'Entrada', sinal: 1, exigeMotivo: false },
  venda: { rotulo: 'Venda', sinal: -1, exigeMotivo: false },
  devolucao: { rotulo: 'Devolução', sinal: 1, exigeMotivo: true },
  troca_entrada: { rotulo: 'Troca - entrada', sinal: 1, exigeMotivo: true },
  troca_saida: { rotulo: 'Troca - saída', sinal: -1, exigeMotivo: true },
  perda_avaria: { rotulo: 'Perda/Avaria', sinal: -1, exigeMotivo: true },
  ajuste_manual: { rotulo: 'Ajuste manual', sinal: null, exigeMotivo: true }
};

export async function movimentarEstoque(produtoId, diferenca, tipo, motivo = '') {
  const { data, error } = await supabase.rpc('movimentar_estoque', {
    p_produto_id: produtoId,
    p_diferenca: Number(diferenca),
    p_tipo: tipo,
    p_motivo: motivo.trim()
  });

  if (error) throw error;
  return data;
}
