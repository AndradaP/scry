import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [view, setView] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStatus, setForgotStatus] = useState<"idle" | "sent" | "error">("idle");
  const [forgotError, setForgotError] = useState("");
  const [loginError, setLoginError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message);
    } else {
      window.location.href = "/";
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotStatus("idle");
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: "https://the-shard-five.vercel.app/reset-password",
    });
    if (error) {
      setForgotError(error.message);
      setForgotStatus("error");
    } else {
      setForgotStatus("sent");
    }
  };

  if (view === "forgot") {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center px-6 py-24">
          <form onSubmit={handleForgot} className="w-full max-w-sm space-y-6">
            <h1 className="font-heading text-3xl font-semibold text-foreground text-center mb-8">Reset password</h1>
            {forgotStatus === "sent" ? (
              <p className="text-sm font-mono text-center" style={{ color: "hsl(var(--primary))" }}>
                Reset link sent. Check your email.
              </p>
            ) : (
              <>
                <div>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
                  />
                </div>
                {forgotStatus === "error" && (
                  <p className="text-sm font-mono" style={{ color: "hsl(var(--destructive))" }}>{forgotError}</p>
                )}
                <button type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity">
                  Send reset link
                </button>
              </>
            )}
            <p className="text-center text-sm text-muted-foreground font-body">
              <button type="button" onClick={() => setView("login")} className="text-amber-accent hover:opacity-80 transition-opacity">
                Back to sign in
              </button>
            </p>
          </form>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center px-6 py-24">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <h1 className="font-heading text-3xl font-semibold text-foreground text-center mb-8">Sign in</h1>
          <div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          <div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          <div className="text-right">
            <button type="button" onClick={() => setView("forgot")} className="text-xs font-mono text-muted-foreground hover:opacity-80 transition-opacity">
              Forgot password?
            </button>
          </div>
          {loginError && (
            <p className="text-sm font-mono" style={{ color: "hsl(var(--destructive))" }}>{loginError}</p>
          )}
          <button type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity">Sign in</button>
          <p className="text-center text-sm text-muted-foreground font-body">
            No account?{" "}
            <Link to="/signup" className="text-amber-accent hover:opacity-80 transition-opacity">Sign up</Link>
          </p>
        </form>
      </div>
    </AppLayout>
  );
};

export default Login;
