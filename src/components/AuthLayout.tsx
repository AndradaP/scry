import Header from "./Header";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="bg-background flex flex-col" style={{ minHeight: "100dvh" }}>
    <Header />
    <main className="flex-1 flex flex-col">{children}</main>
  </div>
);

export default AuthLayout;
