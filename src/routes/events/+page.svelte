<script lang="ts">
    import type { PageData } from './$types';
    import Icon from '$lib/components/Icon.svelte';
    // import { formatDateTime } from '$lib/utils/dateUtils'; // Create helper
  
     export let data: PageData;
  
     function formatDateTime(date: Date | null | undefined): string {
       if (!date) return '';
       try {
           return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
       } catch { return 'Invalid Date'; }
     }
  
      function getLocationDisplay(event: typeof data.eventItems[0]): string {
          switch(event.location_type) {
              case 'physical': return event.location_address || 'Physical Location TBD';
              case 'virtual': return event.location_virtual_url ? 'Online Event' : 'Virtual Event TBD';
              case 'hybrid': return `Hybrid: ${event.location_address || 'Physical TBD'} / Online`;
              default: return 'Location TBD';
          }
      }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8">
       <div class="flex flex-wrap justify-between items-center mb-6 border-b pb-4 dark:border-gray-700 gap-4">
           <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">Events</h1>
  
           <!-- Filter Controls -->
            <div class="flex items-center space-x-2 text-sm">
               <span class="text-gray-600 dark:text-gray-400">Show:</span>
               <a href="/events?filter=upcoming" class="px-2 py-1 rounded"
                  class:bg-blue-100={data.currentFilter !== 'past'}
                  class:dark:bg-blue-900={data.currentFilter !== 'past'}
                  class:text-blue-700={data.currentFilter !== 'past'}
                  class:dark:text-blue-300={data.currentFilter !== 'past'}
                  class:text-gray-500={data.currentFilter === 'past'}
                  class:dark:text-gray-400={data.currentFilter === 'past'}
                  class:hover:bg-gray-200={data.currentFilter === 'past'}
                  class:dark:hover:bg-gray-700={data.currentFilter === 'past'}
                  aria-current={data.currentFilter !== 'past' ? 'page' : undefined}
               >Upcoming</a>
               <a href="/events?filter=past" class="px-2 py-1 rounded"
                  class:bg-blue-100={data.currentFilter === 'past'}
                  class:dark:bg-blue-900={data.currentFilter === 'past'}
                  class:text-blue-700={data.currentFilter === 'past'}
                  class:dark:text-blue-300={data.currentFilter === 'past'}
                  class:text-gray-500={data.currentFilter !== 'past'}
                  class:dark:text-gray-400={data.currentFilter !== 'past'}
                  class:hover:bg-gray-200={data.currentFilter !== 'past'}
                  class:dark:hover:bg-gray-700={data.currentFilter !== 'past'}
                  aria-current={data.currentFilter === 'past' ? 'page' : undefined}
               >Past</a>
           </div>
  
  
           {#if data.session} 
              <a href="/events/new" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 ml-auto">
                 <Icon name="plus" class="w-4 h-4 mr-2"/> Add Event
              </a>
           {/if}
      </div>
  
      {#if data.error}
           <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
              <p class="font-bold">Error Loading Events</p>
              <p>{data.error}</p>
          </div>
      {:else if data.eventItems.length === 0}
           <p class="text-center text-gray-500 dark:text-gray-400 italic py-10">No {data.currentFilter} events found.</p>
      {:else}
          <div class="space-y-6">
              {#each data.eventItems as event (event.slug)}
                   <a href={`/events/${event.slug}`} class="flex flex-col md:flex-row group bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden border border-gray-200 dark:border-gray-700">
                       {#if event.featured_image_url}
                           <img src={event.featured_image_url} alt={event.title} class="w-full md:w-48 h-48 md:h-auto object-cover flex-shrink-0"/>
                       {:else}
                           <div class="w-full md:w-48 h-48 md:h-auto bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                               <Icon name="loading" class="w-12 h-12 text-gray-400 dark:text-gray-500"/>
                           </div>
                       {/if}
                       <div class="p-4 flex flex-col justify-between flex-grow">
                          <div>
                               <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400">{event.title}</h2>
                               {#if event.summary}
                                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">{event.summary}</p>
                               {/if}
                          </div>
                           <div class="text-xs mt-2 text-gray-500 dark:text-gray-400">
                              <p><span class="font-medium">When:</span> {formatDateTime(event.start_datetime)}</p>
                              <p><span class="font-medium">Where:</span> {getLocationDisplay(event)}</p>
                           </div>
                       </div>
                  </a>
              {/each}
          </div>
           <!-- Add Pagination controls later -->
      {/if}
  
  </div>