<script lang="ts">
    import type { ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { debounce } from '$lib/utils/debounce';
    // ... other imports
  
    export let form: ActionData;
    let isSubmitting = false;
    let title = form?.title || '';
    let slug = form?.slug || '';
  
    // Simple slug generator (client-side suggestion)
    const generateSlug = debounce(() => {
        if(form?.slug) return; // Don't overwrite if user typed or error occurred
        slug = title
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-'); // Replace multiple hyphens with single
    }, 300);
  
    $: if (title) generateSlug(); // Trigger slug generation when title changes
  
    function handleSubmit() { isSubmitting = true; /* enhance handles rest */ }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-3xl">
      <h1 class="text-3xl font-bold mb-6">Create New News Article</h1>
      <form method="POST" action="?/create" use:enhance={handleSubmit} class="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          {#if form?.error}<p class="error-box">{form.error}</p>{/if} <!-- Style error box -->
  
          <div><label>Title *</label><input type="text" name="title" bind:value={title} required class="..." />{#if form?.errors?.title}<p class="error-text">{form.errors.title[0]}</p>{/if}</div>
          <div><label>Slug *</label><input type="text" name="slug" bind:value={slug} required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" class="..." />{#if form?.errors?.slug}<p class="error-text">{form.errors.slug[0]}</p>{/if}<p class="help-text">URL part (auto-generated from title, unique)</p></div>
          <div><label>Summary</label><textarea name="summary" rows="3" value={form?.summary || ''} class="..."></textarea>{#if form?.errors?.summary}<p class="error-text">{form.errors.summary[0]}</p>{/if}</div>
          <div><label>Content (Markdown)</label><textarea name="content" rows="15" value={form?.content || ''} class="... font-mono"></textarea>{#if form?.errors?.content}<p class="error-text">{form.errors.content[0]}</p>{/if}</div>
          <div><label>Featured Image URL</label><input type="url" name="featured_image_url" value={form?.featured_image_url || ''} class="..." />{#if form?.errors?.featured_image_url}<p class="error-text">{form.errors.featured_image_url[0]}</p>{/if}</div>
          <div><label>Published At (Optional)</label><input type="datetime-local" name="published_at" value={form?.published_at || ''} class="..." />{#if form?.errors?.published_at}<p class="error-text">{form.errors.published_at[0]}</p>{/if}<p class="help-text">Leave blank to publish now if checked below.</p></div>
          <div class="flex items-center"><input type="checkbox" name="is_published" id="is_published" class="mr-2" checked={form?.is_published === 'on'} /><label for="is_published">Publish this article</label></div>
  
          <button type="submit" disabled={isSubmitting} class="button-primary">{isSubmitting ? 'Creating...' : 'Create Article'}</button>
      </form>
  </div>
  <style> /* Add styles for error-box, error-text, help-text, button-primary */ </style>