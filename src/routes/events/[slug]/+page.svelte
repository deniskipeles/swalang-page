<script lang="ts">
    import type { PageData } from './$types';
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';
    import Icon from '$lib/components/Icon.svelte';
  
    export let data: PageData; // { eventData }
  
    async function renderMarkdown(markdown: string | null | undefined): Promise<string> { /* ... */ }
    function formatDateTime(date: Date | null | undefined, style: 'medium' | 'short' = 'medium'): string {
       if (!date) return '';
       try {
           return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: style });
       } catch { return 'Invalid Date'; }
     }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-4xl">
       <!-- Back Link -->
      <div class="mb-4">
          <a href="/events" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Events</a>
      </div>
  
       {#if data.eventData}
           <article>
               <header class="mb-6 pb-4 border-b dark:border-gray-700">
                  <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mb-2">{data.eventData.title}</h1>
                   {#if data.eventData.summary}
                      <p class="mt-1 text-lg text-gray-600 dark:text-gray-400">{data.eventData.summary}</p>
                   {/if}
               </header>
  
                {#if data.eventData.featured_image_url}
                  <img src={data.eventData.featured_image_url} alt={data.eventData.title} class="w-full h-auto max-h-[500px] object-cover rounded-lg mb-6 shadow"/>
               {/if}
  
               <!-- Event Details -->
               <div class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 border dark:border-gray-700 rounded-lg text-sm">
                   <h2 class="font-semibold mb-2 text-gray-800 dark:text-gray-200">Event Details</h2>
                   <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                       <div>
                           <strong class="text-gray-600 dark:text-gray-400">Starts:</strong>
                           <span class="ml-1 text-gray-900 dark:text-gray-100">{formatDateTime(data.eventData.start_datetime)}</span>
                       </div>
                        {#if data.eventData.end_datetime}
                        <div>
                             <strong class="text-gray-600 dark:text-gray-400">Ends:</strong>
                             <span class="ml-1 text-gray-900 dark:text-gray-100">{formatDateTime(data.eventData.end_datetime)}</span>
                        </div>
                        {/if}
                         <div>
                           <strong class="text-gray-600 dark:text-gray-400">Location:</strong>
                           {#if data.eventData.location_type === 'physical' || data.eventData.location_type === 'hybrid'}
                              <span class="ml-1 text-gray-900 dark:text-gray-100">{data.eventData.location_address || 'Address TBD'}</span>
                           {/if}
                           {#if data.eventData.location_type === 'virtual' || data.eventData.location_type === 'hybrid'}
                               <a href={data.eventData.location_virtual_url || '#'} target="_blank" rel="noopener noreferrer" class="ml-1 text-blue-600 dark:text-blue-400 hover:underline">
                                  {data.eventData.location_virtual_url ? 'Online Link' : 'Virtual Event'}
                              </a>
                           {/if}
                           {#if !data.eventData.location_address && !data.eventData.location_virtual_url}
                              <span class="ml-1 text-gray-900 dark:text-gray-100">Location TBD</span>
                           {/if}
                       </div>
                   </div>
               </div>
  
               <!-- Description Content -->
                <h2 class="text-2xl font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">Description</h2>
                <div class="prose prose-lg dark:prose-invert max-w-none">
                    {#await renderMarkdown(data.eventData.description)}<p>Loading...</p>{:then html}{@html html}{:catch}<p class="text-red-500">Error rendering.</p>{/await}
                </div>
           </article>
           <!-- TODO: Add Edit Button based on permissions -->
       {:else}
          <p class="text-red-500">Event not found.</p>
       {/if}
  </div>
   <style> /* Import or define prose styles */ </style>