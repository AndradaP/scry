import { useState } from "react";
import { Link } from "react-router-dom";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Supabase auth
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <Link to="/" className="font-heading text-3xl font-semibold text-foreground mb-16">
        The Shard
      </Link>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>
        <div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground py-3 text-sm font-body font-medium hover:opacity-90 transition-opacity"
        >
          Sign in
        </button>
        <p className="text-center text-sm text-muted-foreground font-body">
          No account?{" "}
          <Link to="/signup" className="text-amber-accent hover:opacity-80 transition-opacity">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
};

export default Login;
