import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { supabase } from "@/lib/supabase";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    supabase.auth.signOut();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("success");
    }
  };

  return (
    <AuthLayout>
      <div className="flex flex-col items-center justify-center px-6 py-24">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <h1 className="font-heading text-3xl font-semibold text-foreground text-center mb-8">Create account</h1>
          <div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          <div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          {status === "error" && (
            <p className="text-sm font-mono" style={{ color: "hsl(var(--destructive))" }}>{errorMsg}</p>
          )}
          <button type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity">Create account</button>
          {status === "success" && (
            <p className="text-sm font-mono text-center" style={{ color: "#EDE6D8" }}>Check your email to confirm your account.</p>
          )}
          <p className="text-center text-sm text-muted-foreground font-body">
            Already have an account?{" "}
            <Link to="/login" className="text-amber-accent hover:opacity-80 transition-opacity">Sign in</Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default Signup;
