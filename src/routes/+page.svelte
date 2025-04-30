<script lang="ts">
  import type { PageData } from './$types';
  import Icon from '$lib/components/Icon.svelte'; // Assuming Icon component
	import Wasm from './Wasm.svelte';

  export let data: PageData; // { docs, news, events }

  // Simple date formatting helper
  function formatDate(date: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
      if (!date) return '';
      try {
          return new Date(date).toLocaleDateString(undefined, options);
      } catch {
          return 'Invalid Date';
      }
  }

</script>

<div class="container mx-auto p-4 md:p-8 space-y-12">
    <!-- <Wasm/> -->

    <!-- Welcome/Intro Section -->
    <section class="text-center py-8">
        <h1 class="text-4xl font-bold mb-2 text-gray-800 dark:text-gray-100">Welcome to the Swalang(Swahili based programming Language) Project & AI Assistant</h1>
        <p class="text-lg text-gray-600 dark:text-gray-400">Code, collaborate, explore documentation, news, and events.</p>
         <div class="mt-6 space-x-4">
             <!-- Link to the Editor -->
             <a href="/app" class="button-primary text-base">
                 <!-- <Icon name="loading" class="inline-block w-5 h-5 mr-2 align-text-bottom" /> -->
                 Launch AI Editor
             </a>
             <a title="Suggest Keywords That Are Sensible and Recognizable to be used as swahili programming keywords" href="/swalang" class="button-secondary text-base">Collaborate on Terms</a>
         </div>
    </section>

    <!-- Grid for Content Sections -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <!-- Documentation Section -->
        <section class="lg:col-span-1 space-y-3">
            <h2 class="text-xl font-semibold border-b pb-2 mb-3 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                <a href="/swalang/documentation" class="hover:text-blue-600 dark:hover:text-blue-400">Documentation</a>
            </h2>
            {#if data.docs.length > 0}
                <ul class="space-y-1.5"> 
                    {#each data.docs as doc (doc.slug)}
                        <li>
                            <a href={`/swalang/documentation/${doc.slug}`} class="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
                                {doc.title}
                            </a>
                        </li>
                    {/each}
                </ul>
                {#if data.docs.length >= 5}
                     <div class="pt-1 text-right"> 
                        <a href="/swalang/documentation" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">More Docs →</a>
                     </div>
                {/if}
            {:else}
                <p class="text-sm text-gray-500 dark:text-gray-400 italic">No documentation highlights available.</p>
            {/if}
        </section>

        <!-- News Section -->
         <section class="lg:col-span-1 space-y-3">
            <h2 class="text-xl font-semibold border-b pb-2 mb-3 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                 <a href="/news" class="hover:text-blue-600 dark:hover:text-blue-400">Latest News</a>
            </h2>
             {#if data.news.length > 0}
                <ul class="space-y-1"> 
                     {#each data.news as newsItem (newsItem.slug)}
                        <li>
                             <a href={`/news/${newsItem.slug}`} class="block text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 rounded group"> 
                                <time datetime={newsItem.published_at?.toString()} class="text-xs text-gray-500 dark:text-gray-400 mr-2 font-mono whitespace-nowrap">
                                    {formatDate(newsItem.published_at, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                </time>
                                <span class="text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{newsItem.title}</span> 
                            </a>
                        </li>
                    {/each}
                </ul>
                 {#if data.news.length >= 5}
                     <div class="pt-1 text-right">
                        <a href="/news" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">More News →</a>
                     </div>
                {/if}
            {:else}
                <p class="text-sm text-gray-500 dark:text-gray-400 italic">No recent news.</p>
            {/if}
        </section>

        <!-- Events Section -->
        <section class="lg:col-span-1 space-y-3">
             <h2 class="text-xl font-semibold border-b pb-2 mb-3 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                 <a href="/events" class="hover:text-blue-600 dark:hover:text-blue-400">Upcoming Events</a>
            </h2>
             {#if data.events.length > 0}
                <ul class="space-y-1"> 
                    {#each data.events as eventItem (eventItem.slug)}
                        <li>
                             <a href={`/events/${eventItem.slug}`} class="block text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 p-1 rounded group">
                                 <time datetime={eventItem.start_datetime?.toString()} class="text-xs text-gray-500 dark:text-gray-400 mr-2 font-mono whitespace-nowrap">
                                    {formatDate(eventItem.start_datetime, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                </time>
                                <span class="text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{eventItem.title}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
                 {#if data.events.length >= 5}
                    <div class="pt-1 text-right">
                        <a href="/events" class="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">More Events →</a>
                    </div>
                 {/if}
            {:else}
                 <p class="text-sm text-gray-500 dark:text-gray-400 italic">No upcoming events found.</p>
            {/if}
        </section>

    </div>

    <!-- Removed dedicated Collaborate section, integrated CTA into Welcome section -->
    <!-- <section class="pt-8 text-center border-t dark:border-gray-700"> ... </section> -->

</div>


<style>
    /* Add some basic button styles if not using Tailwind components/plugins */
    .button-primary {
    display: inline-block;
    padding-left: 1.25rem; /* px-5 */
    padding-right: 1.25rem;
    padding-top: 0.5rem; /* py-2 */
    padding-bottom: 0.5rem;
    background-color: #4f46e5; /* bg-indigo-600 */
    color: #ffffff; /* text-white */
    font-weight: 500; /* font-medium */
    font-size: 0.875rem; /* text-sm */
    border-radius: 0.375rem; /* rounded */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
}
.button-primary:hover {
    background-color: #4338ca; /* hover:bg-indigo-700 */
}
.button-primary:focus {
    outline: none; /* focus:outline-none */
    ring: 2px solid #6366f1; /* focus:ring-2 focus:ring-indigo-500 */
    ring-offset: 2px; /* focus:ring-offset-2 */
}
.button-primary:focus.dark {
    ring-offset-color: #111827; /* dark:focus:ring-offset-gray-900 */
}
.button-secondary {
    display: inline-block;
    padding-left: 1.25rem; /* px-5 */
    padding-right: 1.25rem;
    padding-top: 0.5rem; /* py-2 */
    padding-bottom: 0.5rem;
    background-color: #e5e7eb; /* bg-gray-200 */
    color: #374151; /* text-gray-700 */
    font-weight: 500; /* font-medium */
    font-size: 0.875rem; /* text-sm */
    border-radius: 0.375rem; /* rounded */
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
}
.button-secondary:hover {
    background-color: #d1d5db; /* hover:bg-gray-300 */
}
.button-secondary:focus {
    outline: none; /* focus:outline-none */
    ring: 2px solid #6366f1; /* focus:ring-2 focus:ring-indigo-500 */
    ring-offset: 2px; /* focus:ring-offset-2 */
}
.button-secondary.dark {
    background-color: #374151; /* dark:bg-gray-700 */
    color: #e5e7eb; /* dark:text-gray-200 */
}
.button-secondary.dark:hover {
    background-color: #4b5563; /* dark:hover:bg-gray-600 */
}
.button-secondary.dark:focus {
    ring-offset-color: #111827; /* dark:focus:ring-offset-gray-900 */
}

    /* Add line-clamp utility if not available */
    .line-clamp-2 {
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
    }
     .line-clamp-3 {
        overflow: hidden;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
    }
</style>