import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCardClick = (path: string) => {
    if (isLoggedIn) {
      navigate(path);
    } else {
      navigate("/login");
    }
  };

  return (
    <AppLayout>
      <div className="max-w-[860px] mx-auto px-6">
        <div className="pt-24 pb-8">
          <h1 className="font-heading text-6xl md:text-7xl font-semibold tracking-tight mb-4 text-primary">
            Scry
          </h1>
          <p className="font-body text-lg text-muted-foreground max-w-md">
            Product teardowns powered by the best product minds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
          <button
            onClick={() => handleCardClick("/generate")}
            className="group border border-border hover:border-primary p-8 transition-colors duration-200 text-left"
          >
            <div className="flex items-start justify-between mb-6">
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                Generate a Teardown
              </h2>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-accent transition-colors" />
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Pick a product. Get a full-stack analysis.
            </p>
          </button>

          <button
            onClick={() => handleCardClick("/critique")}
            className="group border border-border hover:border-primary p-8 transition-colors duration-200 text-left"
          >
            <div className="flex items-start justify-between mb-6">
              <h2 className="font-heading text-2xl font-semibold text-foreground">
                Critique My Teardown
              </h2>
              <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-accent transition-colors" />
            </div>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              Submit your teardown. Get expert feedback.
            </p>
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;