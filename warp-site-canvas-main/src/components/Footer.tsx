import logo from "@/assets/surreal-sites-logo.png";

const Footer = () => {
  return (
    <footer className="border-t border-border py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Surreal Sites" className="h-8 w-8" />
            <span className="font-display text-lg font-bold text-gradient">
              Surreal Sites
            </span>
          </div>

          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Contact</a>
          </nav>

          <p className="text-sm text-muted-foreground">
            © 2026 Surreal Sites. Dream big.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
