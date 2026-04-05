import ShardLogo from "./ShardLogo";

const Footer = () => {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-[860px] mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShardLogo size={20} />
          <span className="font-heading text-sm font-semibold text-foreground">The Shard</span>
        </div>
        <p className="text-xs font-body text-muted-foreground">
          Powered by{" "}
          <a
            href="https://www.lennysnewsletter.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors underline underline-offset-2"
          >
            Lenny's Podcast &amp; Newsletter
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
