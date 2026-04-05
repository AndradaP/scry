import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import AppLayout from "@/components/AppLayout";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppLayout>
      <div className="flex items-center justify-center px-6 py-24">
        <div className="text-center">
          <h1 className="mb-4 font-heading text-4xl font-semibold text-foreground">404</h1>
          <p className="mb-4 text-sm font-body text-muted-foreground">Page not found</p>
          <Link to="/" className="text-sm font-body text-primary hover:opacity-80 transition-opacity">
            Return to Home
          </Link>
        </div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
