import { useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/AppLayout";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

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
