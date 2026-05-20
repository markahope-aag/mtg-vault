"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const ERROR_MESSAGES: Record<string, string> = {
  no_code:
    "The sign-in link didn't carry an auth code. The link may have expired or already been used — request a fresh one.",
  callback_failed:
    "Couldn't complete sign-in. The link may have expired or been opened in a different browser than where it was requested.",
  not_allowed: "That email isn't on the allowlist for this app.",
};

function LoginFormInner() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get("error");
  const errorDetail = searchParams.get("detail");

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus({ kind: "idle" });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "sent" });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">MTG Vault</h1>
        <p className="text-sm text-muted-foreground">
          Sign in with a magic link sent to your inbox.
        </p>
      </div>

      {errorKey && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          <p className="font-medium text-destructive">
            {ERROR_MESSAGES[errorKey] ?? `Sign-in error: ${errorKey}`}
          </p>
          {errorDetail && (
            <p className="mt-1 text-xs text-destructive/80">{errorDetail}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Sending..." : "Send magic link"}
      </Button>
      {status.kind === "sent" && (
        <p className="text-sm text-muted-foreground">
          Check your email for the sign-in link.
        </p>
      )}
      {status.kind === "error" && (
        <p className="text-sm text-destructive">{status.message}</p>
      )}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={null}>
        <LoginFormInner />
      </Suspense>
    </main>
  );
}
