"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("l.iglesias@fechap.es");
  const [password, setPassword] = useState("aep2026");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);
      const from = searchParams.get("from") || "/";
      router.push(from);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de acceso");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Contraseña</label>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {error && (
        <p className="rounded-xl border border-destructive-border bg-destructive-muted px-3 py-2 text-sm text-primary-soft">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full rounded-xl" disabled={loading} size="lg">
        {loading ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
