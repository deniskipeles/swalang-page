<!-- src/lib/components/AIContextSelector.svelte -->
<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient'; // Use client for fetching
    import Icon from '$lib/components/Icon.svelte';
  
    // Import necessary types and service functions
    import { listCategories, getCategoryById } from '$lib/services/swahiliCollaborationService';
    import type { Category } from '$lib/services/swahiliCollaborationService';
    import { listAllKeywords, getKeywordById } from '$lib/services/swahiliCollaborationService';
    import type { Keyword } from '$lib/services/swahiliCollaborationService';
    import { listAllSuggestions, getSuggestionById } from '$lib/services/swahiliCollaborationService';
    // import type { SuggestionRow } from '$lib/types/database.types'; // Use DB type for suggestions list
    import { listDocPages, getDocPageBySlug } from '$lib/services/documentationService';
    import type { DocPageData } from '$lib/services/documentationService';
    import type { PageData } from '../../routes/app/$types';
    export let data:PageData
  
    // --- Props ---
    /** The form field the context is intended for (optional, for display only) */
    export let targetField: string | null = null;
  
    // --- State ---
    type ContextSource = 'categories' | 'keywords' | 'suggestions' | 'docs';
    let activeSource: ContextSource = 'keywords'; // Default tab
    let items: any[] = []; // Holds the list of items for the active source
    let isLoading = false;
    let error: string | null = null;
    let selectedItemDetail: string | null = null; // Holds the fetched detail text
    let isDetailLoading = false;
  
    const dispatch = createEventDispatcher<{
      close: void; // Event to close the modal
      selectContext: string; // Event dispatching the selected text content
    }>();
  
    // --- Data Fetching ---
    async function loadItems(source: ContextSource) {
      if (isLoading) return;
      isLoading = true;
      error = null;
      items = []; // Clear previous items
      selectedItemDetail = null; // Clear detail view
      activeSource = source; // Set active tab immediately
  
      console.log(`Loading items for source: ${source}`);
      try {
          let result;
          switch (source) {
              case 'categories':
                  result = await listCategories(data.supabase??supabase);
                  items = result.data || [];
                  break;
              case 'keywords':
                  result = await listAllKeywords(data.supabase??supabase); // Use simplified list function
                  items = result.data || [];
                  break;
              case 'suggestions':
                   result = await listAllSuggestions(data.supabase??supabase); // Use simplified list function
                   items = result.data || [];
                   break;
              case 'docs':
                  result = await listDocPages(data.supabase??supabase, { limit: 50 }); // Use simplified list function
                  items = result.data || [];
                  break;
              default:
                   console.error("Unknown context source:", source);
                   result = { error: { message: 'Invalid source selected.' }};
          }
          if (result.error) {
              throw new Error(result.error.message);
          }
      } catch (err: any) {
          console.error(`Error loading ${source}:`, err);
          error = `Failed to load ${source}: ${err.message}`;
      } finally {
          isLoading = false;
      }
    }
  
    async function loadItemDetail(item: any) {
         if (isDetailLoading) return;
         isDetailLoading = true;
         selectedItemDetail = null; // Clear previous detail
         error = null;
         let contextText = '';
  
         console.log(`Loading detail for item:`, item);
         try {
             let result;
             switch (activeSource) {
                 case 'categories':
                     result = await getCategoryById(data.supabase??supabase, item.id);
                     contextText = `Category: ${result.data?.name}\nDescription: ${result.data?.description || 'N/A'}`;
                     break;
                 case 'keywords':
                      result = await getKeywordById(data.supabase??supabase, item.id);
                      contextText = `Keyword: ${result.data?.english_keyword}\nDescription: ${result.data?.description || 'N/A'}\nCategory: ${result.data?.category_name || 'N/A'}`;
                      break;
                 case 'suggestions':
                      result = await getSuggestionById(data.supabase??supabase, item.id);
                      // TODO: Fetch associated keyword name if needed for better context
                      contextText = `Suggestion for [Keyword ID: ${result.data?.keyword_id}]:\nSwahili: ${result.data?.swahili_word}\nDescription: ${result.data?.description || 'N/A'}`;
                      break;
                 case 'docs':
                      result = await getDocPageBySlug(data.supabase??supabase, item.slug);
                      // Choose which language content to use, or combine? Defaulting to English for now.
                      contextText = `Documentation: ${result.data?.title}\n\n${result.data?.content_eng || result.data?.content_sw || 'No content available.'}`;
                      break;
                  default: throw new Error("Invalid source");
             }
              if (result.error) throw new Error(result.error.message);
              selectedItemDetail = contextText;
  
         } catch (err: any) {
             console.error(`Error loading detail for ${activeSource}:`, err);
             error = `Failed to load detail: ${err.message}`;
         } finally {
             isDetailLoading = false;
         }
    }
  
  
    function selectAndClose() {
        if (selectedItemDetail) {
            dispatch('selectContext', selectedItemDetail);
            closeModal();
        }
    }
  
    function closeModal() {
      dispatch('close');
    }
  
    // --- Lifecycle ---
    onMount(() => {
      loadItems(activeSource); // Load initial items (keywords by default)
    });
  
  </script>
  
  <!-- Modal Structure -->
  <div class="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center p-4 backdrop-blur-sm" on:click|self={closeModal}>
       <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full h-[80vh] max-h-[700px] flex flex-col overflow-hidden" on:click|stopPropagation>
  
          <!-- Header -->
          <div class="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
              <h3 class="font-semibold text-lg dark:text-white">
                  Select Context {targetField ? `for ${targetField}` : ''}
              </h3>
              <button on:click={closeModal} class="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600" aria-label="Close context selector">×</button>
          </div>
  
          <!-- Tabs for Sources -->
          <div class="flex flex-shrink-0 border-b dark:border-gray-700 px-2">
               <button class="px-4 py-2 text-sm font-medium" class:border-b-2={activeSource === 'keywords'} class:border-blue-500={activeSource === 'keywords'} class:text-blue-600={activeSource === 'keywords'} class:dark:text-blue-400={activeSource === 'keywords'} class:text-gray-500={activeSource !== 'keywords'} class:dark:text-gray-400={activeSource !== 'keywords'} class:hover:bg-gray-100={activeSource !== 'keywords'} class:dark:hover:bg-gray-700={activeSource !== 'keywords'} on:click={() => loadItems('keywords')} > Keywords </button>
               <button class="px-4 py-2 text-sm font-medium" class:border-b-2={activeSource === 'suggestions'} class:border-blue-500={activeSource === 'suggestions'} class:text-blue-600={activeSource === 'suggestions'} class:dark:text-blue-400={activeSource === 'suggestions'} class:text-gray-500={activeSource !== 'suggestions'} class:dark:text-gray-400={activeSource !== 'suggestions'} class:hover:bg-gray-100={activeSource !== 'suggestions'} class:dark:hover:bg-gray-700={activeSource !== 'suggestions'} on:click={() => loadItems('suggestions')} > Suggestions </button>
               <button class="px-4 py-2 text-sm font-medium" class:border-b-2={activeSource === 'categories'} class:border-blue-500={activeSource === 'categories'} class:text-blue-600={activeSource === 'categories'} class:dark:text-blue-400={activeSource === 'categories'} class:text-gray-500={activeSource !== 'categories'} class:dark:text-gray-400={activeSource !== 'categories'} class:hover:bg-gray-100={activeSource !== 'categories'} class:dark:hover:bg-gray-700={activeSource !== 'categories'} on:click={() => loadItems('categories')} > Categories </button>
               <button class="px-4 py-2 text-sm font-medium" class:border-b-2={activeSource === 'docs'} class:border-blue-500={activeSource === 'docs'} class:text-blue-600={activeSource === 'docs'} class:dark:text-blue-400={activeSource === 'docs'} class:text-gray-500={activeSource !== 'docs'} class:dark:text-gray-400={activeSource !== 'docs'} class:hover:bg-gray-100={activeSource !== 'docs'} class:dark:hover:bg-gray-700={activeSource !== 'docs'} on:click={() => loadItems('docs')} > Documentation </button>
               <!-- Add more tabs as needed -->
          </div>
  
           <!-- Content Area (List and Detail Preview) -->
           <div class="flex-grow flex min-h-0"> 
  
              <!-- List Column -->
              <div class="w-1/3 border-r dark:border-gray-700 overflow-y-auto flex-shrink-0">
                   {#if isLoading}
                       <div class="p-4 text-center text-gray-500 dark:text-gray-400">Loading...</div>
                   {:else if error && items.length === 0}
                        <div class="p-4 text-red-500 dark:text-red-400">{error}</div>
                   {:else if items.length === 0}
                        <div class="p-4 text-center text-gray-500 dark:text-gray-400 italic">No items found.</div>
                   {:else}
                      <ul class="divide-y dark:divide-gray-700">
                           {#each items as item (item.id || item.slug)}
                               <li >
                                   <button on:click={() => loadItemDetail(item)} class="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700">
                                        {#if activeSource === 'keywords'}{item.english_keyword}{:else if activeSource === 'suggestions'}{item.swahili_word}{:else if activeSource === 'categories'}{item.name}{:else if activeSource === 'docs'}{item.title}{:else}Unknown Item{/if}
                                        <!-- Optionally add secondary info like category -->
                                   </button>
                               </li>
                           {/each}
                      </ul>
                   {/if}
              </div>
  
              <!-- Detail/Preview Column -->
              <div class="w-2/3 overflow-y-auto p-4 relative">
                  {#if isDetailLoading}
                       <div class="text-center text-gray-500 dark:text-gray-400">Loading detail...</div>
                  {:else if error && selectedItemDetail === null}
                       <div class="text-red-500 dark:text-red-400">{error}</div>
                  {:else if selectedItemDetail !== null}
                       <h4 class="font-semibold mb-2 text-sm dark:text-gray-200">Context Preview:</h4>
                       <pre class="text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded border dark:border-gray-600 whitespace-pre-wrap">{selectedItemDetail}</pre>
                       <button
                          on:click={selectAndClose}
                          class="absolute bottom-4 right-4 mt-4 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                       >
                          Use this Context
                      </button>
                  {:else}
                       <div class="text-center text-gray-500 dark:text-gray-400 italic mt-10">Select an item from the left list to preview its content as context.</div>
                  {/if}
              </div>
  
           </div>
       </div>
  </div>