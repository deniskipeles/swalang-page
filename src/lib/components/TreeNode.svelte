<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { vfsStore } from '$lib/stores/vfsStore'; // Import the store
  import type { FileNode, VfsError } from '$lib/services/fileSystemService';
  import Icon from './Icon.svelte';
  import type { PageData } from '../../routes/app/$types';
	import { goto } from '$app/navigation';
	import ShareButton from './ShareButton.svelte';
	import { slide } from 'svelte/transition';
  export let data:PageData

  export let node: FileNode;
  export let level = 0;
  export let selectedFileId: string | null = null;
  export let isSharedView = false; // <<< New Prop
  export let sharedChildren: FileNode[] | undefined = undefined; // <<< Pass pre-loaded children for shared view
  export let isSmallScreen: boolean = false;
  export let showShareModal = false

  // --- State ---
  let isExpanded = false;
  // No longer need local children, isLoading, error for children
  let isRenaming = false;
  let renameValue = node.name;

  const dispatch = createEventDispatcher<{
    select: string | null;
    // Pass more info for delete/create so FileTree can call store action
    delete: { nodeId: string; parentId: string | null; nodeName: string };
    create: { parentId: string | null; isFolder: boolean };
    error: VfsError;
  }>();

  // Subscribe to store - needed to get children, loading, error states
  const storeValue = vfsStore;

  // --- Derived State from Store ---
  // $: children = $storeValue.nodesByParentId[node.id] || [];
  // $: isLoadingChildren = $storeValue.loading[node.id] ?? false;
  // Use sharedChildren if provided, otherwise check store (only if not shared view)
  $: children = isSharedView ? (sharedChildren || []) : ($storeValue.nodesByParentId[node.id] || []);
  $: isLoadingChildren = isSharedView ? false : ($storeValue.loading[node.id] ?? false); // Loading only relevant for store-based loading
  // $: childrenError = $storeValue.errors[node.id] ?? null;
  $: childrenError = isSharedView ? null : ($storeValue.errors[node.id] ?? null);
  $: isPerformingNodeAction = $storeValue.isPerformingAction; // Global flag

  // --- Computed ---
  $: isSelected = !node.is_folder && node.id === selectedFileId;
  // $: hasLoadedChildren = node.id in $storeValue.nodesByParentId; // Check if key exists
  $: hasLoadedChildren = isSharedView ? (sharedChildren !== undefined) : (node.id in $storeValue.nodesByParentId);

  // --- Methods ---
  async function loadChildren() {
    if (!node.is_folder || isSharedView) return; // <<< Don't load via store in shared view
    // Use store action to load children
    vfsStore.loadNodes(data.supabase,node.id);
  }
  

  async function toggleExpand() {
    if (!node.is_folder) return;
    isExpanded = !isExpanded;
    if (isExpanded && !hasLoadedChildren) { // Load only if not already loaded
        loadChildren();
    }
  }

  function handleClick() {
    if (isSharedView) {
      goto(`/share/${data?.shareToken}/${node.id}`)
    }
    if (node.is_folder) {
      toggleExpand();
      dispatch('select', null); // Deselect any file when clicking folder
    } else {
      dispatch('select', node.id); // Emit selection event
    }
  }


  // --- State for Kebab Menu ---
  let showKebabMenu = false;
  let kebabButtonElement: HTMLButtonElement | null = null; // For positioning

  // ... (existing state: isRenaming, storeValue, children, isLoadingChildren, etc.) ...

  function toggleKebabMenu(event?: MouseEvent) {
      event?.stopPropagation(); // Prevent click from propagating to the tree node item
      showKebabMenu = !showKebabMenu;
  }

  // Close kebab menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (showKebabMenu && kebabButtonElement && !kebabButtonElement.contains(event.target as Node)) {
        showKebabMenu = false;
    }
  }

  // Close kebab on Escape key
  function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && showKebabMenu) {
          showKebabMenu = false;
      }
  }

  // --- Existing Methods (toggleExpand, handleClick, startRename, etc.) ---
  // Ensure these methods close the kebab menu if it's open and an action is taken
  function closeKebabAndAct(actionFn: () => void) {
      showKebabMenu = false;
      actionFn();
  }


  function startRename() {
    // Prevent rename while another action is globally pending maybe?
    // if (isPerformingNodeAction) return;
    if (isRenaming) return;
    renameValue = node.name;
    isRenaming = true;
    setTimeout(() => { /* ... focus input ... */ }, 0);
  }

  async function handleRename(event?: Event) {
      event?.preventDefault();
      if (!isRenaming || renameValue === node.name || renameValue.trim() === '' || isPerformingNodeAction) {
          isRenaming = false;
          return;
      }

      const originalName = node.name; // Keep original for potential revert message
      // Call the store's rename action
      const { success, error: renameError } = await vfsStore.renameNode(data.supabase,node.id, renameValue.trim());

      if (renameError) {
          // console.log(renameError)
           dispatch('error', renameError);
           // Optionally revert renameValue or show error near input
           renameValue = originalName; // Revert on error
           showNotification('error', `Failed to rename "${originalName}": ${renameError.message}`); // Use parent notification
      } else if (success) {
          // UI updates reactively via the store
           showNotification('success', `Renamed "${originalName}" to "${renameValue.trim()}".`);
      }
      isRenaming = false; // Needs to happen regardless of success/failure
  }

  function handleRenameKeyDown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleRename();
        } else if (event.key === 'Escape') {
            isRenaming = false;
            renameValue = node.name; // Revert on escape
        }
    }

  function requestDelete() {
      if (isSharedView) return; // <<< Disable delete in shared view
      if (confirm(`Are you sure you want to delete "${node.name}"? ${node.is_folder ? '(This will delete all its contents!)' : ''}`)) {
          // Dispatch event with necessary info for FileTree to call store action
          dispatch('delete', { nodeId: node.id, parentId: node.parent_id, nodeName: node.name });
      }
  }

  function requestCreate(isFolder: boolean) {
      if (isSharedView) return; // <<< Disable create in shared view
      // Dispatch event for FileTree to handle creation via store
      dispatch('create', { parentId: node.id, isFolder });
  }

  // Helper to bubble notification up (optional, FileTree handles most)
  function showNotification(type: 'success' | 'error', message: string) {
      dispatch('error', { message } as VfsError); // Use error dispatch for simplicity here
  }


  // --- Responsive State ---
  let isMobileMenuOpen = false;
  let innerWidth: number; // To track window width
  const mobileBreakpoint = 768; // Tailwind's 'md' breakpoint, adjust as needed

  $: isSmallScreen = innerWidth < mobileBreakpoint;

  // Close mobile menu if screen resizes to be larger
  $: if (!isSmallScreen && isMobileMenuOpen) {
      isMobileMenuOpen = false;
  }

</script>

<!-- Svelte Window Event Listeners for Kebab Menu -->
<svelte:window bind:innerWidth on:click={handleClickOutside} on:keydown={handleEscape}/>

<!-- Template largely the same, but uses store-derived values -->
<div class="tree-node text-sm">
  <!-- Item Row -->
  <div
    class="flex items-center space-x-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer group"
    class:bg-blue-100={isSelected} class:dark:bg-blue-900={isSelected}
    style={`padding-left: ${level * 1.5 + 0.25}rem;`}
    on:click={handleClick}
    on:dblclick={() => { if(node.is_folder) toggleExpand(); }}
    title={node.name}
  >
    <!-- Folder Arrow -->
    {#if node.is_folder}
      <span class="w-4 inline-block text-gray-500">
        {#if isLoadingChildren}
            <Icon name="loading" />
        {:else if hasLoadedChildren || isExpanded} <!-- Show arrow if expandable/loaded -->
            <Icon name={isExpanded ? 'chevron-down' : 'chevron-right'} />
        {/if}
      </span>
    {:else} <span class="w-4 inline-block"></span> {/if}

    <!-- Icon -->
    <span class="flex-shrink-0 w-4">
      <!-- <Icon name={node.is_folder ? 'folder' : 'file'} /> -->
      <Icon name={
        node.is_folder
          ? 'folder'
          : node.name.endsWith('.sw')
            ? 'swalang'
            : 'file'
      } height={20} width={20} />      
    </span>

    <!-- Name / Rename Input -->
    <span class="flex-grow truncate">
        {#if isRenaming}
             <!-- Rename input as before -->
             <input id={`rename-${node.id}`}  bind:value={renameValue} on:blur  on:keydown={handleRenameKeyDown} disabled={isPerformingNodeAction}/>
        {:else} {node.name} {/if}
    </span>

    <!-- Actions -->
    {#if !isRenaming}
      <div>
          {#if !isSmallScreen}
              <span class="flex flex-shrink-0 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {#if node.is_folder}
                      <button title="New File" on:click|stopPropagation={() => closeKebabAndAct(() => requestCreate(false))} disabled={isPerformingNodeAction} class="action-button"><Icon name="plus" /></button>
                      <button title="New Folder" on:click|stopPropagation={() => closeKebabAndAct(() => requestCreate(true))} disabled={isPerformingNodeAction} class="action-button"><Icon name="folder" /></button>
                  {/if}
                  <button title="Rename" on:click|stopPropagation={startRename} disabled={isPerformingNodeAction} class="action-button"><Icon name="edit" /></button>
                  <button title="Delete" on:click|stopPropagation={() => closeKebabAndAct(requestDelete)} disabled={isPerformingNodeAction} class="action-button"><Icon name="trash" /></button>
                  <ShareButton supabaseClient={data.supabase} file={node}/>
              </span>
          {/if}

          {#if isSmallScreen} 
              <button
                  bind:this={kebabButtonElement}
                  on:click={toggleKebabMenu}
                  aria-label="More actions"
                  aria-haspopup="true"
                  aria-expanded={showKebabMenu}
                  class="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                  <Icon name="kebab" class="w-4 h-4 text-gray-500 dark:text-gray-400"/> 
              </button>
          {/if}
      </div>

      <!-- Kebab Dropdown Menu (Positioned absolutely) -->
      {#if showKebabMenu}
      <div
          transition:slide={{ duration: 150, axis: 'y' }} 
          class="kebab-dropdown absolute right-1 mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20 py-1 text-sm"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="kebab-menu-button" 
      >
      <ul>
          <li>
          {#if node.is_folder}
              <li>
                <button role="menuitem" on:click={() => closeKebabAndAct(() => requestCreate(false))} disabled={isPerformingNodeAction} class="flex kebab-menu-item">
                    <Icon name="plus" class="mr-2"/> New File
                </button>
              </li>
              <li>
                <button role="menuitem" on:click={() => closeKebabAndAct(() => requestCreate(true))} disabled={isPerformingNodeAction} class="flex kebab-menu-item">
                    <Icon name="folder" class="mr-2"/> New Folder
                </button>
              </li>
              <div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div> 
          {/if}
          </li>
          <li>
          <button role="menuitem" on:click={startRename} disabled={isPerformingNodeAction} class="flex kebab-menu-item">
              <Icon name="edit" class="mr-2"/> Rename
          </button>
          </li>
          <li>
            <button role="menuitem" on:click={() => closeKebabAndAct(requestDelete)} disabled={isPerformingNodeAction} class="flex kebab-menu-item text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50">
                <Icon name="trash" class="mr-2"/> Delete
            </button>
            <div class="h-px bg-gray-200 dark:bg-gray-700 my-1"></div> 
          </li>
          <button role="menuitem" on:click={() => closeKebabAndAct(() => showShareModal = true)} disabled={isPerformingNodeAction} class="kebab-menu-item">
            <ShareButton supabaseClient={data.supabase} btnName="Share" file={node}/> 
          </button>
        </ul>
      </div>
      {/if}
    {/if}
  </div>

  <!-- Error Message for Children -->
  {#if childrenError}
    <div class="pl-6 text-red-600 text-xs" style={`padding-left: ${(level + 1) * 1.5 + 0.25}rem;`}>
        Error loading contents: {childrenError.message}
        <button on:click={() => vfsStore.loadNodes(data.supabase,node.id, true)} class="ml-1 underline text-xs">Retry</button>
    </div>
  {/if}

  <!-- Children (Rendered based on store data) -->
  {#if isExpanded && children.length > 0}
    <div class="children">
      {#each children as childNode (childNode.id)}
        <svelte:self
            {data}
            {isSmallScreen}
            {isSharedView}
            node={childNode}
            level={level + 1}
            bind:selectedFileId
            on:select={(e) => dispatch('select', e.detail)}
            on:delete={(e) => dispatch('delete', e.detail)}
            on:create={(e) => dispatch('create', e.detail)}
            on:error={(e) => dispatch('error', e.detail)}
        />
      {/each}
    </div>
  {/if}
   {#if isExpanded && hasLoadedChildren && !isLoadingChildren && children.length === 0 && !childrenError}
     <div class="pl-6 text-gray-500 text-xs italic" style={`padding-left: ${(level + 1) * 1.5 + 0.25}rem;`}>Empty folder</div>
   {/if}
</div>