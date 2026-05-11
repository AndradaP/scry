import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/lib/supabase";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      alert(error.message);
    } else {
      alert("Check your email to confirm your account.");
      window.location.href = "/login";
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center px-6 py-24">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
          <h1 className="font-heading text-3xl font-semibold text-foreground text-center mb-8">Create account</h1>
          <div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          <div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors" />
          </div>
          <button type="submit" className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity">Create account</button>
          <p className="text-center text-sm text-muted-foreground font-body">
            Already have an account?{" "}
            <Link to="/login" className="text-amber-accent hover:opacity-80 transition-opacity">Sign in</Link>
          </p>
        </form>
      </div>
    </AppLayout>
  );
};

export default Signup;
