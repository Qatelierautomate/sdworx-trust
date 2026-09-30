import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowLeft, Eye, EyeOff, LockKeyhole, Play, RefreshCw,
  ShieldCheck, Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithMicrosoft, signOutEmployee, useEmployeeSession } from "@/lib/useEmployeeSession";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SD Worx Knowledge Hub" },
      { name: "description", content: "Employee sign-in for the SD Worx Knowledge Hub." },
      { property: "og:title", content: "Sign in — SD Worx Knowledge Hub" },
      { property: "og:description", content: "Employee sign-in for the SD Worx Knowledge Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginScreen,
});

const DEMO_EMAIL = "emma.v@sdworx.com";
const DEMO_PASSWORD = "Knowledge!2026";

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "flex items-end gap-2" : "flex items-end gap-3"} aria-label="SD Worx">
      <span className="flex h-7 items-end gap-[3px] pb-0.5" aria-hidden="true">
        <span className="h-4 w-[3px] -skew-x-[18deg] rounded-full bg-brand-blue" />
        <span className="h-6 w-[3px] -skew-x-[18deg] rounded-full bg-brand-red" />
        <span className="h-7 w-[3px] -skew-x-[18deg] rounded-full bg-brand-yellow" />
      </span>
      <span className="font-display text-[22px] font-semibold leading-none tracking-tight">sd worx</span>
    </div>
  );
}

function LoginScreen() {
  const navigate = useNavigate();
  const { user, loading } = useEmployeeSession();
  const [stage, setStage] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [microsoftBusy, setMicrosoftBusy] = useState(false);
  // A sign-in started on this page keeps the visitor here so the two-factor
  // step can run; anyone arriving with an existing session goes straight in.
  const signingInHere = useRef(false);

  useEffect(() => {
    if (!loading && user && !signingInHere.current) void navigate({ to: "/" });
  }, [loading, user, navigate]);

  const startDemo = async () => {
    signingInHere.current = true;
    setDemoBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    setDemoBusy(false);
    if (signInError) {
      signingInHere.current = false;
      setError("The demo account could not be opened right now. Try the demo again in a moment.");
      return;
    }
    void navigate({ to: "/" });
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    signingInHere.current = true;
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      signingInHere.current = false;
      const text = signInError.message ?? "";
      setError(
        text.toLowerCase().includes("not confirmed")
          ? "This account still needs its email address confirmed before a password works here."
          : "We could not sign you in. Check your work email and password, then try again.",
      );
      return;
    }
    setStage("code");
  };

  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(null);
    void navigate({ to: "/" });
  };

  const startMicrosoft = async () => {
    signingInHere.current = true;
    setMicrosoftBusy(true);
    setError(null);
    try {
      await signInWithMicrosoft();
    } catch (signInError) {
      signingInHere.current = false;
      setError(
        signInError instanceof Error
          ? signInError.message
          : "Microsoft sign-in could not start.",
      );
      setMicrosoftBusy(false);
    }
  };

  const leaveCodeStep = async () => {
    try {
      await signOutEmployee();
    } catch {
      // The session is already being dropped; nothing else to clean up.
    }
    signingInHere.current = false;
    setCode("");
    setPassword("");
    setStage("credentials");
  };

  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
      <aside className="hidden flex-col justify-between border-r border-shell/80 bg-shell px-10 py-10 lg:flex">
        <Wordmark />
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase text-primary">Knowledge Hub</p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight">
            Answers your customer can rely on, from knowledge you are allowed to open.
          </h1>
          <ul className="mt-8 space-y-4 text-sm leading-6 text-shell-foreground/80">
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
              <span><strong>Authorised scope first.</strong> The hub checks what you may open before it shows anything.</span>
            </li>
            <li className="flex gap-3">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-success" />
              <span><strong>Approved areas only.</strong> Microsoft 365 knowledge is searched in the channels, mailboxes and sites a knowledge admin approved.</span>
            </li>
            <li className="flex gap-3">
              <Trash2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span><strong>Questions are not stored.</strong> Your question is processed for this answer and then discarded.</span>
            </li>
          </ul>
        </div>
        <p className="text-xs leading-5 text-shell-foreground/60">
          Internal tool. Use your SD Worx work account. Do not enter client names, VAT numbers or personal data in the question field.
        </p>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center gap-3 lg:hidden">
          <Wordmark compact />
          <span className="border-l border-shell-foreground/15 pl-3 text-sm font-medium text-muted-foreground">Knowledge Hub</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {stage === "credentials" ? (
            <>
              <h2 className="font-display text-2xl font-bold">Employee sign-in</h2>
              <p className="mt-1 text-sm text-muted-foreground">Use the account your knowledge admin set up for you.</p>

              {error && (
                <div role="alert" className="mt-6 flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-6 border bg-surface-raised p-4">
                <Button className="w-full gap-2" disabled={demoBusy} onClick={() => void startDemo()}>
                  {demoBusy ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {demoBusy ? "Opening the hub…" : "Demo sign-in"}
                </Button>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Opens the hub as Emma V., payroll advisor. A prototype account with sample knowledge only — use it to look around.
                </p>
              </div>

              <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or your own account <span className="h-px flex-1 bg-border" />
              </div>

              <form className="space-y-4" onSubmit={(event) => void submitPassword(event)}>
                <div>
                  <Label htmlFor="work-email">Work email</Label>
                  <Input
                    id="work-email"
                    className="mt-1.5 bg-background"
                    type="email"
                    autoComplete="username"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@sdworx.com"
                  />
                </div>
                <div>
                  <Label htmlFor="work-password">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="work-password"
                      className="bg-background pr-11"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Your password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((value) => !value)}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={busy}>
                  {busy ? <RefreshCw className="size-4 animate-spin" /> : null}
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <div className="my-6 flex items-center gap-3 text-xs uppercase text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <Button variant="outline" className="w-full gap-2" disabled={microsoftBusy} onClick={() => void startMicrosoft()}>
                {microsoftBusy ? <RefreshCw className="size-4 animate-spin" /> : null}
                {microsoftBusy ? "Opening Microsoft…" : "Sign in with Microsoft"}
              </Button>

              <p className="mt-6 text-xs leading-5 text-muted-foreground">
                Trouble signing in? Ask your team lead or the knowledge owner. They can confirm your account and the areas you may open.
              </p>
            </>
          ) : (
            <>
              <button
                type="button"
                className="mb-5 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => void leaveCodeStep()}
              >
                <ArrowLeft className="size-4" /> Use a different account
              </button>
              <h2 className="font-display text-2xl font-bold">Two-factor verification</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app to finish signing in.
              </p>

              {error && (
                <div role="alert" className="mt-6 flex items-start gap-2 border-l-2 border-destructive bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form className="mt-6 space-y-4" onSubmit={submitCode}>
                <div>
                  <Label htmlFor="two-factor-code">6-digit code</Label>
                  <Input
                    id="two-factor-code"
                    className="mt-1.5 bg-background text-center font-display text-lg tracking-[0.4em]"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={!/^\d{6}$/.test(code)}>
                  Verify &amp; continue
                </Button>
              </form>

              <div className="mt-6 flex items-start gap-2 border bg-surface-raised p-3 text-xs leading-5 text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>
                  Prototype step: any 6 digits continue for now. Real one-time codes arrive when the hub is wired to your company identity provider.
                </span>
              </div>
            </>
          )}
        </div>

        <footer className="mx-auto w-full max-w-sm border-t pt-5 text-xs leading-5 text-muted-foreground">
          SD Worx Knowledge Hub · prototype. Passwords are handled by the backend, never by the browser. Two-factor verification is a prototype step until your identity provider is connected.
        </footer>
      </main>
    </div>
  );
}
