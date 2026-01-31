export interface SearchResult {
  file: string;
  line: number;
  content: string;
}

export type RunCommand = (command: string) => Promise<{ ok: boolean; output: string }>;

export async function searchFiles(query: string, runCommand: RunCommand): Promise<SearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  // Use grep for searching content
  // -r: recursive
  // -I: ignore binary files
  // -n: show line numbers
  // --exclude-dir: skip node_modules, .git, .opencode
  const safeQuery = query.replace(/"/g, '\\"');
  const cmd = `grep -rIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.opencode "${safeQuery}" . | head -n 100`;

  try {
    const { ok, output } = await runCommand(cmd);
    if (!ok || !output) return [];

    return output.split('\n')
      .filter(line => line.trim())
      .map(line => {
        // grep output format: file:line:content
        // But content can contain colons, so we only split on the first two colons
        const parts = line.split(':');
        if (parts.length < 3) return null;

        const file = parts[0];
        const lineNum = parseInt(parts[1], 10);
        // Rejoin the rest of the parts in case the content had colons
        const content = parts.slice(2).join(':');

        if (isNaN(lineNum)) return null;

        return {
          file,
          line: lineNum,
          content
        };
      })
      .filter((res): res is SearchResult => res !== null);
  } catch (err) {
    console.error("Search failed:", err);
    return [];
  }
}
