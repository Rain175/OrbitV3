import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://urqklfoecaluradohjyz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_DC606lBaFv7u6KEU2VtSHg_4bGQjFQN';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
