import { Zap, Palette, Code2, Rocket, Shield, Sparkles } from "lucide-react";
import FeatureCard from "./FeatureCard";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Design",
    description: "Describe your vision in plain English and watch as AI transforms your words into pixel-perfect designs.",
    gradient: "cyan" as const,
  },
  {
    icon: Code2,
    title: "Clean, Modern Code",
    description: "Get production-ready React code with TypeScript, Tailwind CSS, and best practices baked in.",
    gradient: "purple" as const,
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "From idea to deployed website in minutes, not days. Ship faster than ever before.",
    gradient: "pink" as const,
  },
  {
    icon: Palette,
    title: "Fully Customizable",
    description: "Every element is editable. Tweak colors, fonts, layouts, and more with simple prompts.",
    gradient: "cyan" as const,
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description: "Deploy your site instantly to the cloud with custom domains and SSL included.",
    gradient: "purple" as const,
  },
  {
    icon: Shield,
    title: "Enterprise Ready",
    description: "Built-in authentication, database, and security features for production applications.",
    gradient: "pink" as const,
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-surreal opacity-50" />
      
      <div className="container relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to <span className="text-gradient">create magic</span>
          </h2>
          <p className="text-muted-foreground">
            Powerful features that make web development feel like dreaming
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
