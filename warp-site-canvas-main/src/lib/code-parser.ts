import { GeneratedCode } from "./ai-config";

export interface ParsedFiles {
  html: string;
  css: string;
  js: string;
}

export interface FileNode {
  name: string;
  type: "file" | "folder";
  content?: string;
  children?: FileNode[];
  language?: "html" | "css" | "javascript";
}

/**
 * Parse the generated HTML and extract embedded CSS and JS
 */
export function parseGeneratedCode(code: GeneratedCode): ParsedFiles {
  const html = code.html;
  
  // Extract CSS from <style> tags
  const styleMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  const cssBlocks: string[] = [];
  for (const match of styleMatches) {
    cssBlocks.push(match[1].trim());
  }
  const css = cssBlocks.join("\n\n");
  
  // Extract JS from <script> tags (excluding external scripts)
  const scriptMatches = html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
  const jsBlocks: string[] = [];
  for (const match of scriptMatches) {
    jsBlocks.push(match[1].trim());
  }
  const js = jsBlocks.join("\n\n");
  
  // Create clean HTML without inline styles and scripts for display
  const cleanHtml = html;
  
  return { html: cleanHtml, css, js };
}

/**
 * Generate a file tree structure from parsed files
 */
export function generateFileTree(files: ParsedFiles): FileNode[] {
  const tree: FileNode[] = [
    {
      name: "src",
      type: "folder",
      children: [
        {
          name: "index.html",
          type: "file",
          content: files.html,
          language: "html",
        },
      ],
    },
    {
      name: "styles",
      type: "folder",
      children: [
        {
          name: "main.css",
          type: "file",
          content: files.css || "/* No CSS extracted */",
          language: "css",
        },
      ],
    },
    {
      name: "scripts",
      type: "folder",
      children: [
        {
          name: "main.js",
          type: "file",
          content: files.js || "// No JavaScript extracted",
          language: "javascript",
        },
      ],
    },
  ];
  
  return tree;
}

/**
 * Rebuild the full HTML from separated files
 */
export function rebuildHtml(files: ParsedFiles): string {
  // If the HTML already contains complete document, return it
  if (files.html.includes("<!DOCTYPE") || files.html.includes("<html")) {
    return files.html;
  }
  
  // Otherwise construct a complete HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Generated Website</title>
  <style>
${files.css}
  </style>
</head>
<body>
${files.html}
  <script>
${files.js}
  </script>
</body>
</html>`;
}
