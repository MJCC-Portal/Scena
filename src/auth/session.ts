// Native Supabase Auth session helpers — Google OAuth is the primary
// sign-in path, with a one-time email link as the optional secondary path
// (see docs/AUTHENTICATION.md). Replaces src/auth/sso.ts; there is no MJCC
// handoff, no external identity bridge — Supabase Auth owns the session.

import { requireSupabase } from "../services/supabase/client";

export async function signInWithGoogle(redirectTo = `${window.location.origin}/auth/callback`): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

export async function sendEmailSignInLink(email: string, redirectTo = `${window.location.origin}/auth/callback`): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut();
}
