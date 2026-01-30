import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Header from "@/components/Header";

const images = [
  "/placeholder.svg",
  "/placeholder.svg",
  "/placeholder.svg",
];

const Product = () => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState("M");

  const product = {
    title: "Rift Runner Jacket",
    price: 129,
    description:
      "A premium lightweight jacket built for comfort and style. Water‑resistant shell, breathable lining, and a tailored fit that works on the trail or in the city.",
    features: [
      "Water‑resistant shell",
      "Breathable mesh lining",
      "Zip chest pocket",
      "Tailored fit",
    ],
    sizes: ["S", "M", "L", "XL"],
  };

  const addToCart = () => {
    // placeholder action — integrate with cart/store later
    toast.success(`${product.title} (x${quantity}) added to cart`);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <section>
            <div className="rounded-2xl overflow-hidden border border-border bg-muted">
              <img src={images[selectedImage]} alt={product.title} className="w-full h-[420px] object-cover" />
            </div>

            <div className="mt-4 flex gap-3">
              {images.map((src, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border ${
                    idx === selectedImage ? "border-primary" : "border-border/50"
                  }`}
                >
                  <img src={src} alt={`thumb-${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <h1 className="font-display text-3xl font-bold mb-2">{product.title}</h1>
            <p className="text-2xl font-semibold text-foreground/90 mb-4">${product.price.toFixed(2)}</p>

            <p className="text-muted-foreground mb-6">{product.description}</p>

            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Size</h3>
              <div className="flex items-center gap-3">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`px-3 py-2 rounded-md border ${
                      s === selectedSize ? "border-primary bg-primary/5" : "border-border/40"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6 flex items-center gap-4">
              <div className="flex items-center border border-border rounded-md overflow-hidden">
                <button
                  className="px-3 py-2"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="decrease"
                >
                  -
                </button>
                <div className="px-4 py-2 w-14 text-center">{quantity}</div>
                <button
                  className="px-3 py-2"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="increase"
                >
                  +
                </button>
              </div>

              <Button onClick={addToCart} variant="glow" size="lg">
                Add to cart
              </Button>
            </div>

            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Details</h4>
              <ul className="list-disc ml-5 text-muted-foreground">
                {product.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            <div className="mt-8 border-t pt-6">
              <h4 className="text-sm font-medium mb-3">Product Reviews</h4>
              <div className="text-muted-foreground">No reviews yet. Be the first to review this item.</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Product;
