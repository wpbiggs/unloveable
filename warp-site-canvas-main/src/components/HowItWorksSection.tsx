import { Laptop, CheckCircle2, Zap } from "lucide-react";

const steps = [
  {
    icon: Laptop,
    title: "Describe your idea",
    description: "Start with a simple text description of what you want to build.",
  },
  {
    icon: Zap,
    title: "AI Generation",
    description: "Our AI generates a full React application in seconds.",
  },
  {
    icon: CheckCircle2,
    title: "Refine & Deploy",
    description: "Tweak the result with follow-up prompts, then deploy with one click.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-24 bg-muted/30">
      <div className="container">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            How it <span className="text-gradient">works</span>
          </h2>
          <p className="text-muted-foreground">
            Three simple steps to your dream website
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center text-center p-6 rounded-2xl bg-background border border-border hover:border-primary/50 transition-colors">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <step.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
