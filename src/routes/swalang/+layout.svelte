<script lang="ts">
    import type { LayoutData } from './$types';
    import { supabase } from '$lib/supabaseClient'; // Client-side client for loading children
    import { listKeywordsByCategoryIdPaginated, listApprovedSuggestionsByKeywordIdPaginated } from '$lib/services/swahiliCollaborationService';
    import type { Category, Keyword, SuggestionRow } from '$lib/services/swahiliCollaborationService'; // Assuming Keyword has id & english_keyword
    import Icon from '$lib/components/Icon.svelte';
    import { page } from '$app/stores'; // To highlight active links
  
    export let data: LayoutData; // { categories, categoriesError, session }
  
    const ITEMS_PER_PAGE = 50; // Or a smaller number like 10-20 for a nav menu
  
    interface MenuItemCategory extends Category {
      expanded?: boolean;
      loadingKeywords?: boolean;
      keywords?: (Pick<Keyword, 'id' | 'english_keyword'> & {
          expanded?: boolean;
          loadingSuggestions?: boolean;
          suggestions?: Pick<SuggestionRow, 'id' | 'swahili_word'>[];
          suggestionsOffset?: number;
          hasMoreSuggestions?: boolean;
      })[];
      keywordsOffset?: number;
      hasMoreKeywords?: boolean;
    }
  
    // Reactive state for menu items, derived from initial props
    let menuCategories: MenuItemCategory[] = [];
    $: menuCategories = data.categories.map(cat => ({ ...cat, keywords: [], keywordsOffset: 0, hasMoreKeywords: true }));
  
  
    async function toggleCategory(category: MenuItemCategory) {
      category.expanded = !category.expanded;
      console.log(category.expanded)
      if (category.expanded && (!category.keywords || category.keywords.length === 0)) {
        await loadMoreKeywords(category);
      }
    }
  
    async function loadMoreKeywords(category: MenuItemCategory) {
      if (category.loadingKeywords || !category.hasMoreKeywords) return;
      category.loadingKeywords = true;
  
      const { data: newKeywords, error, count } = await listKeywordsByCategoryIdPaginated(
          data.supabase, // Use client-side supabase instance
          category.id,
          ITEMS_PER_PAGE,
          category.keywordsOffset || 0
      );
      console.log("newKeywords", newKeywords, count, category.keywordsOffset, category.hasMoreKeywords,error)
  
      if (error) {
          console.error("Error loading keywords for category", category.name, error);
          // Handle error display if needed
      } else if (newKeywords) {
          category.keywords = [...(category.keywords || []), ...newKeywords.map(kw => ({...kw, suggestions: [], suggestionsOffset: 0, hasMoreSuggestions: true}))];
          category.keywordsOffset = (category.keywordsOffset || 0) + newKeywords.length;
          category.hasMoreKeywords = count ? category.keywords.length < count : newKeywords.length === ITEMS_PER_PAGE;
        //   console.log(category.keywords, category.keywordsOffset, category.hasMoreKeywords)
      }
      category.loadingKeywords = false;
      menuCategories = menuCategories.map(cat => cat.id === category.id ? category : cat);
    }
  
  
    async function toggleKeyword(keyword: MenuItemCategory['keywords'][0]) {
      if(!keyword) return;
      keyword.expanded = !keyword.expanded;
      if (keyword.expanded && (!keyword.suggestions || keyword.suggestions.length === 0)) {
        await loadMoreSuggestions(keyword);
      }
    }
  
    async function loadMoreSuggestions(keyword: MenuItemCategory['keywords'][0]) {
      if (!keyword || keyword.loadingSuggestions || !keyword.hasMoreSuggestions) return;
      keyword.loadingSuggestions = true;
  
      const { data: newSuggestions, error, count } = await listApprovedSuggestionsByKeywordIdPaginated(
          data.supabase, // Use client-side supabase instance
          keyword.id,
          ITEMS_PER_PAGE,
          keyword.suggestionsOffset || 0
      );
  
      if (error) {
          console.error("Error loading suggestions for keyword", keyword.english_keyword, error);
      } else if (newSuggestions) {
          keyword.suggestions = [...(keyword.suggestions || []), ...newSuggestions];
          keyword.suggestionsOffset = (keyword.suggestionsOffset || 0) + newSuggestions.length;
          keyword.hasMoreSuggestions = count ? keyword.suggestions.length < count : newSuggestions.length === ITEMS_PER_PAGE;
      }
      keyword.loadingSuggestions = false;
      menuCategories = menuCategories.map(cat => {
        if (cat.keywords) {
          cat.keywords = cat.keywords.map(kw => {
            if (kw.id === keyword.id) {
              return keyword;
            }
            return kw;
          });
          }
        return cat;
      })
    }
  
    // Helper to check if a link is active (basic check)
    function isActive(path: string) {
        return $page.url.pathname === path || $page.url.pathname.startsWith(path + '/');
    }
  
  </script>
  
  <div class="flex h-full">
      <!-- Sidebar Navigation -->
      <nav class="w-64 md:w-72 bg-gray-100 dark:bg-gray-900 border-r dark:border-gray-800 flex-shrink-0 overflow-y-auto p-4 space-y-1 text-sm">
          {#if data.categoriesError}
              <p class="text-red-500 text-xs p-2">Error loading navigation.</p>
          {:else if menuCategories.length === 0}
              <p class="text-gray-500 dark:text-gray-400 text-xs p-2 italic">No categories for navigation.</p>
          {/if}
  
          {#each menuCategories as category (category.id)}
              <div class="category-group">
                  <!-- Category Link -->
                  <button
                      
                      class="flex items-center justify-between w-full p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                      class:bg-blue-100={$page.url.pathname.includes(`/swalang/categories/${category.id}`)}
                      class:dark:bg-blue-900={$page.url.pathname.includes(`/swalang/categories/${category.id}`)}
                      class:text-blue-700={$page.url.pathname.includes(`/swalang/categories/${category.id}`)}
                      class:dark:text-blue-300={$page.url.pathname.includes(`/swalang/categories/${category.id}`)}
                      on:click|preventDefault={() => toggleCategory(category)} 
                  >
                    <a href={`/swalang/categories/${category.id}`}>
                        <span class="truncate" title={category.name}>{category.name}</span>
                    </a>
                       <Icon name={category.expanded ? 'chevron-down' : 'chevron-right'} class="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-1"/>
                </button>
  
                  <!-- Keywords List (Collapsible) -->
                  {#if category.expanded && category.keywords}
                      <ul class="pl-3 pt-1 space-y-0.5">
                          {#each category.keywords as keyword (keyword.id)}
                              <li>
                                  <a
                                      href={`/swalang/keywords/${keyword.id}`}
                                      class="flex items-center justify-between w-full p-1.5 pl-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                                      class:bg-blue-100={$page.url.pathname.includes(`/swalang/keywords/${keyword.id}`)}
                                      class:dark:bg-blue-900={$page.url.pathname.includes(`/swalang/keywords/${keyword.id}`)}
                                      class:text-blue-600={$page.url.pathname.includes(`/swalang/keywords/${keyword.id}`)}
                                      class:dark:text-blue-300={$page.url.pathname.includes(`/swalang/keywords/${keyword.id}`)}
                                      on:click|preventDefault={() => toggleKeyword(keyword)}
                                  >
                                      <span class="truncate" title={keyword.english_keyword}>{keyword.english_keyword}</span>
                                      {#if keyword.suggestions?.length > 0 || keyword.hasMoreSuggestions || keyword.loadingSuggestions }
                                           <Icon name={keyword.expanded ? 'chevron-down' : 'chevron-right'} class="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0 ml-1"/>
                                      {/if}
                                  </a>
  
                                   <!-- Suggestions List (Collapsible) -->
                                   {#if keyword.expanded && keyword.suggestions}
                                       <ul class="pl-3 pt-0.5 space-y-px">
                                           {#each keyword.suggestions as suggestion (suggestion.id)}
                                               <li>
                                                    <!-- Suggestions typically don't have their own page in this nav, but link if they do -->
                                                    <a
                                                        href={`/swalang/keywords/${keyword.id}`}
                                                    >
                                                        <span class="block p-1 pl-3 text-xs text-gray-500 dark:text-gray-500 truncate" title={suggestion.swahili_word}>
                                                             - {suggestion.swahili_word}
                                                        </span>
                                                    </a>
                                               </li>
                                           {/each}
                                           {#if keyword.loadingSuggestions}
                                               <li class="p-1 pl-3 text-xs text-gray-400 italic">Loading suggestions...</li>
                                           {:else if keyword.hasMoreSuggestions}
                                               <li>
                                                   <button on:click={() => loadMoreSuggestions(keyword)} class="p-1 pl-3 text-xs text-blue-500 hover:underline">Load more...</button>
                                               </li>
                                           {/if}
                                       </ul>
                                   {/if}
                              </li>
                          {/each}
                          {#if category.loadingKeywords}
                              <li class="p-1.5 pl-3 text-xs text-gray-400 italic">Loading keywords...</li>
                          {:else if category.hasMoreKeywords}
                               <li>
                                   <button on:click={() => loadMoreKeywords(category)} class="p-1.5 pl-3 text-xs text-blue-500 hover:underline">Load more keywords...</button>
                               </li>
                          {/if}
                      </ul>
                  {/if}
              </div>
          {/each}
  
           <!-- Other main navigation links -->
           <hr class="my-4 dark:border-gray-700">
           <a href="/swalang/documentation" class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium" class:active-link={isActive('/swalang/documentation')}>Documentation</a>
           <a href="/news" class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium" class:active-link={isActive('/news')}>News</a>
           <a href="/events" class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium" class:active-link={isActive('/events')}>Events</a>
           <a href="/app" class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium" class:active-link={isActive('/app')}>AI Editor</a>
      </nav>
  
      <!-- Main Content Area for the nested route -->
      <main class="flex-grow p-4 md:p-6 overflow-y-auto">
          <slot />
      </main>
  </div>
  
  <style>
      /* Basic active link styling
      .active-link {
          @apply bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold;
      } */
      /* Ensure nav takes full height and content scrolls */
      nav {
          height: calc(100vh - theme(spacing.16)); /* Adjust 16 based on your header height if any from root layout */
      }
      main {
           height: calc(100vh - theme(spacing.16)); /* Adjust based on header */
      }
  </style>