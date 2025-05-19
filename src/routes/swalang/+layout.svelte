<script lang="ts">
	import type { LayoutData } from './$types';
    // Client-side client for loading children
    import { listKeywordsByCategoryIdPaginated, listApprovedSuggestionsByKeywordIdPaginated } from '$lib/services/swahiliCollaborationService';
    import type { Category, Keyword, SuggestionRow } from '$lib/services/swahiliCollaborationService'; // Assuming Keyword has id & english_keyword
    import Icon from '$lib/components/Icon.svelte';
    // To highlight active links
	
    import { onMount, onDestroy } from 'svelte'; // Add onDestroy for cleanup
    import { slide } from 'svelte/transition'; // For drawer animation
  
    export let data: LayoutData;
  
    const ITEMS_PER_PAGE = 50; // Or a smaller number like 10-20
  
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
  
    let menuCategories: MenuItemCategory[] = [];
    $: menuCategories = data.categories.map(cat => ({ ...cat, expanded: false, keywords: [], keywordsOffset: 0, hasMoreKeywords: true })); // Initialize expanded to false
  
    // --- Responsive State ---
    let isMobileMenuOpen = false;
    let innerWidth: number; // To track window width
    const mobileBreakpoint = 768; // Tailwind's 'md' breakpoint, adjust as needed
  
    $: isSmallScreen = innerWidth < mobileBreakpoint;
  
    // Close mobile menu if screen resizes to be larger
    $: if (!isSmallScreen && isMobileMenuOpen) {
        isMobileMenuOpen = false;
    }
  
    function toggleMobileMenu() {
        isMobileMenuOpen = !isMobileMenuOpen;
    }
  
    // --- Menu Logic Functions (toggleCategory, loadMoreKeywords, toggleKeyword, loadMoreSuggestions, isActive) ---
    // ... (These functions remain largely the same, but ensure navigation also closes mobile menu) ...
  
    async function toggleCategory(category: MenuItemCategory) {
      category.expanded = !category.expanded;
      if (category.expanded && (!category.keywords || category.keywords.length === 0)) {
        await loadMoreKeywords(category); // Keep this to load data
      }
      // If on mobile and user clicks the category to navigate, close the menu
      // The navigation itself will be handled by the <a> tag within the button now
      // if (isSmallScreen && isMobileMenuOpen) {
      //     isMobileMenuOpen = false;
      // }
    }
  
    async function toggleKeyword(category: MenuItemCategory, keyword: MenuItemCategory['keywords'][0]) { // Pass category to update menuCategories
      if(!keyword) return;
      keyword.expanded = !keyword.expanded;
      if (keyword.expanded && (!keyword.suggestions || keyword.suggestions.length === 0)) {
        await loadMoreSuggestions(category, keyword); // Keep this to load data
      }
      // If on mobile and user clicks the keyword to navigate, close the menu
      // if (isSmallScreen && isMobileMenuOpen) {
      //    isMobileMenuOpen = false;
      // }
    }
  
    // --- Updated Load More Functions to correctly update menuCategories ---
    async function loadMoreKeywords(category: MenuItemCategory) {
      if (category.loadingKeywords || !category.hasMoreKeywords) return;
      category.loadingKeywords = true;
      // Use data.supabase passed from +layout.server.ts
      const { data: newKeywords, error, count } = await listKeywordsByCategoryIdPaginated(
          data.supabase, // Assuming supabaseClient is passed from server load
          category.id, ITEMS_PER_PAGE, category.keywordsOffset || 0
      );
      if (error) { console.error("Error loading keywords for category", category.name, error); }
      else if (newKeywords) {
          const updatedKeywords = [...(category.keywords || []), ...newKeywords.map(kw => ({...kw, expanded: false, suggestions: [], suggestionsOffset: 0, hasMoreSuggestions: true}))];
          const newOffset = (category.keywordsOffset || 0) + newKeywords.length;
          const newHasMore = count ? updatedKeywords.length < count : newKeywords.length === ITEMS_PER_PAGE;
  
          menuCategories = menuCategories.map(c => c.id === category.id ? { ...c, keywords: updatedKeywords, keywordsOffset: newOffset, hasMoreKeywords: newHasMore, loadingKeywords: false } : c);
          return; // Exit to prevent setting loadingKeywords false again
      }
      category.loadingKeywords = false; // Fallback if no newKeywords
      menuCategories = menuCategories.map(c => c.id === category.id ? { ...c, loadingKeywords: false } : c);
    }
  
    async function loadMoreSuggestions(category: MenuItemCategory, keyword: MenuItemCategory['keywords'][0]) {
      if (!keyword || keyword.loadingSuggestions || !keyword.hasMoreSuggestions) return;
      keyword.loadingSuggestions = true;
      const { data: newSuggestions, error, count } = await listApprovedSuggestionsByKeywordIdPaginated(
          data.supabase, // Assuming supabaseClient is passed from server load
          keyword.id, ITEMS_PER_PAGE, keyword.suggestionsOffset || 0
      );
  
      if (error) {  console.error("Error loading suggestions for keyword", keyword.english_keyword, error); }
      else if (newSuggestions) {
          const updatedSuggestions = [...(keyword.suggestions || []), ...newSuggestions];
          const newOffset = (keyword.suggestionsOffset || 0) + newSuggestions.length;
          const newHasMore = count ? updatedSuggestions.length < count : newSuggestions.length === ITEMS_PER_PAGE;
  
          menuCategories = menuCategories.map(c => {
              if (c.id === category.id) {
                  return {
                      ...c,
                      keywords: (c.keywords || []).map(kw => kw.id === keyword.id ? { ...kw, suggestions: updatedSuggestions, suggestionsOffset: newOffset, hasMoreSuggestions: newHasMore, loadingSuggestions: false } : kw)
                  };
              }
              return c;
          });
          return; // Exit
      }
      // Fallback if no newSuggestions
      menuCategories = menuCategories.map(c => {
          if (c.id === category.id) {
              return {
                  ...c,
                  keywords: (c.keywords || []).map(kw => kw.id === keyword.id ? { ...kw, loadingSuggestions: false } : kw)
              };
          }
          return c;
      });
    }
  
  
    // --- Lifecycle ---
    onMount(() => {
      innerWidth = window.innerWidth; // Set initial width
      // Initialize expanded state to false for all items
      menuCategories = data.categories.map(cat => ({ ...cat, expanded: false, keywords: [], keywordsOffset: 0, hasMoreKeywords: true }));
  
      // Update `data.supabaseClient` if necessary if it's not passed via `data`
      // This assumes `data.supabaseClient` is your client-side Supabase instance
      // If you are using the global `supabase` from `$lib/supabaseClient`, ensure it's correctly initialized.
      // For client-side fetches, the global `supabase` client is usually fine.
      // If `data.supabase` was meant to be the server client, it cannot be used directly here for client-side fetches.
      // Let's assume you'll use the global `supabase` client for these client-side fetches.
      // Modify loadMoreKeywords and loadMoreSuggestions to use the global `supabase` client.
    });
  
    onDestroy(() => {
        // Cleanup if any listeners were added to window (not strictly needed for innerWidth binding)
    });

    function isActive(param){
        return
    }
  
  
  </script>
  
  <!-- Bind window width for responsive logic -->
  <svelte:window bind:innerWidth />
  
  <div class="flex h-screen overflow-hidden">
  
      <!-- Mobile Menu Button (Visible only on small screens) -->
      <button
          on:click={toggleMobileMenu}
          class="md:hidden fixed top-3 left-3 z-30 p-2 bg-gray-200 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          aria-label="Toggle Navigation Menu"
          aria-expanded={isMobileMenuOpen}
      >
          {#if isMobileMenuOpen}
              <Icon name="menu" class="w-5 h-5" /> <!-- Replace with X/Close icon -->
          {:else}
              <Icon name="menu" class="w-5 h-5" /> <!-- Replace with Menu/Hamburger icon -->
          {/if}
      </button>
  
      <!-- Sidebar Navigation -->
      <!-- Desktop: Always visible -->
      <!-- Mobile: Slide-in drawer, controlled by isMobileMenuOpen -->
      {#if !isSmallScreen || isMobileMenuOpen}
          <nav
              class="bg-gray-100 dark:bg-gray-900 border-r dark:border-gray-800 flex-shrink-0 overflow-y-auto p-4 space-y-1 text-sm
                     md:w-72 md:relative md:translate-x-0 md:block 
                     fixed top-0 left-0 h-full w-4/5 max-w-xs z-20 transform transition-transform duration-300 ease-in-out 
                     {isSmallScreen && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}"
              aria-hidden={isSmallScreen && !isMobileMenuOpen}
              transition:slide={{ duration: 300, axis: 'x' }}
          >
               <!-- Mobile: Optional Header + Close button inside drawer -->
               {#if isSmallScreen}
                  <div class="flex justify-between items-center mb-4 md:hidden">
                       <span class="font-semibold text-lg dark:text-white">Menu</span>
                       <button on:click={toggleMobileMenu} class="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                           <Icon name="menu" class="w-5 h-5" /> <!-- Replace with X/Close icon -->
                       </button>
                  </div>
               {/if}
  
  
              {#if data.categoriesError} <!-- Categories Error -->
              {:else if menuCategories.length === 0} <!-- No Categories -->
              {/if}
  
              <!-- Menu Items (Categories, Keywords, Suggestions) -->
              {#each menuCategories as category (category.id)}
                  <div class="category-group">
                      <!-- Category Item: Now a button to toggle, contains an <a> for navigation -->
                      <div class="flex items-center justify-between w-full p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 group">
                          <a
                              href={`/swalang/categories/${category.id}`}
                              class="flex-grow truncate text-gray-700 dark:text-gray-300 font-medium group-hover:text-blue-600 dark:group-hover:text-blue-400"
                              class:active-link={isActive(`/swalang/categories/${category.id}`)}
                              on:click={() => { if (isSmallScreen) isMobileMenuOpen = false; }} 
                              title={category.name}
                          >
                              {category.name}
                          </a>
                          <button
                              on:click|stopPropagation={() => toggleCategory(category)}
                              class="p-1 -mr-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                              aria-expanded={category.expanded}
                              aria-label={`Toggle ${category.name} keywords`}
                          >
                              <Icon name={category.expanded ? 'chevron-down' : 'chevron-right'} class="w-3.5 h-3.5" />
                          </button>
                      </div>
  
                      <!-- Keywords List (Collapsible) -->
                      {#if category.expanded && category.keywords}
                          <ul class="pl-4 pt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                              {#each category.keywords as keyword (keyword.id)}
                                  <li>
                                      <div class="flex items-center justify-between w-full p-1.5 pl-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 group">
                                          <a
                                              href={`/swalang/keywords/${keyword.id}`}
                                              class="flex-grow truncate text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                              class:active-link={isActive(`/swalang/keywords/${keyword.id}`)}
                                              on:click={() => { if (isSmallScreen) isMobileMenuOpen = false; }}
                                              title={keyword.english_keyword}
                                          >
                                              {keyword.english_keyword}
                                          </a>
                                          {#if keyword.hasMoreSuggestions || (keyword.suggestions && keyword.suggestions.length > 0) || keyword.loadingSuggestions}
                                               <button
                                                  on:click|stopPropagation={() => toggleKeyword(category, keyword)}
                                                  class="p-0.5 -mr-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                                                  aria-expanded={keyword.expanded}
                                                  aria-label={`Toggle suggestions for ${keyword.english_keyword}`}
                                              >
                                                   <Icon name={keyword.expanded ? 'chevron-down' : 'chevron-right'} class="w-3 h-3" />
                                               </button>
                                          {/if}
                                      </div>
  
                                       <!-- Suggestions List (Collapsible) -->
                                       {#if keyword.expanded && keyword.suggestions}
                                           <ul class="pl-4 pt-0.5 space-y-px border-l-2 border-gray-200 dark:border-gray-700 ml-2">
                                               <!-- ... (suggestions loop and load more logic as before, ensure nav clicks close mobile menu) ... -->
                                               {#each keyword.suggestions as suggestion (suggestion.id)}
                                                 <li>
                                                   <span class="block p-1 pl-2 text-xs text-gray-500 dark:text-gray-500 truncate cursor-default" title={suggestion.swahili_word}>
                                                        - {suggestion.swahili_word}
                                                   </span>
                                                 </li>
                                               {/each}
                                               {#if keyword.loadingSuggestions} <!-- ... --> {:else if keyword.hasMoreSuggestions} <!-- ... --> {/if}
                                           </ul>
                                       {/if}
                                  </li>
                              {/each}
                              {#if category.loadingKeywords} <!-- ... --> {:else if category.hasMoreKeywords} <!-- ... --> {/if}
                          </ul>
                      {/if}
                  </div>
              {/each}
  
              <!-- Other main navigation links -->
              <hr class="my-4 dark:border-gray-700">
              {#each [
                  {href: '/swalang/documentation', label: 'Documentation'},
                  {href: '/news', label: 'News'},
                  {href: '/events', label: 'Events'},
                  {href: '/app', label: 'AI Editor'}
              ] as link}
                   <a href={link.href}
                      class="block p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                      class:active-link={isActive(link.href)}
                      on:click={() => { if (isSmallScreen) isMobileMenuOpen = false; }}
                   >
                      {link.label}
                   </a>
              {/each}
          </nav>
      {/if}
  
      <!-- Mobile Overlay (shown when mobile menu is open) -->
      {#if isSmallScreen && isMobileMenuOpen}
          <div
              class="fixed inset-0 z-10 bg-black bg-opacity-25 md:hidden"
              on:click={toggleMobileMenu}
              aria-hidden="true"
          ></div>
      {/if}
  
  
      <!-- Main Content Area -->
      <main class="flex-grow p-4 md:p-6 overflow-y-auto bg-white dark:bg-gray-800">
          <slot />
      </main>
  </div>
  
 