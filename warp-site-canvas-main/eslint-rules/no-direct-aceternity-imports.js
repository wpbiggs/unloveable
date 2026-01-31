
// Custom rule to forbid direct imports from Aceternity in app/hauler
// This is a placeholder for a custom ESLint plugin or rule configuration
// For now, we'll just document where this would go if we were writing a full plugin.

export const noDirectAceternityImports = {
  meta: {
    type: "problem",
    docs: {
      description: "Forbid direct imports from Aceternity",
      category: "Best Practices",
      recommended: true,
    },
    schema: [],
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value.includes("aceternity")) {
          context.report({
            node,
            message: "Direct imports from Aceternity are forbidden. Use the component registry wrappers instead.",
          });
        }
      },
    };
  },
};
