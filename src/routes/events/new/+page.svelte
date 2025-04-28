<script lang="ts">
    import type { ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { debounce } from '$lib/utils/debounce'; // Assuming debounce utility exists
    import Icon from '$lib/components/Icon.svelte';
	import { onMount } from 'svelte';
  
    export let form: ActionData; // Data from form actions (errors, submitted values)
  
    let isSubmitting = false;
  
    // --- Form Field State (bound for repopulation on error) ---
    // Initialize from 'form' prop if it exists (meaning an error occurred)
    let title = form?.title || '';
    let slug = form?.slug || '';
    let summary = form?.summary || '';
    let description = form?.description || '';
    let featured_image_url = form?.featured_image_url || '';
    let start_datetime = form?.start_datetime || '';
    let end_datetime = form?.end_datetime || '';
    let location_type: 'physical' | 'virtual' | 'hybrid' = form?.location_type || 'physical'; // Default to physical
    let location_address = form?.location_address || '';
    let location_virtual_url = form?.location_virtual_url || '';
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
        // We just need to manage the submitting state
         return async ({ result, update }) => {
             // errors/values are automatically updated via the 'form' prop
             isSubmitting = false;
             await update(); // Ensure form prop is updated for error display
         };
    }
  
    // Helper for formatting date for datetime-local input
    function formatDateForInput(dateString: string | undefined | null): string {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
             // Format: YYYY-MM-DDTHH:mm
             // Adjust for local timezone offset
             const timezoneOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
             const localISOTime = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
            return localISOTime;
        } catch {
            return ''; // Return empty on invalid date string
        }
    }
     // Initialize date fields correctly if form data exists
     onMount(() => {
          if (form?.start_datetime) start_datetime = formatDateForInput(form.start_datetime);
          if (form?.end_datetime) end_datetime = formatDateForInput(form.end_datetime);
     });
  
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-3xl">
      <div class="mb-4">
          <a href="/events" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Events</a>
      </div>
  
      <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Create New Event</h1>
  
      <form
          method="POST"
          action="?/create" 
          use:enhance={handleSubmit}
          class="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700"
      >
          <!-- General Form Error -->
          {#if form?.error && !form?.errors}
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">
                  <p class="text-sm font-medium text-red-700 dark:text-red-300">Error creating event:</p>
                  <p class="text-sm text-red-600 dark:text-red-400 mt-1">{form.error}</p>
              </div>
          {/if}
  
          <!-- Title -->
          <div>
              <label for="event-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Event Title <span class="text-red-500">*</span></label>
              <input
                  type="text" id="event-title" name="title" required maxlength="250"
                  bind:value={title}
                  class="w-full input-style"
                  aria-describedby="title-error"
              />
              {#if form?.errors?.title}<p id="title-error" class="error-text">{form.errors.title[0]}</p>{/if}
          </div>
  
          <!-- Slug -->
          <div>
              <label for="event-slug" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Slug <span class="text-red-500">*</span></label>
              <input
                  type="text" id="event-slug" name="slug" required pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$" maxlength="150"
                  bind:value={slug}
                  class="w-full input-style"
                  aria-describedby="slug-error"
              />
              <p class="help-text">URL part (auto-generated from title, unique, lowercase-numbers-hyphens).</p>
              {#if form?.errors?.slug}<p id="slug-error" class="error-text">{form.errors.slug[0]}</p>{/if}
          </div>
  
          <!-- Summary -->
          <div>
              <label for="event-summary" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary (Optional)</label>
              <textarea
                  id="event-summary" name="summary" rows="3" maxlength="600"
                  bind:value={summary}
                  class="w-full input-style resize-y"
                  aria-describedby="summary-error"
              ></textarea>
              {#if form?.errors?.summary}<p id="summary-error" class="error-text">{form.errors.summary[0]}</p>{/if}
          </div>
  
          <!-- Description -->
          <div>
              <label for="event-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Description (Optional, Markdown)</label>
              <textarea
                  id="event-description" name="description" rows="10"
                  bind:value={description}
                  class="w-full input-style resize-y font-mono text-sm"
                  aria-describedby="description-error"
              ></textarea>
               {#if form?.errors?.description}<p id="description-error" class="error-text">{form.errors.description[0]}</p>{/if}
          </div>
  
          <!-- Featured Image URL -->
          <div>
              <label for="event-image" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Featured Image URL (Optional)</label>
              <input
                  type="url" id="event-image" name="featured_image_url" maxlength="512"
                  bind:value={featured_image_url}
                  placeholder="https://..."
                  class="w-full input-style"
                  aria-describedby="image-error"
              />
              {#if form?.errors?.featured_image_url}<p id="image-error" class="error-text">{form.errors.featured_image_url[0]}</p>{/if}
          </div>
  
          <!-- Date/Time Fields -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label for="start-datetime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date & Time <span class="text-red-500">*</span></label>
                  <input
                      type="datetime-local" id="start-datetime" name="start_datetime" required
                      bind:value={start_datetime}
                      class="w-full input-style"
                      aria-describedby="start-datetime-error"
                  />
                  {#if form?.errors?.start_datetime}<p id="start-datetime-error" class="error-text">{form.errors.start_datetime[0]}</p>{/if}
              </div>
              <div>
                   <label for="end-datetime" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date & Time (Optional)</label>
                   <input
                      type="datetime-local" id="end-datetime" name="end_datetime"
                      bind:value={end_datetime}
                      min={start_datetime}
                      class="w-full input-style"
                       aria-describedby="end-datetime-error"
                   />
                    {#if form?.errors?.end_datetime}<p id="end-datetime-error" class="error-text">{form.errors.end_datetime[0]}</p>{/if}
              </div>
          </div>
  
          <!-- Location Fields -->
          <div>
              <label for="location-type" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location Type <span class="text-red-500">*</span></label>
              <select id="location-type" name="location_type" required bind:value={location_type} class="w-full input-style">
                  <option value="physical">Physical</option>
                  <option value="virtual">Virtual</option>
                  <option value="hybrid">Hybrid</option>
              </select>
               {#if form?.errors?.location_type}<p class="error-text">{form.errors.location_type[0]}</p>{/if}
          </div>
  
          {#if location_type === 'physical' || location_type === 'hybrid'}
               <div class="transition-all">
                  <label for="location-address" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Physical Address {#if location_type === 'physical'}<span class="text-red-500">*</span>{/if}
                  </label>
                  <textarea
                      id="location-address" name="location_address" rows="2" maxlength="500"
                      bind:value={location_address}
                      required={location_type === 'physical'}
                      class="w-full input-style resize-y"
                      aria-describedby="address-error"
                  ></textarea>
                  {#if form?.errors?.location_address}<p id="address-error" class="error-text">{form.errors.location_address[0]}</p>{/if}
              </div>
          {/if}
  
          {#if location_type === 'virtual' || location_type === 'hybrid'}
               <div class="transition-all">
                   <label for="location-url" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                       Virtual Event URL / Info {#if location_type === 'virtual'}<span class="text-red-500">*</span>{/if}
                  </label>
                   <input
                      type="url" id="location-url" name="location_virtual_url" maxlength="512"
                      bind:value={location_virtual_url}
                       required={location_type === 'virtual'}
                      placeholder="https://..."
                      class="w-full input-style"
                      aria-describedby="url-error"
                   />
                   {#if form?.errors?.location_virtual_url}<p id="url-error" class="error-text">{form.errors.location_virtual_url[0]}</p>{/if}
              </div>
          {/if}
  
          <!-- Publish Status -->
          <div class="flex items-center">
              <input
                  type="checkbox" id="is_published" name="is_published"
                  bind:checked={is_published}
                  class="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded mr-2"
              />
              <label for="is_published" class="text-sm text-gray-700 dark:text-gray-300">Publish this event immediately</label>
          </div>
  
  
          <!-- Submit Button -->
          <div class="pt-4 border-t dark:border-gray-700">
               <button
                   type="submit"
                   disabled={isSubmitting}
                   class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
               >
                   {#if isSubmitting} <Icon name="loading" class="w-4 h-4 mr-2"/> Creating...
                   {:else} <Icon name="loading" class="w-4 h-4 mr-2"/> Create Event
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
   /* Add other styles as needed */
  </style> -->