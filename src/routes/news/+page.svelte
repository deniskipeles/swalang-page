<script lang="ts">
    import type { PageData } from './$types';
    import Icon from '$lib/components/Icon.svelte'; // Assuming Icon component
    // Helper for date formatting (create if needed)
    // import { formatDate } from '$lib/utils/dateUtils';
  
    export let data: PageData;
  
    function formatDate(date: Date | null | undefined): string {
       if (!date) return '';
       try {
           return new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
       } catch {
           return 'Invalid Date';
       }
    }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8">
      <div class="flex justify-between items-center mb-6 border-b pb-4 dark:border-gray-700">
           <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">News</h1>
           {#if data.session} 
              <a href="/news/new"
                 class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
              >
                  <Icon name="plus" class="w-4 h-4 mr-2"/> Add Article
              </a>
           {/if}
      </div>
  
      {#if data.error}
           <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
              <p class="font-bold">Error Loading News</p>
              <p>{data.error}</p>
          </div>
      {:else if data.newsItems.length === 0}
          <p class="text-center text-gray-500 dark:text-gray-400 italic py-10">No news articles found.</p>
      {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {#each data.newsItems as article (article.slug)}
                  <a href={`/news/${article.slug}`} class="block group bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                       {#if article.featured_image_url}
                          <img src={article.featured_image_url} alt={article.title} class="w-full h-48 object-cover transition-transform group-hover:scale-105"/>
                       {:else}
                           <div class="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                               <Icon name="file" class="w-12 h-12 text-gray-400 dark:text-gray-500"/>
                           </div>
                       {/if}
                       <div class="p-4">
                           <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">{article.title}</h2>
                           {#if article.summary}
                              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">{article.summary}</p>
                           {/if}
                           <p class="text-xs text-gray-400 dark:text-gray-500">Published: {formatDate(article.published_at)}</p>
                       </div>
                  </a>
              {/each}
          </div>
           <!-- Add Pagination controls later -->
      {/if}
  </div>