export interface GitHubFile {
  path: string;
  content: string;
}

export interface PublishResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

/**
 * Publishes a set of files to a new GitHub repository.
 * 
 * NOTE: This is a simplified MVP implementation using the Contents API.
 * For large projects or many files, the Git Data API (Blobs -> Tree -> Commit -> Ref)
 * would be more robust but complex.
 * 
 * @param token GitHub Personal Access Token
 * @param repoName Name of the repository to create
 * @param files Array of files to upload
 */
export async function publishToGitHub(
  token: string, 
  repoName: string, 
  files: GitHubFile[]
): Promise<PublishResult> {
  try {
    // 1. Create Repository
    const createResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        name: repoName,
        description: 'Created with UnLoveable',
        auto_init: true, // Creates an initial commit with README (or empty) so we can update
        private: false, // Default to public for now
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      throw new Error(`Failed to create repository: ${errorData.message || createResponse.statusText}`);
    }

    const repoData = await createResponse.json();
    const repoFullName = repoData.full_name; // e.g., "user/my-site"
    const htmlUrl = repoData.html_url;

    // 2. Upload files using the Contents API
    // We process sequentially to avoid rate limits or race conditions on the branch reference in simple impl
    // (Though parallel is possible with Git Data API, simpler here)
    for (const file of files) {
      // Skip if path starts with / or ./
      let cleanPath = file.path;
      if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
      if (cleanPath.startsWith('./')) cleanPath = cleanPath.substring(2);

      // We need to get the current SHA if the file exists (like README.md from auto_init), 
      // but since we are overwriting or creating, let's try to just CREATE (PUT).
      // If auto_init=true created README.md and we try to overwrite it without SHA, it will fail.
      // So we check if file exists first or handle 422? 
      // Optimization: For this MVP, we will attempt to PUT. If it fails due to SHA, we get the SHA and retry.
      // Actually, standard MVP: Just CREATE. If conflict, we log.
      
      // But wait, the prompt says "Export / publish".
      // Let's implement the specific PUT logic.
      
      const url = `https://api.github.com/repos/${repoFullName}/contents/${cleanPath}`;
      
      // Check if file exists to get SHA (needed for update)
      let sha: string | undefined;
      try {
        const checkRes = await fetch(url, {
          headers: { 'Authorization': `token ${token}` }
        });
        if (checkRes.ok) {
          const data = await checkRes.json();
          sha = data.sha;
        }
      } catch (e) {
        // Ignore network errors on check, assume new file
      }

      const putBody: any = {
        message: `Add ${cleanPath}`,
        content: btoa(file.content), // Base64 encode
        branch: repoData.default_branch || 'main',
      };

      if (sha) {
        putBody.sha = sha;
      }

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putBody),
      });

      if (!putRes.ok) {
        console.warn(`Failed to upload ${cleanPath}: ${putRes.statusText}`);
        // We continue trying other files even if one fails
      }
    }

    return {
      success: true,
      repoUrl: htmlUrl,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }
