import { supabase, supabaseConfigurado } from './supabase-config.js';

function exigirConfiguracao() {
  if (!supabaseConfigurado) {
    throw new Error('Configure a SUPABASE_URL e a SUPABASE_ANON_KEY em js/supabase-config.js.');
  }
}

export async function obterSessaoAtual() {
  if (!supabaseConfigurado) {
    return null;
  }

  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function entrarComEmailSenha(email, senha) {
  exigirConfiguracao();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function sair() {
  exigirConfiguracao();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export function observarAutenticacao(callback) {
  if (!supabaseConfigurado) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => data.subscription.unsubscribe();
}
