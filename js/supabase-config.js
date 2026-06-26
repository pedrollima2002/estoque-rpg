import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Coloque aqui os dados do seu projeto Supabase.
// Nunca use a service_role key no navegador.
export const SUPABASE_URL = 'https://vnkapljrxwlpkwebrlgr.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZua2FwbGpyeHdscGt3ZWJybGdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MjQzNTYsImV4cCI6MjA5ODAwMDM1Nn0.KSh4678vVGkxnG4jeD9lYPaAPCEH_R6e-IhnHuuakTs';

export const supabaseConfigurado =
  SUPABASE_URL.startsWith('https://') &&
  !SUPABASE_URL.includes('SEU-PROJETO') &&
  SUPABASE_ANON_KEY.length > 40 &&
  !SUPABASE_ANON_KEY.includes('COLE_AQUI');

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
