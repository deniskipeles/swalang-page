<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { vfsStore } from '$lib/stores/vfsStore'; // Import the store
  import type { FileNode, VfsError } from '$lib/services/fileSystemService';
  import Icon from './Icon.svelte';

  export let node: FileNode;
  export let level = 0;
  export let selectedFileId: string | null = null;

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
  $: children = $storeValue.nodesByParentId[node.id] || [];
  $: isLoadingChildren = $storeValue.loading[node.id] ?? false;
  $: childrenError = $storeValue.errors[node.id] ?? null;
  $: isPerformingNodeAction = $storeValue.isPerformingAction; // Global flag

  // --- Computed ---
  $: isSelected = !node.is_folder && node.id === selectedFileId;
  $: hasLoadedChildren = node.id in $storeValue.nodesByParentId; // Check if key exists

  // --- Methods ---
  async function loadChildren() {
    if (!node.is_folder) return;
    // Use store action to load children
    vfsStore.loadNodes(node.id);
  }

  async function toggleExpand() {
    if (!node.is_folder) return;
    isExpanded = !isExpanded;
    if (isExpanded && !hasLoadedChildren) { // Load only if not already loaded
        loadChildren();
    }
  }

  function handleClick() {
    if (node.is_folder) {
      toggleExpand();
      dispatch('select', null); // Deselect any file when clicking folder
    } else {
      dispatch('select', node.id); // Emit selection event
    }
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
      const { success, error: renameError } = await vfsStore.renameNode(node.id, renameValue.trim());

      if (renameError) {
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

  function handleRenameKeyDown(event: KeyboardEvent) { /* ... (as before) ... */ }

  function requestDelete() {
      if (confirm(`Are you sure you want to delete "${node.name}"? ${node.is_folder ? '(This will delete all its contents!)' : ''}`)) {
          // Dispatch event with necessary info for FileTree to call store action
          dispatch('delete', { nodeId: node.id, parentId: node.parent_id, nodeName: node.name });
      }
  }

  function requestCreate(isFolder: boolean) {
       // Dispatch event for FileTree to handle creation via store
       dispatch('create', { parentId: node.id, isFolder });
  }

  // Helper to bubble notification up (optional, FileTree handles most)
  function showNotification(type: 'success' | 'error', message: string) {
      dispatch('error', { message } as VfsError); // Use error dispatch for simplicity here
  }

</script>

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
    <span class="flex-shrink-0 w-4"><Icon name={node.is_folder ? 'folder' : 'file'} /></span>

    <!-- Name / Rename Input -->
    <span class="flex-grow truncate">
        {#if isRenaming}
             <!-- Rename input as before -->
             <input id={`rename-${node.id}`}  bind:value={renameValue} on:blur  on:keydown={handleRenameKeyDown} disabled={isPerformingNodeAction}/>
        {:else} {node.name} {/if}
    </span>

    <!-- Actions -->
     {#if !isRenaming}
     <span class="flex-shrink-0 space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {#if node.is_folder}
            <button title="New File" on:click|stopPropagation={() => requestCreate(false)} disabled={isPerformingNodeAction} class="p-0.5 hover:text-blue-600 disabled:opacity-50"><Icon name="plus" /></button>
            <button title="New Folder" on:click|stopPropagation={() => requestCreate(true)} disabled={isPerformingNodeAction} class="p-0.5 hover:text-blue-600 disabled:opacity-50"><Icon name="folder" /></button>
        {/if}
        <button title="Rename" on:click|stopPropagation={startRename} disabled={isPerformingNodeAction} class="p-0.5 hover:text-green-600 disabled:opacity-50"><Icon name="edit" /></button>
        <button title="Delete" on:click|stopPropagation={requestDelete} disabled={isPerformingNodeAction} class="p-0.5 hover:text-red-600 disabled:opacity-50"><Icon name="trash" /></button>
     </span>
     {/if}
  </div>

  <!-- Error Message for Children -->
  {#if childrenError}
    <div class="pl-6 text-red-600 text-xs" style={`padding-left: ${(level + 1) * 1.5 + 0.25}rem;`}>
        Error loading contents: {childrenError.message}
        <button on:click={() => vfsStore.loadNodes(node.id, true)} class="ml-1 underline text-xs">Retry</button>
    </div>
  {/if}

  <!-- Children (Rendered based on store data) -->
  {#if isExpanded && children.length > 0}
    <div class="children">
      {#each children as childNode (childNode.id)}
        <svelte:self
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