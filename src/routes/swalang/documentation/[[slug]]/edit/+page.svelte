<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import Icon from '$lib/components/Icon.svelte';
    import AIChat from '$lib/components/AIChat.svelte'; // Import AI Chat
    import { onMount } from 'svelte';
	import AiContextSelector from '$lib/components/AIContextSelector.svelte';
  
    export let data: PageData; // From load: isEditing, docData
    export let form: ActionData; // From actions: saveDoc results
  
    let isSubmitting = false;
  
    // --- AI Assistance State ---
    let showAiChat = false;
    let aiContext = ''; // Context selected by the user
    let targetField: 'title' | 'summary' | 'content_eng' | 'content_sw' | null = null; // Which field AI should help with
  
    // Bind form fields to data for editing, or initialize for creating
    let slug = data.docData?.slug || '';
    let title = data.docData?.title || '';
    let category = data.docData?.category || '';
    let summary = data.docData?.summary || '';
    let content_eng = data.docData?.content_eng || '';
    let content_sw = data.docData?.content_sw || '';
  
    // Keep track of initial slug for comparison if needed
    const initialSlug = data.docData?.slug;
  
    // Enhance function for save form
    function handleSaveFormUpdate() {
      isSubmitting = true;
      return async ({ result, update }: { result: any, update: any }) => {
        // Redirect happens automatically on success via server-side redirect
        // Errors are handled by the 'form' prop reactivity
        isSubmitting = false;
        await update();
      };
    }
  
    // --- AI Context Selection Logic ---
    // TODO: Implement UI for selecting context. This could involve:
    // 1. Modals/Drawers listing categories, keywords, other docs.
    // 2. Fetching data for these items using services.
    // 3. Allowing user to select text/content.
    // 4. Updating the `aiContext` variable.
    function openContextSelector(field: 'title' | 'summary' | 'content_eng' | 'content_sw') {
        targetField = field;
        // For now, just use existing content as context example
        switch (field) {
            case 'title': aiContext = title; break;
            case 'summary': aiContext = summary; break;
            case 'content_eng': aiContext = content_eng; break;
            case 'content_sw': aiContext = content_sw; break;
        }
        showAiChat = true;
        console.log(`AI context set for ${field}:`, aiContext);
        // In a real implementation, you'd open a modal here to fetch/select context
        alert("AI Context Selection UI not implemented yet. Using current field content as example context.");
    }
  
    // --- Event Handlers ---
    let notification: { type: 'success' | 'error'; message: string } | null = null;
    function handleNotification(event: CustomEvent<{ type: 'success' | 'error'; message: string } | null>){
        notification = event.detail;
        if(notification){
                setTimeout(() => notification = null, 3500);
        }
    }

     // --- AI Context Selection Logic ---
     let showAiContextSelector = false; // Renamed for clarity
    function openContextSelectorModal(field: 'title' | 'summary' | 'content_eng' | 'content_sw') {
        targetField = field;
        showAiContextSelector = true; // Open the selector modal
        showAiChat = false; // Ensure chat is closed when selector opens
    }

    function handleContextSelected(event: CustomEvent<string>) {
        aiContext = event.detail; // Get the selected context string
        showAiContextSelector = false; // Close selector modal
        showAiChat = true; // Open the AI chat modal with the new context
        console.log(`Context selected for ${targetField}:`, aiContext);
    }
  </script>
  
  <div class="container mx-auto p-4 md:p-8 relative">
  
      <!-- Back Link -->
      <div class="mb-4">
          {#if data.isEditing}
              <a href={`/swalang/documentation/${initialSlug}`} class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Documentation</a>
          {:else}
              <a href="/swalang/documentation" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Documentation Index</a>
          {/if}
      </div>
  
      <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">
          {data.isEditing ? 'Edit Documentation' : 'Create New Documentation'}
      </h1>
  
      <!-- Form for Creating/Editing -->
      <form
          method="POST"
          action="?/saveDoc"
          use:enhance={handleSaveFormUpdate}
          class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-6"
      >
           <!-- Display general form errors -->
           {#if form?.error}
               <p class="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">{form.error}</p>
           {/if}
  
          <!-- Slug Input (Readonly for edit, required for create) -->
          <div>
              <label for="doc-slug" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Slug (URL Identifier) {#if !data.isEditing}<span class="text-red-500">*</span>{/if}
              </label>
              <input
                  type="text"
                  id="doc-slug"
                  name="slug"
                  required={!data.isEditing}
                  readonly={data.isEditing}
                  bind:value={slug}
                  placeholder="e.g., standard-library-io"
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  title="Lowercase letters, numbers, and hyphens only."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white read-only:bg-gray-100 dark:read-only:bg-gray-600 read-only:cursor-not-allowed"
                  aria-describedby="slug-error"
              />
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Unique URL path (e.g., /swalang/documentation/<b>{slug || 'your-slug'}</b>). Cannot be changed after creation.</p>
              {#if form?.errors?.slug} <p id="slug-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.slug[0]}</p> {/if}
          </div>
  
          <!-- Title Input -->
           <div class="relative group">
              <label for="doc-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
              <input
                  type="text"
                  id="doc-title"
                  name="title"
                  required
                  bind:value={title}
                  placeholder="e.g., Standard Input/Output"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  aria-describedby="title-error"
              />
               {#if form?.errors?.title} <p id="title-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.title[0]}</p> {/if}
               <!-- AI Button -->
               <button type="button" on:click={() => openContextSelectorModal('title')} title="Get AI Help for Title"
                class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI Context</button>
                <!-- <button type="button" on:click={() => openContextSelector('title')} title="Get AI Help for Title"
                      class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI ✨</button> -->
          </div>
  
           <!-- Category Input -->
           <div>
              <label for="doc-category" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category (Optional)</label>
              <input
                  type="text"
                  id="doc-category"
                  name="category"
                  bind:value={category}
                  placeholder="e.g., Standard Library, Syntax"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  aria-describedby="category-error"
              />
              {#if form?.errors?.category} <p id="category-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.category[0]}</p> {/if}
          </div>
  
           <!-- Summary Textarea -->
          <div class="relative group">
              <label for="doc-summary" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary (Optional)</label>
              <textarea
                  id="doc-summary"
                  name="summary"
                  rows="3"
                  bind:value={summary}
                  placeholder="A brief summary for listings..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-y"
                  aria-describedby="summary-error"
              ></textarea>
               {#if form?.errors?.summary} <p id="summary-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.summary[0]}</p> {/if}
               <!-- AI Button -->
               <button type="button" on:click={() => openContextSelectorModal('summary')} title="Get AI Help for Summary"
                class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI Context</button>
                <!-- <button type="button" on:click={() => openContextSelector('summary')} title="Get AI Help for Summary"
                      class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI ✨</button> -->
          </div>
  
          <!-- Content English Textarea -->
          <div class="relative group">
              <label for="doc-content-eng" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (English, Markdown)</label>
              <textarea
                  id="doc-content-eng"
                  name="content_eng"
                  rows="15"
                  bind:value={content_eng}
                  placeholder="Write documentation here using Markdown..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-y font-mono text-sm"
                  aria-describedby="content-eng-error"
              ></textarea>
               {#if form?.errors?.content_eng} <p id="content-eng-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.content_eng[0]}</p> {/if}
              <!-- AI Button -->
              <button type="button" on:click={() => openContextSelectorModal('content_eng')} title="Get AI Help for English Content"
                class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI Context</button>
                <!-- <button type="button" on:click={() => openContextSelector('content_eng')} title="Get AI Help for English Content"
                      class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI ✨</button> -->
          </div>
  
          <!-- Content Swahili Textarea -->
          <div class="relative group">
              <label for="doc-content-sw" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content (Swahili, Markdown)</label>
              <textarea
                  id="doc-content-sw"
                  name="content_sw"
                  rows="15"
                  bind:value={content_sw}
                  placeholder="Andika nyaraka hapa ukitumia Markdown..."
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-y font-mono text-sm"
                  aria-describedby="content-sw-error"
              ></textarea>
               {#if form?.errors?.content_sw} <p id="content-sw-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.content_sw[0]}</p> {/if}
               <!-- AI Button -->
               <button type="button" on:click={() => openContextSelectorModal('content_sw')} title="Get AI Help for Swahili Content"
                class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI Context</button>
                <!-- <button type="button" on:click={() => openContextSelector('content_sw')} title="Get AI Help for Swahili Content"
                      class="absolute top-[28px] right-2 p-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs">AI ✨</button> -->
          </div>
  
          <!-- Submit Button -->
          <div class="flex justify-end">
               <button
                   type="submit"
                   disabled={isSubmitting}
                   class="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
               >
                   {#if isSubmitting} <Icon name="loading" class="w-4 h-4 mr-2"/> Saving...
                   {:else} <Icon name="loading" class="w-4 h-4 mr-2"/> {data.isEditing ? 'Save Changes' : 'Create Page'}
                   {/if} <!-- Replace icon -->
               </button>
          </div>
      </form>

      {#if showAiContextSelector}
        <AiContextSelector
            {data}
            {targetField}
            on:close={() => showAiContextSelector = false}
            on:selectContext={handleContextSelected}
        />
      {/if}
  
      <!-- AI Chat Modal/Drawer (Conditional Rendering) -->
      {#if showAiChat}
          <div class="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4" on:click|self={() => showAiChat = false}> 
               <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full h-[70vh] max-h-[600px] flex flex-col overflow-hidden" on:click|stopPropagation>
                   <div class="p-3 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                        <h3 class="font-semibold text-lg dark:text-white">AI Assistant {targetField ? `(for ${targetField})` : ''}</h3>
                        <button on:click={() => showAiChat = false} class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600">×</button>
                   </div>
                   <div class="flex-grow min-h-0">
                      <AIChat data={data} context={aiContext} on:notification={handleNotification} />
                   </div>
              </div>
          </div>
      {/if}
  
  </div>
  
  <style>
      /* Add styles if needed, e.g., for AI button positioning/appearance */
      .group:hover .ai-button { /* Example using group-hover */
          opacity: 1;
      }
  </style>