<script lang="ts">
    import type { PageData } from './$types';
    import Icon from '$lib/components/Icon.svelte';
    // Import the potentially modified components
    import FileTree from '$lib/components/FileTree.svelte';
    import FileEditor from '$lib/components/FileEditor.svelte';
  
    export let data: PageData; // { shareToken, shareInfo, rootFileNode, children, filePathParts, isOwnerViewing, session }
  
    // State to track which file is selected *within the shared view*
    let selectedSharedFileId: string | null = data.rootFileNode?.is_folder ? null : data.rootFileNode?.id || null;
  
    // Determine the file ID to pass to the editor based on selection or root node
    $: editorFileId = selectedSharedFileId ?? (!data.rootFileNode?.is_folder ? data.rootFileNode?.id : null);

    $: content_header = `${data.rootFileNode?.is_folder ? 'Shared Folder' : 'Shared File'}: ${data.shareInfo?.title || data.rootFileNode?.name}`
  
  </script>

  <svelte:head>
    <title>{data.rootFileNode?.name || 'Shared Content'}</title>
    <meta name="description" content={content_header}>
    <!-- <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="/favicon.ico" />
    <link rel="stylesheet" href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css" /> -->
  </svelte:head>
  <div class="flex flex-col h-screen overflow-hidden"> 
  
       <!-- Minimal Header for Shared View -->
       <header class="p-2 border-b dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex-shrink-0 flex justify-between items-center">
           <div class="flex items-center space-x-2">
               <Icon name={data.rootFileNode?.is_folder ? 'folder' : 'file'} class="w-5 h-5 text-blue-500"/>
               <span class="font-semibold text-sm dark:text-gray-200 truncate" title={data.rootFileNode?.name}>
                   Shared: {data.rootFileNode?.name || 'Content'}
               </span>
           </div>
            <!-- Optional: Link back to main site? -->
           <a href="/" class="text-xs text-blue-600 dark:text-blue-400 hover:underline">Back to site</a>
       </header>
  
      <div class="flex flex-grow min-h-0">
  
          {#if data.rootFileNode}
              <!-- Display FileTree if the shared item is a FOLDER -->
              {#if data.rootFileNode.is_folder}
                  <div class="w-full lg:w-1/4 lg:min-w-[250px] lg:max-w-[400px] h-full flex-shrink-0">
                      <FileTree
                          {data}
                          isSharedView={true} 
                          sharedChildren={data.children || []}
                          bind:selectedFileId={selectedSharedFileId} 
                          />
                          <!-- Note: Loading deeper children in shared view requires more complex logic -->
                  </div>
              {/if}
  
              <!-- Display FileEditor (takes full width if file, or remaining width if folder) -->
              <div class="h-full flex flex-col flex-grow min-w-0 lg:border-l lg:dark:border-gray-700">
                   <FileEditor
                       isSharedView={true} 
                       fileId={editorFileId}
                       parentData={data}
                      />
                       <!-- Remove notification handling or adapt if needed for read-only view -->
                       <!-- on:notification={handleNotification} -->
                       <!-- Remove contentChange listener if AI isn't used here -->
                       <!-- on:contentChange={handleEditorContentChange} -->
              </div>
  
          {:else}
              <!-- Error Display if rootFileNode failed to load -->
              <div class="flex-grow flex items-center justify-center p-10">
                   <div class="text-center">
                       <h1 class="text-2xl font-bold text-red-600 mb-2">Share Not Found</h1>
                       <p class="text-gray-600 dark:text-gray-400">This share link may be invalid, expired, or the content has been removed.</p>
                        <a href="/" class="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">Go to Home</a>
                   </div>
              </div>
          {/if}
  
      </div> 
  </div>