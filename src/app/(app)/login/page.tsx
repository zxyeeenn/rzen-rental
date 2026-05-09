import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next;

  return (
    <div className="flex min-h-[min(70vh,40rem)] flex-col items-center justify-center">
      <LoginForm
        defaultNext={next ?? "/dashboard"}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
        supabaseAnonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}
      />
    </div>
  );
}
