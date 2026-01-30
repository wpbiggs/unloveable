import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: "cyan" | "purple" | "pink";
}

const FeatureCard = ({ icon: Icon, title, description, gradient = "cyan" }: FeatureCardProps) => {
  const glowClasses = {
    cyan: "group-hover:shadow-[0_0_30px_hsl(var(--glow-cyan)/0.2)]",
    purple: "group-hover:shadow-[0_0_30px_hsl(var(--glow-purple)/0.2)]",
    pink: "group-hover:shadow-[0_0_30px_hsl(var(--glow-pink)/0.2)]",
  };

  const iconClasses = {
    cyan: "text-glow-cyan",
    purple: "text-glow-purple", 
    pink: "text-glow-pink",
  };

  return (
    <div className={`group relative rounded-2xl border border-border bg-card/50 p-6 transition-all duration-300 hover:border-border/80 ${glowClasses[gradient]}`}>
      <div className={`mb-4 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-muted ${iconClasses[gradient]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
};

export default FeatureCard;
