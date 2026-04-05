const Footer = () => {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-[860px] mx-auto px-6 py-4 flex items-center justify-between">
        <span className="font-heading text-sm font-semibold"><span className="text-foreground">The </span><span className="font-heading text-sm font-semibold"><span className="text-foreground">The </span><span className="text-primary">Shard</span></span></span>
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
