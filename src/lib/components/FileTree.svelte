<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { vfsStore } from '$lib/stores/vfsStore'; // Import the store
  import type { VfsError } from '$lib/services/fileSystemService';
  import TreeNode from './TreeNode.svelte';
  import Icon from './Icon.svelte';
  import type { PageData } from '../../routes/app/$types';
  export let data:PageData
  export let isSharedView = false
  export let sharedChildren = []

  // --- Props ---
  export let selectedFileId: string | null = null; // Allow two-way binding

  // --- State ---
  // No longer need local rootNodes, isLoading, error
  let notification: { type: 'success' | 'error'; message: string } | null = null;

  const dispatch = createEventDispatcher<{ select: string | null, notification: typeof notification }>();

  // Subscribe to the store
  const storeValue = vfsStore; // Alias for readability in template if needed
  // $: console.log('VFS Store Updated:', $storeValue); // For debugging

  // Get derived values from the store
  $: rootNodes = $storeValue.nodesByParentId['root'] || [];
  $: isLoadingRoot = $storeValue.loading['root'] ?? false; // Use ?? for potential undefined
  $: rootError = $storeValue.errors['root'] ?? null;
  $: isPerformingAction = $storeValue.isPerformingAction; // Global action flag

  // --- Methods ---

  function showNotification(type: 'success' | 'error', message: string, duration = 3000) {
      notification = { type, message };
      dispatch('notification', notification);
      if(duration > 0) {
        setTimeout(clearNotification, duration);
      }
  }

   function clearNotification() {
        if(notification) {
          notification = null;
          dispatch('notification', null);
        }
    }

  // Handles delete event from TreeNode
  async function handleDelete(event: CustomEvent<{nodeId: string, parentId: string | null, nodeName: string}>) {
      const { nodeId, parentId, nodeName } = event.detail;
      clearNotification();

      // Call the store's delete action
      const { success, error: deleteError } = await vfsStore.deleteNode(data.supabase,nodeId, parentId);

      if (deleteError) {
           showNotification('error', `Failed to delete ${nodeName}: ${deleteError.message}`);
      } else if (success) {
           showNotification('success', `"${nodeName}" deleted successfully.`);
           // If deleted file was selected, deselect it
           if (selectedFileId === nodeId) {
               handleSelect({ detail: null } as any); // Deselect
           }
      }
      // No need to refresh manually, store update triggers reactivity
  }

  // Handles create event from TreeNode or root buttons
  async function handleCreate(event: CustomEvent<{ parentId: string | null; isFolder: boolean }>) {
      const { parentId, isFolder } = event.detail;
      clearNotification();
      const type = isFolder ? 'folder' : 'file';
      const name = prompt(`Enter name for new ${type}:`, `new-${type}`);

      if (!name || name.trim() === '') return;

      // Call the store's create action
      const { success, error: createError } = await vfsStore.createNode(data.supabase,{
          name: name.trim(),
          is_folder: isFolder,
          parent_id: parentId,
          content: isFolder ? null : '',
          user_id:data?.user?.id
      });

      if (createError) {
           showNotification('error', `Failed to create ${type}: ${createError.message}`);
      } else if (success) {
           showNotification('success', `"${name}" created successfully.`);
           // Optionally auto-select new file?
           // if (!isFolder && data?.id) { handleSelect({ detail: data.id } as any); }
      }
       // No need to refresh manually
  }

  function handleSelect(event: CustomEvent<string | null>) {
      selectedFileId = event.detail;
      dispatch('select', selectedFileId);
  }

  function handleError(event: CustomEvent<VfsError>) {
       // Errors from loading children (via TreeNode) or direct actions
       showNotification('error', event.detail.message);
  }

  // --- Lifecycle ---
  onMount(() => {
      // Load root nodes via the store on mount
      vfsStore.loadNodes(data.supabase,null,true);
  });

</script>

<div class="file-tree border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 h-full flex flex-col">
  <!-- Header / Toolbar -->
  <div class="p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
    <span class="font-semibold text-sm">Files</span>
    <div>
        <!-- Pass parentId=null for root actions -->
        <button title="New Root File" on:click={() => handleCreate({ detail: { parentId: null, isFolder: false } } as any)} class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" disabled={isPerformingAction}><Icon name="plus" /></button>
        <button title="New Root Folder" on:click={() => handleCreate({ detail: { parentId: null, isFolder: true } } as any)} class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" disabled={isPerformingAction}><Icon name="folder" /></button>
        <button title="Refresh" on:click={() => vfsStore.loadNodes(data.supabase,null, true)} class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" disabled={isLoadingRoot || isPerformingAction}>
            {#if isLoadingRoot}<Icon name="loading"/>{:else}🔄{/if}
        </button>
    </div>
  </div>

  <!-- Notification Area -->
  {#if notification}
      <div class="p-2 text-xs text-center"
           class:bg-red-100={notification.type === 'error'}
           class:text-red-700={notification.type === 'error'}
           class:bg-green-100={notification.type === 'success'}
           class:text-green-700={notification.type === 'success'}
           role="alert">
          {notification.message}
      </div>
  {/if}


  <!-- Tree Area -->
  <div class="flex-grow overflow-y-auto p-1">
    {#if isLoadingRoot && rootNodes.length === 0}
      <div class="p-4 text-center text-gray-500">Loading...</div>
    {:else if rootError}
      <div class="p-4 text-red-600">
        Error loading file tree: {rootError.message}
        <button on:click={() => vfsStore.loadNodes(data.supabase, null, true)} class="ml-2 underline">Retry</button>
      </div>
    {:else if rootNodes.length === 0 && !isLoadingRoot}
        <div class="p-4 text-center text-gray-500 italic">No files or folders.</div>
    {:else}
       <!-- Pass store data down if needed, or TreeNode can import store directly -->
       <!-- We'll have TreeNode import the store -->
      {#each rootNodes as node (node.id)}
        <TreeNode
          {data}
          {node}
          {isSharedView}
          {sharedChildren}
          level={0}
          bind:selectedFileId
          on:select={handleSelect}
          on:delete={handleDelete}
          on:create={handleCreate}
          on:error={handleError}
        />
      {/each}
    {/if}
  </div>
</div>