import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

if (!url || !key) {
  throw new Error("Supabase 配置缺失：请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY");
}

export const supabase = createClient(url, key);
