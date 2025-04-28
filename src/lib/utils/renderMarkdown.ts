import { marked } from 'marked';
import DOMPurify from 'dompurify';


// Re-use the async markdown renderer (no changes needed here)
export async function renderMarkdown(markdown: string | null | undefined): Promise<string> {
    if (!markdown) return '<p class="italic text-gray-500 dark:text-gray-400">No content available for this language.</p>';
    try {
        const rawHtml = await marked.parse(markdown, { async: true, gfm: true, breaks: true });
        return DOMPurify.sanitize(rawHtml);
    } catch (error) {
        console.error("Markdown rendering/sanitization failed:", error);
        const preElement = document.createElement('pre');
        preElement.textContent = markdown;
        return `<p class="text-red-500 dark:text-red-400 text-xs italic">Error rendering documentation.</p>${preElement.outerHTML}`;
    }
}