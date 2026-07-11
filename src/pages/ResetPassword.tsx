import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { supabase } from "@/lib/supabase";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");

    if (password !== confirm) {
      setError("Passwords do not match.");
      setStatus("error");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setStatus("error");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setStatus("error");
    } else {
      setStatus("success");
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center px-6 py-24">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <h1 className="font-heading text-3xl font-semibold text-foreground text-center mb-8">New password</h1>
          {status === "success" ? (
            <>
              <p className="text-sm font-mono text-center" style={{ color: "hsl(var(--primary))" }}>
                Password updated.
              </p>
              <p className="text-center text-sm text-muted-foreground font-body">
                <Link to="/login" className="text-amber-accent hover:opacity-80 transition-opacity">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>
              <div>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
                />
              </div>
              {status === "error" && (
                <p className="text-sm font-mono" style={{ color: "hsl(var(--destructive))" }}>{error}</p>
              )}
              <button type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity">
                Update password
              </button>
            </>
          )}
        </form>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
