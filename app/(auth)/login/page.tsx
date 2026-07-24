"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  persistNativeSession,
  restoreNativeSession,
} from "@/lib/native-auth";
import { PASSWORD_POLICY, validatePassword } from "@/lib/password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type Mode = "signin" | "signup";
type OAuthProvider = "google" | "apple";

// Sign in with Apple is gated behind an env flag. The button only works once the
// Supabase Apple provider is configured (Services ID + client-secret JWT), so we
// keep it hidden until NEXT_PUBLIC_APPLE_SIGNIN=1 is set in the environment.
// Apple effectively requires this (Guideline 4.8) because we offer Google login.
const APPLE_SIGNIN_ENABLED = process.env.NEXT_PUBLIC_APPLE_SIGNIN === "1";

// Where the system-browser OAuth leg returns to on native.
// Android: verified HTTPS App Link (intent filter + assetlinks.json) hands the
// URL to the app. iOS: the custom scheme registered in Info.plist
// (CFBundleURLTypes) — no Universal Links are wired, and iOS doesn't reliably
// fire them from server-side 302s anyway; a custom-scheme redirect does open
// the app (after a one-tap system "Open in RememberOne?" confirm).
const OAUTH_CALLBACK_ANDROID = "https://rememberone.online/auth/callback";
const OAUTH_CALLBACK_IOS = "com.rememberone.app://auth/callback";

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

// Native Sign in with Apple, for iOS builds that ship the SignInWithApple
// plugin: the OS sheet (Face ID) returns an identity token directly — no
// browser, no return-leg redirect. Apple's request takes SHA-256(rawNonce);
// Supabase takes the raw nonce and verifies the hash inside the token.
// Throws on failure; the caller distinguishes "user canceled" from real errors.
async function signInWithAppleNative(
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const rawNonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const hashedNonce = toHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawNonce))
    )
  );

  const { SignInWithApple } = await import(
    "@capacitor-community/apple-sign-in"
  );
  const { response } = await SignInWithApple.authorize({
    // clientId/redirectURI only matter on the plugin's Android/web paths;
    // iOS ignores them, but the option types require values.
    clientId: "com.rememberone.app",
    redirectURI: OAUTH_CALLBACK_ANDROID,
    scopes: "email name",
    nonce: hashedNonce,
  });
  if (!response.identityToken) {
    throw new Error("Apple did not return an identity token.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: response.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Hand the one-shot authorization code to the server so it can exchange it
  // for an Apple refresh token — required to revoke the Sign in with Apple
  // grant when the user later deletes their account (App Store 5.1.1(v)).
  // Fire-and-forget: login must never fail over this.
  if (response.authorizationCode) {
    void fetch("/api/apple/store-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationCode: response.authorizationCode }),
    }).catch(() => {});
  }

  // Apple sends the user's name ONLY on the very first authorization, and it
  // arrives beside the token (never inside it), so the DB signup trigger
  // can't see it — store it now, in auth metadata and on the profile row
  // (own-row RLS UPDATE policy). Best-effort: never fail the login over it.
  const fullName = [response.givenName, response.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName && data.user) {
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", data.user.id);
    } catch {
      /* name capture is best-effort */
    }
  }

  await persistNativeSession(data.session);
  // HARD navigation on sign-in (see the deep-link handler): never reuse the
  // previous session's client runtime for a new identity.
  window.location.assign("/");
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  // Which OAuth provider is mid-flight (null = none). One state for both
  // buttons — only one OAuth redirect can be in progress at a time.
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

  // Guest mode — App Store 5.1.1(v): the app must be usable without
  // registering. Creates an anonymous Supabase user (random ID, no personal
  // info collected); convertible to a full account later in Settings, keeping
  // the same user id and all data.
  async function handleGuestSignIn() {
    setGuestLoading(true);
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      await persistNativeSession(data.session);
      // HARD navigation on sign-in, same as every other auth path.
      window.location.assign("/");
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Couldn't start a guest session",
        description:
          err instanceof Error ? err.message : "Please try again in a moment.",
      });
      setGuestLoading(false);
    }
  }

  useEffect(() => {
    // On native only: try to rehydrate a session from Capacitor Preferences.
    // Cookies don't reliably persist across app kills in the Android WebView,
    // so we keep a copy of the refresh token natively and re-exchange it on
    // each launch. If it works, jump straight into the app.
    (async () => {
      const restored = await restoreNativeSession(supabase);
      if (restored) {
        router.push("/");
        router.refresh();
      }
    })();
  }, [router, supabase]);

  useEffect(() => {
    // On native: listen for the deep link callback after Google/Apple OAuth
    let cleanup: (() => void) | undefined;
    import("@capacitor/core").then(({ Capacitor }) => {
      if (!Capacitor.isNativePlatform()) return;
      import("@capacitor/app").then(({ App }) => {
        const handle = App.addListener("appUrlOpen", async ({ url }) => {
          // Two return legs land here: Android's verified App Link (P1-02,
          // autoVerify intent filter + /.well-known/assetlinks.json) and
          // iOS's custom scheme from Info.plist CFBundleURLTypes — iOS has
          // no Universal Links, so the HTTPS form never reaches it.
          if (
            !url.startsWith(OAUTH_CALLBACK_ANDROID) &&
            !url.startsWith(OAUTH_CALLBACK_IOS)
          ) {
            return;
          }

          // Close the system browser / Custom Tab so the user returns to the app view.
          try {
            const { Browser } = await import("@capacitor/browser");
            await Browser.close();
          } catch {
            // Plugin may not be available; safe to ignore.
          }

          try {
            const urlObj = new URL(url);
            const code = urlObj.searchParams.get("code");
            const errParam = urlObj.searchParams.get("error_description") ??
              urlObj.searchParams.get("error");

            if (errParam) {
              throw new Error(decodeURIComponent(errParam));
            }
            if (!code) {
              throw new Error("Callback URL did not contain a code.");
            }

            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;

            // Mirror the session into Capacitor Preferences so next launch
            // can rehydrate without forcing a re-login.
            await persistNativeSession(data.session);

            // HARD navigation on sign-in: a soft router.push keeps the previous
            // client runtime (router cache, module state) alive across an
            // identity change, which can serve the previous account's screens
            // and data to the new one. A full document load starts clean.
            window.location.assign("/");
          } catch (err: unknown) {
            console.error("[deep-link login] exchange failed:", err);
            toast({
              title: "Sign-in failed",
              description:
                err instanceof Error
                  ? err.message
                  : "Could not complete sign-in on the app.",
              variant: "destructive",
            });
            setOauthLoading(null);
          }
        });
        cleanup = () => handle.then((h) => h.remove());
      });
    });
    return () => cleanup?.();
  }, [router, supabase, toast]);

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setOauthLoading(provider);

    // Detect the platform in its own small try: ONLY "not native / Capacitor
    // import failed" may fall through to the web flow below. A failure inside
    // the native flow itself must NOT — Google rejects OAuth inside embedded
    // WebViews (disallowed_useragent), so retrying the web flow in the app
    // WebView can never succeed; it has to surface as a toast instead.
    let platform: "ios" | "android" | null = null;
    let appleSheetAvailable = false;
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform()) {
        platform = Capacitor.getPlatform() as "ios" | "android";
        appleSheetAvailable = Capacitor.isPluginAvailable("SignInWithApple");
      }
    } catch {
      platform = null;
    }

    if (platform) {
      try {
        if (provider === "apple" && platform === "ios" && appleSheetAvailable) {
          // iOS builds that ship the plugin: native Apple sheet, no browser.
          // On success this persists the session and hard-navigates to "/".
          // Older TestFlight builds (no plugin) use the browser leg below.
          await signInWithAppleNative(supabase);
          return;
        }

        // System-browser leg. The return arrives as a deep link handled by
        // the appUrlOpen listener above — Android via the verified App Link,
        // iOS via the custom scheme.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo:
              platform === "ios" ? OAUTH_CALLBACK_IOS : OAUTH_CALLBACK_ANDROID,
            skipBrowserRedirect: true,
          },
        });
        if (error) throw error;
        const { Browser } = await import("@capacitor/browser");
        await Browser.open({ url: data.url! });
        setOauthLoading(null);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        // The native Apple sheet rejects with ASAuthorizationError.canceled
        // (code 1001) when the user dismisses it — not an error, stay quiet.
        if (!/1001|cancel/i.test(message)) {
          toast({
            title:
              provider === "apple"
                ? "Apple sign-in failed"
                : "Google sign-in failed",
            description: message || "Could not start the sign-in flow.",
            variant: "destructive",
          });
        }
        setOauthLoading(null);
      }
      return;
    }

    // Web flow
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      toast({
        title: provider === "apple" ? "Apple sign-in failed" : "Google sign-in failed",
        description: error.message,
        variant: "destructive",
      });
      setOauthLoading(null);
    }
    // On success, browser redirects to the provider — no need to reset loading
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        // Client-side mirror of the Supabase Auth password policy. Server is
        // the source of truth, but catching weak passwords here gives a
        // specific error message instead of Supabase's generic one.
        const pwCheck = validatePassword(password);
        if (!pwCheck.ok) {
          toast({
            title: "Password too weak",
            description: pwCheck.reason,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        toast({
          title: "Check your email",
          description:
            "We sent you a confirmation link. Click it to activate your account.",
        });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        await persistNativeSession(data.session);
        // HARD navigation on sign-in (see the deep-link handler above): never
        // reuse the previous session's client runtime for a new identity.
        window.location.assign("/");
      }
    } catch (err: unknown) {
      toast({
        title: "Authentication error",
        description:
          err instanceof Error ? err.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    /*
      Full-screen vertically centered.
      On very small phones (375px) the card fills the available width with px-4 gutters.
      On sm+ it is constrained to max-w-sm.
    */
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: "linear-gradient(to bottom right, #ddf6ff, #fbf6ff)" }}>
      <div className="w-full max-w-sm space-y-6">
        {/* Branding */}
        <div className="flex flex-col items-center gap-2 text-center">
          {/* Brand logo — the PNG is already a self-contained rounded app icon
              (its own dark tile background), so render it directly. Nesting it
              in a white card made it read as a black square on white. */}
          <img
            src="/logo.png"
            alt="RememberOne logo"
            className="w-16 h-16 rounded-2xl shadow-md"
          />
          <h1 className="text-2xl font-normal text-black uppercase tracking-wider" style={{ fontFamily: "'Hammersmith One', sans-serif" }}>RememberOne</h1>
          <p className="text-sm text-muted-foreground">
            Never forget a person you meet
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === "signin" ? "Sign in" : "Create account"}
            </CardTitle>
            <CardDescription>
              {mode === "signin"
                ? "Welcome back. Sign in to your account."
                : "Start building your personal memory today."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Sign in with Apple — Apple HIG: must be no smaller or less
                prominent than other sign-in buttons, approved label text,
                black style. Kept ABOVE the Google button on purpose. Gated so
                it only appears once the Supabase Apple provider is live. */}
            {APPLE_SIGNIN_ENABLED && (
              <Button
                type="button"
                className="w-full h-11 flex items-center gap-2 bg-black text-white hover:bg-black/90"
                onClick={() => handleOAuthSignIn("apple")}
                disabled={oauthLoading !== null || loading}
              >
                {oauthLoading === "apple" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.03 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.702" />
                  </svg>
                )}
                {oauthLoading === "apple" ? "Redirecting..." : "Continue with Apple"}
              </Button>
            )}

            {/* Google Sign In — tall touch target */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 flex items-center gap-2"
              onClick={() => handleOAuthSignIn("google")}
              disabled={oauthLoading !== null || loading}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>

            {/* Email / password form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    className="h-11 text-base"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  /*
                    text-base prevents iOS from zooming in on input focus
                    (iOS zooms when font size is < 16px / 1rem)
                  */
                  className="h-11 text-base"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={
                    mode === "signup"
                      ? `At least ${PASSWORD_POLICY.minLength} characters, 1 letter + 1 number`
                      : ""
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={
                    mode === "signup" ? PASSWORD_POLICY.minLength : undefined
                  }
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  className="h-11 text-base"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Please wait...
                  </>
                ) : mode === "signin" ? (
                  "Sign in"
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            {/* Mode toggle */}
            <p className="text-center text-sm text-muted-foreground pt-1">
              {mode === "signin" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>

            {/* Guest entry — usable without any registration (5.1.1(v)) */}
            <div className="pt-3 border-t space-y-1">
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 text-muted-foreground"
                onClick={handleGuestSignIn}
                disabled={guestLoading || loading || oauthLoading !== null}
              >
                {guestLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Continue without an account
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Try everything now — add an email later in Settings to keep your
                data safe.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
