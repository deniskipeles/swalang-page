<script lang="ts">
    import type { PageData } from './$types';
    import { renderMarkdown } from '$lib/utils/renderMarkdown';
	import Icon from '$lib/components/Icon.svelte';
  
    export let data: PageData; // From load: docId, slug, title, content, currentLanguage, etc.
  
    
  
    // Determine the URL for the other language
    $: otherLang = data.currentLanguage === 'eng' ? 'sw' : 'eng';
    $: switchLangUrl = `/swalang/documentation/${data.slug}?language=${otherLang}`;
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8">
  
      <!-- Breadcrumb or Back Link -->
      <div class="mb-4 text-sm">
          <!-- TODO: Add link to a documentation index page if you create one -->
          <a href="/swalang" class="text-blue-600 dark:text-blue-400 hover:underline">Collaboration Home</a>
          <span class="mx-1 text-gray-400">/</span>
          <span class="text-gray-600 dark:text-gray-300">Documentation</span>
          <!-- Add category link here if available: / data.category -->
      </div>
  
      {#if data.title}
          <!-- Documentation Header -->
          <div class="mb-6 pb-4 border-b border-gray-300 dark:border-gray-700">
              <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">{data.title}</h1>
               <!-- Optionally display summary if it exists -->
               {#if data.summary}
                   <p class="mt-1 text-md text-gray-600 dark:text-gray-400">{data.summary}</p>
               {/if}
          </div>
  
          <!-- Language Switcher -->
          <div class="mb-6 flex justify-end items-center space-x-2 text-sm">
             <!-- ... (language switcher logic remains the same) ... -->
              <span class="text-gray-500 dark:text-gray-400">View in:</span>
              {#if data.currentLanguage === 'eng'} <span class="font-semibold text-gray-800 dark:text-gray-200">English</span> {:else} <a href={`/swalang/documentation/${data.slug}?language=eng`} class="text-blue-600 dark:text-blue-400 hover:underline">English</a> {/if}
              {#if data.otherLanguageAvailable}
                   <span class="text-gray-300 dark:text-gray-600">|</span>
                   {#if data.currentLanguage === 'sw'} <span class="font-semibold text-gray-800 dark:text-gray-200">Swahili</span> {:else} <a href={`/swalang/documentation/${data.slug}?language=sw`} class="text-blue-600 dark:text-blue-400 hover:underline">Swahili</a> {/if}
               {/if}

               {#if data.session?.user?.id == data?.created_by} 
                    <a href={`/swalang/documentation/${data?.slug ? data.slug+'/edit' : 'edit'}`}
                        class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800"
                    >
                        <Icon name="swalang" class="w-4 h-4 mr-2"/> EDIT
                    </a>
                {/if}
          </div>
  
  
          <!-- Documentation Content -->
          <div class="documentation-content prose prose-lg dark:prose-invert max-w-none bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
               {#await renderMarkdown(data.content)}
                  <p class="opacity-50 text-gray-500 dark:text-gray-400">Loading documentation...</p>
               {:then htmlContent}
                  {@html htmlContent}
               {:catch error}
                  <p class="text-red-500 dark:text-red-400">Error rendering documentation.</p>
               {/await}
          </div>
  
           <!-- Add link to edit documentation page later -->
           <!-- <div class="mt-6 text-right text-sm">
              <a href={`/swalang/documentation/${data.slug}/edit?language=${data.currentLanguage}`} class="text-blue-600 dark:text-blue-400 hover:underline">Edit this page</a>
           </div> -->
  
      {:else}
          <!-- Fallback if data somehow missing despite load success -->
          <p class="text-red-500 dark:text-red-400">Could not load documentation details.</p>
      {/if}
  </div>
  
  <style>
      /* Reuse prose styles defined elsewhere or add them here */
      /* ... */
      .prose :global(pre) { /* ... */ }
      .prose :global(code):not(:global(pre code)) { /* ... */ }
      /* ... */
  </style>