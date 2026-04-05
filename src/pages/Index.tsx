import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ShardLogo from "@/components/ShardLogo";

const Index = () => {
  return (
    <AppLayout>
      <div className="max-w-[860px] mx-auto px-6">
        <div className="pt-24 pb-8">
          <div className="flex items-center gap-3 mb-4">
            <ShardLogo size={48} />
            <h1 className="font-heading text-6xl md:text-7xl font-semibold tracking-tight text-foreground">
              The Shard
            </h1>
          </div>
          <p className="font-body text-lg text-muted-foreground max-w-md">
            Product teardowns powered by the best product minds.
          </p>
          <p className="font-body text-sm text-muted-foreground/70 mt-2 max-w-lg">
            Insights drawn from{" "}
            <a
              href="https://www.lennysnewsletter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-muted-foreground transition-colors"
            >
              Lenny's Podcast and Newsletter
            </a>{" "}
            — updated as new content is published.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-24">
          <Link
            to="/generate"
            className="group border border-border hover:border-primary p-8 transition-colors duration-200"
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
          </Link>

          <Link
            to="/critique"
            className="group border border-border hover:border-primary p-8 transition-colors duration-200"
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
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
