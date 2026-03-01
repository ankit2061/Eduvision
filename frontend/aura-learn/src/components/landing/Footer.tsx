import { BookOpen, Heart } from "lucide-react";

const footerLinks = {
  Platform: ["Features", "How It Works", "Pricing", "Accessibility"],
  Resources: ["Documentation", "API Reference", "Community", "Blog"],
  Support: ["Help Center", "Contact Us", "Privacy Policy", "Terms"],
};

export default function Footer() {
  return (
    <footer className="relative bg-gradient-sand grain-overlay border-t border-border">
      {/* Decorative divider */}
      <div className="divider-ornate" />

      <div className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-serif font-bold text-lg text-foreground">EduVoice</span>
            </div>
            <p className="text-sm font-sans text-muted-foreground leading-relaxed mb-6">
              Empowering every learner with AI-driven, inclusive speaking practice and personalized education.
            </p>
            <blockquote className="text-xs font-serif italic text-muted-foreground border-l-2 border-gold pl-3">
              "The beautiful thing about learning is that no one can take it away from you."
              <span className="block mt-1 not-italic text-foreground/60">— B.B. King</span>
            </blockquote>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-sans font-semibold text-sm text-foreground mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm font-sans text-muted-foreground underline-animate hover:text-foreground transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="divider-ornate mt-12" />

        <div className="flex flex-col md:flex-row items-center justify-between mt-6 gap-4">
          <p className="text-xs font-sans text-muted-foreground">
            © 2026 EduVoice. All rights reserved.
          </p>
          <p className="text-xs font-sans text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-destructive" /> for inclusive education
          </p>
        </div>
      </div>
    </footer>
  );
}
