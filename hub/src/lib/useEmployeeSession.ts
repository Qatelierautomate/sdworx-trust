import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

export function useEmployeeSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    void supabase.auth.getSession().then(({ data: current }) => {
      if (!active) return;
      setSession(current.session);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// The generated client narrows the provider list; Microsoft is enabled in the
// backend, so pass it through the client's own provider type.
type OAuthProvider = Parameters<typeof supabase.auth.signInWithOAuth>[0]["provider"];

export async function signInWithMicrosoft() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "microsoft" as OAuthProvider,
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutEmployee() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
