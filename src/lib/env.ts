function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  mediaPassword: () => required("KILIPEAK_MEDIA_PASSWORD"),
  authSecret: () => required("KILIPEAK_MEDIA_AUTH_SECRET"),
  mainSiteUrl: () =>
    process.env.NEXT_PUBLIC_MAIN_SITE_URL?.trim() ||
    "https://kilipeak-com.vercel.app",
};
