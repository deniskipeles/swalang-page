<script lang="ts">
    import type { PageData } from './$types';
    import { goto } from '$app/navigation';
    import { debounce } from '$lib/utils/debounce'; // Simple debounce utility (create if needed)
    import Icon from '$lib/components/Icon.svelte';
	import { page } from '$app/state';
  
    export let data: PageData;
  
    // Local state bound to form inputs
    let searchTerm = data.currentSearchTerm || '';
    let selectedCategory = data.currentCategory || 'all';
  
    // Debounced search function to update URL without constant requests
    const applyFilters = debounce(() => {
      const params = new URLSearchParams();
      if (searchTerm.trim()) {
          params.set('search', searchTerm.trim());
      }
      if (selectedCategory && selectedCategory !== 'all') {
          params.set('category', selectedCategory);
      }
      // Reset page number if adding pagination later
      // params.set('page', '1');
  
      const queryString = params.toString();
      goto(`/swalang/documentation${queryString ? `?${queryString}` : ''}`, {
          keepFocus: true, // Keep focus on input if possible
          noScroll: true, // Don't jump to top on filter change
          replaceState: true // Update history without adding new entry
      });
    }, 300); // Debounce for 300ms
  
    // Trigger filter apply when local state changes
    $: if (searchTerm !== data.currentSearchTerm || selectedCategory !== data.currentCategory) {
        applyFilters();
    }
    // Sync local state if data changes from navigation/load
     $: if (data.currentSearchTerm !== searchTerm) searchTerm = data.currentSearchTerm;
     $: if (data.currentCategory !== selectedCategory) selectedCategory = data.currentCategory;
  
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8">
      <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Swalang Documentation</h1>
  
      <!-- Controls: Search, Filter, Add Button -->
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700 shadow-sm">
          <!-- Search Input -->
          <div class="relative flex-grow sm:flex-grow-0 sm:w-64 md:w-72">
              <input
                  type="search"
                  placeholder="Search title or summary..."
                  bind:value={searchTerm}
                  class="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                  aria-label="Search Documentation"
              />
               <div class="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                   <Icon name="loading" class="w-4 h-4 text-gray-400"/> <!-- Replace with Search Icon -->
               </div>
          </div>
  
          <!-- Category Filter Dropdown -->
          {#if data.categories.length > 0 || data.categoriesError}
              <div class="flex-grow sm:flex-grow-0">
                   <label for="doc-category-filter" class="sr-only">Filter by Category</label>
                   {#if data.categoriesError}
                        <span class="text-xs text-red-500 dark:text-red-400 italic" title={data.categoriesError}>Could not load categories</span>
                   {:else}
                      <select
                          id="doc-category-filter"
                          bind:value={selectedCategory}
                          class="text-sm p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[200px] shadow-sm"
                          aria-label="Filter by Category"
                      >
                          <option value="all">All Categories</option>
                          {#each data.categories as cat (cat)}
                              <option onclick={()=>{page.url.searchParams.set('category', cat)}} value={cat}>{cat}</option>
                          {/each}
                      </select>
                   {/if}
              </div>
          {/if}
  
          <!-- Add Documentation Button -->
          {#if data.session} 
              <a href="/swalang/documentation/edit"
                 class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 dark:focus:ring-offset-gray-800"
              >
                   <Icon name="plus" class="w-4 h-4 mr-2"/> Add Documentation
              </a>
          {/if}
      </div>
  
  
      <!-- Documentation List / Loading / Error -->
      <div class="documentation-list space-y-4">
          {#if data.docPagesError}
              <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
                  <p class="font-bold">Error Loading Documentation</p>
                  <p>{data.docPagesError}</p>
              </div>
          {:else if data.docPages.length === 0}
               <div class="text-center py-10">
                  <p class="text-gray-500 dark:text-gray-400 italic">
                      {#if data.currentSearchTerm || data.currentCategory !== 'all'}
                          No documentation found matching your filters.
                      {:else}
                          No documentation pages available yet.
                      {/if}
                  </p>
               </div>
          {:else}
               {#each data.docPages as docPage (docPage.slug)}
                   <a href={`/swalang/documentation/${docPage.slug}`} class="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
                      <h3 class="text-lg font-medium text-blue-600 dark:text-blue-400 mb-1">{docPage.title}</h3>
                      {#if docPage.summary}
                          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">{docPage.summary}</p>
                      {/if}
                      {#if docPage.category}
                          <span class="inline-block bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">{docPage.category}</span>
                      {/if}
                   </a>
               {/each}
          {/if}
      </div>
  
       <!-- Add Pagination Controls Here Later -->
  
  </div>
  
  <style>
      /* Add any specific styles if needed */
       /* Fix potential overlap of icon in search input */
      input[type="search"]::-webkit-search-cancel-button {
          /* Optional: Hide default clear button if needed */
          /* -webkit-appearance: none; */
      }
  </style>