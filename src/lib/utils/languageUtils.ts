// src/lib/utils/languageUtils.ts

// Monaco Language IDs: https://microsoft.github.io/monaco-editor/docs.html#interfaces/languages.ILanguageExtensionPoint.html
const extensionToLanguageMap: Record<string, string> = {
    '.sw': 'swalang',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.css': 'css',
    '.scss': 'scss',
    '.less': 'less',
    '.html': 'html',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.md': 'markdown',
    '.py': 'python',
    '.java': 'java',
    '.cs': 'csharp',
    '.php': 'php',
    '.rb': 'ruby',
    '.go': 'go',
    '.rs': 'rust',
    '.sh': 'shell',
    '.sql': 'sql',
    '.xml': 'xml',
    '.dockerfile': 'dockerfile',
    '.graphql': 'graphql',
    '.vue': 'vue', // Needs specific setup if using vue features heavily
    '.svelte': 'html', // Basic HTML highlighting for svelte works okay
    '.log': 'log',
    '.plaintext': 'plaintext',
    '.txt': 'plaintext',
};

export function getLanguageFromFilename(filename: string | undefined | null): string {
    if (!filename) return 'plaintext';
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return extensionToLanguageMap[extension] || 'plaintext'; // Default to plaintext
}