<script lang="ts">
    import type { PageData } from './$types';
    import { renderMarkdown } from '$lib/utils/renderMarkdown';
    import { formatDateLong } from '$lib/utils/formatDate';
  
    export let data: PageData; // { article }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-4xl">
      <!-- Back Link -->
      <div class="mb-4">
          <a href="/news" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to News</a>
      </div>
  
      {#if data.article}
          <article>
              <header class="mb-6 pb-4 border-b dark:border-gray-700">
                  <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">{data.article.title}</h1>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                      Published on {formatDateLong(data.article.published_at)}
                       <!-- TODO: Add Author name by joining profile -->
                       <!-- | Last updated on {formatDate(data.article.updated_at)} -->
                  </p>
              </header>
  
               {#if data.article.featured_image_url}
                  <img src={data.article.featured_image_url} alt={data.article.title} class="w-full h-auto max-h-[500px] object-cover rounded-lg mb-6 shadow"/>
               {/if}
  
              <!-- Content -->
               <div class="prose prose-lg dark:prose-invert max-w-none">
                   {#await renderMarkdown(data.article.content)}
                       <p>Loading content...</p>
                   {:then htmlContent}
                       {@html htmlContent}
                   {:catch error}
                        <p class="text-red-500">Error rendering content.</p>
                   {/await}
               </div>
          </article>
           <!-- TODO: Add Edit Button based on permissions -->
           <!-- {#if hasEditPermission}
               <a href="/news/{data.article.slug}/edit" class="...">Edit Article</a>
           {/if} -->
      {:else}
          <!-- Should be caught by load function, but fallback -->
          <p class="text-red-500">Article not found.</p>
      {/if}
  </div>
  <style> /* Import or define prose styles */ </style>