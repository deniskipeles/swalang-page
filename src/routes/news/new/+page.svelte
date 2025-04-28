<script lang="ts">
    import type { ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { debounce } from '$lib/utils/debounce'; // Assuming debounce utility exists
    import Icon from '$lib/components/Icon.svelte';
    import { onMount } from 'svelte';
  
    export let form: ActionData; // Data from form actions (errors, submitted values)
  
    let isSubmitting = false;
  
    // --- Form Field State (bound for repopulation on error) ---
    let title = form?.title || '';
    let slug = form?.slug || '';
    let summary = form?.summary || '';
    let content = form?.content || ''; // Main markdown content
    let featured_image_url = form?.featured_image_url || '';
    let published_at = form?.published_at || ''; // Store as string from input
    let is_published = form?.is_published === 'on'; // Convert checkbox state
  
    // Simple slug generator (client-side suggestion)
    const generateSlug = debounce(() => {
        if(form?.slug) return; // Don't overwrite if submitted value exists (due to error)
        slug = title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
            .replace(/\s+/g, '-')        // Replace spaces with hyphens
            .replace(/-+/g, '-');       // Replace multiple hyphens with single
    }, 300);
  
    // Reactive: Generate slug when title changes (only if not repopulating from error)
    $: if (title && !form?.slug) generateSlug();
  
    // Enhance function for form submission
    function handleSubmit() {
        isSubmitting = true;
        // Progressive enhancement handles success/error state updates
        // Redirect on success is handled by the server action
         return async ({ result, update }) => {
             // errors/values are automatically updated via the 'form' prop
             isSubmitting = false;
             await update(); // Ensure form prop is updated for error display
             // Optional: Clear form manually IF result was a success but no redirect (shouldn't happen here)
             // if (result.type === 'success' && result.status === 200) { // Example check
             //     document.querySelector('form')?.reset(); // Manual reset if needed
             // }
         };
    }
  
     // Helper for formatting date for datetime-local input
     function formatDateForInput(dateString: string | undefined | null): string {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
             // Format: YYYY-MM-DDTHH:mm
             const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
             const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
            return localISOTime;
        } catch {
            return ''; // Return empty on invalid date string
        }
     }
      // Initialize date field correctly if form data exists
      onMount(() => {
          if (form?.published_at) published_at = formatDateForInput(form.published_at);
      });
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-3xl">
       <div class="mb-4">
          <a href="/news" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to News</a>
      </div>
  
      <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Create New News Article</h1>
  
      <form
          method="POST"
          action="?/create" 
          use:enhance={handleSubmit}
          class="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700"
      >
          <!-- General Form Error -->
          {#if form?.error && !form?.errors}
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">
                  <p class="text-sm font-medium text-red-700 dark:text-red-300">Error creating article:</p>
                  <p class="text-sm text-red-600 dark:text-red-400 mt-1">{form.error}</p>
              </div>
          {/if}
  
          <!-- Title -->
          <div>
              <label for="news-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
              <input
                  type="text" id="news-title" name="title" required maxlength="250"
                  bind:value={title}
                  class="w-full input-style"
                  aria-describedby="title-error"
              />
              {#if form?.errors?.title}<p id="title-error" class="error-text">{form.errors.title[0]}</p>{/if}
          </div>
  
          <!-- Slug -->
          <div>
              <label for="news-slug" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug <span class="text-red-500">*</span></label>
              <input
                  type="text" id="news-slug" name="slug" required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" maxlength="150"
                  bind:value={slug}
                  class="w-full input-style"
                  aria-describedby="slug-error"
              />
              <p class="help-text">URL part (auto-generated from title, unique, lowercase-numbers-hyphens).</p>
              {#if form?.errors?.slug}<p id="slug-error" class="error-text">{form.errors.slug[0]}</p>{/if}
          </div>
  
          <!-- Summary -->
          <div>
              <label for="news-summary" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary (Optional)</label>
              <textarea
                  id="news-summary" name="summary" rows="3" maxlength="600"
                  bind:value={summary}
                  class="w-full input-style resize-y"
                  aria-describedby="summary-error"
              ></textarea>
              {#if form?.errors?.summary}<p id="summary-error" class="error-text">{form.errors.summary[0]}</p>{/if}
          </div>
  
          <!-- Content -->
          <div>
              <label for="news-content" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (Markdown, Optional)</label>
              <textarea
                  id="news-content" name="content" rows="20"
                  bind:value={content}
                  class="w-full input-style resize-y font-mono text-sm"
                  aria-describedby="content-error"
                  placeholder="Write the main article content using Markdown..."
              ></textarea>
               {#if form?.errors?.content}<p id="content-error" class="error-text">{form.errors.content[0]}</p>{/if}
          </div>
  
          <!-- Featured Image URL -->
          <div>
              <label for="news-image" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Featured Image URL (Optional)</label>
              <input
                  type="url" id="news-image" name="featured_image_url" maxlength="512"
                  bind:value={featured_image_url}
                  placeholder="https://..."
                  class="w-full input-style"
                  aria-describedby="image-error"
              />
              {#if form?.errors?.featured_image_url}<p id="image-error" class="error-text">{form.errors.featured_image_url[0]}</p>{/if}
          </div>
  
           <!-- Publish Date -->
           <div>
               <label for="published-at" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publish Date & Time (Optional)</label>
               <input
                  type="datetime-local" id="published-at" name="published_at"
                  bind:value={published_at}
                  class="w-full input-style"
                  aria-describedby="published-at-error"
               />
               <p class="help-text">Schedule publication for a future date/time. If blank and "Publish" is checked, it publishes now.</p>
               {#if form?.errors?.published_at}<p id="published-at-error" class="error-text">{form.errors.published_at[0]}</p>{/if}
           </div>
  
          <!-- Publish Status -->
          <div class="flex items-center">
              <input
                  type="checkbox" id="is_published" name="is_published"
                  bind:checked={is_published}
                  class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded mr-2"
              />
              <label for="is_published" class="text-sm text-gray-700 dark:text-gray-300">Publish this article</label>
              <span class="text-xs text-gray-500 dark:text-gray-400 ml-2">(Allows the public to see it based on Publish Date)</span>
          </div>
  
          <!-- Submit Button -->
          <div class="pt-4 border-t dark:border-gray-700">
               <button
                   type="submit"
                   disabled={isSubmitting}
                   class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
               >
                   {#if isSubmitting} <Icon name="loading" class="w-4 h-4 mr-2"/> Creating...
                   {:else} <Icon name="loading" class="w-4 h-4 mr-2"/> Create Article
                   {/if} <!-- Replace Icon -->
               </button>
          </div>
      </form>
  </div>
  
  <!-- <style>
   /* Reusable styles (or use Tailwind directly) */
   .input-style {
      @apply px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm;
   }
   .error-text {
       @apply mt-1 text-xs text-red-600 dark:text-red-400;
   }
   .help-text {
       @apply mt-1 text-xs text-gray-500 dark:text-gray-400;
   }
   .error-box {
       /* Styles for the general form error box */
        @apply text-sm text-red-600 dark:text-red-400 mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded;
   }
  </style> -->