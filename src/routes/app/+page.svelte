<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { PageData } from './$types';
  import FileTree from '$lib/components/FileTree.svelte';
  import FileEditor from '$lib/components/FileEditor.svelte';
  import AIChat from '$lib/components/AIChat.svelte';
  import Icon from '$lib/components/Icon.svelte'; // Need Icon for buttons
  import { slide } from 'svelte/transition'; // Drawer transition
	import AiChatSw from '$lib/components/AIChatSW.svelte';
	import { setModel } from '$lib/stores/chatStore';

  export let data: PageData; // Session data

  // --- Core State ---
  let selectedFileId: string | null = null;
  let notification: { type: 'success' | 'error'; message: string } | null = null;
  let editorContentForAI: string = ''; // Updated via hack for now

  // --- Responsive State ---
  let innerWidth: number = 0; // Bound to window width
  let isMobileFileTreeOpen = false;
  let isMobileChatOpen = false;
  const mobileBreakpoint = 1024; // Tailwind's lg breakpoint

  $: isSmallScreen = innerWidth < mobileBreakpoint;

  // --- Responsive Logic ---
  // Close drawers when switching to large screen if they were open
  $: if (!isSmallScreen && (isMobileFileTreeOpen || isMobileChatOpen)) {
      isMobileFileTreeOpen = false;
      isMobileChatOpen = false;
  }

  // When a file is selected on a small screen, close the file tree drawer
  $: if (selectedFileId && isSmallScreen) {
      isMobileFileTreeOpen = false;
  }

  function toggleMobileFileTree() {
      if (!isSmallScreen) return;
      isMobileFileTreeOpen = !isMobileFileTreeOpen;
      if (isMobileFileTreeOpen) isMobileChatOpen = false; // Close chat if opening tree
  }

  function toggleMobileChat() {
       if (!isSmallScreen) return;
       isMobileChatOpen = !isMobileChatOpen;
       if (isMobileChatOpen) isMobileFileTreeOpen = false; // Close tree if opening chat
  }

  // --- Event Handlers ---
  function handleNotification(event: CustomEvent<{ type: 'success' | 'error'; message: string } | null>){
      notification = event.detail;
       if(notification){
            setTimeout(() => notification = null, 3500);
       }
  }

   // --- Context Update (Hack - Requires Improvement) ---
   $: if(selectedFileId) {
       updateEditorContextForAI();
   }
   async function updateEditorContextForAI() {
        // Wait for potential DOM updates after file selection/load
        await tick();
        await tick(); // Sometimes needs another tick
        const editorEl = document.getElementById('file-content-editor') as HTMLTextAreaElement;
        if (editorEl) {
            editorContentForAI = editorEl.value;
        }
   }

   // --- Lifecycle ---
   onMount(() => {
       // Set initial width needed for $: isSmallScreen
       innerWidth = window.innerWidth;
   });

   // Listen to content changes from the editor
  function handleEditorContentChange(event: CustomEvent<string>) {
      editorContentForAI = event.detail;
  }
   // Listen to content changes from the editor
   let filename = 'text'
  function handleFilenameChange(event: CustomEvent<string>) {
      filename = event.detail;
      if (filename.endsWith('.sw')) {
        setModel('gemini-1.5-flash-latest')
    } else {
        setModel('llama3-8b-8192')
      }
      console.log('file>>>>>>>>',filename,'<<<<<<<<<<')
  }

</script>

<!-- Bind window width -->
<svelte:window bind:innerWidth />

<div class="flex flex-col h-screen overflow-hidden"> <!-- Main container: full height, prevent body scroll -->

    <!-- Header (Example - Adapt your existing header) -->
     <header class="bg-gray-800 text-white p-0 flex justify-between items-center flex-shrink-0">
        <div class="flex items-center space-x-2">
             <!-- Hamburger Menu Button (Mobile Only) -->
            <button
                on:click={toggleMobileFileTree}
                class="p-2 rounded hover:bg-gray-700 lg:hidden"
                aria-label="Toggle File Tree"
            >
                <Icon name="folder" class="w-5 h-5"/> <!-- Use a Menu/Hamburger icon ideally -->
            </button>
            <h4 class="text-lg font-bold">Code Box</h4>
            <!-- <h4 class="text-lg font-bold">Coding Assistant</h4> -->
        </div>
      </header>

    <!-- Global Notification Area (Position fixed/absolute) -->
     {#if notification}
       <!-- ... (notification element as before - ensure high z-index) ... -->
       <div class="p-2 text-sm text-center fixed top-14 left-1/2 transform -translate-x-1/2 z-[60] rounded shadow-md w-auto max-w-md"
           class:bg-red-100={notification.type === 'error'} class:text-red-700={notification.type === 'error'}
           class:bg-green-100={notification.type === 'success'} class:text-green-700={notification.type === 'success'}
           role="alert">
          {notification.message}
           <button on:click={() => notification = null} class="ml-4 font-bold">X</button>
      </div>
    {/if}

    <!-- Main Content Area -->
    <div class="flex flex-grow min-h-0 relative"> <!-- Flex container for columns, relative for modals -->

        <!-- File Tree Panel (Desktop Visible, Mobile in Drawer) -->
        <div
            class="h-full flex-shrink-0 lg:block lg:w-1/4 lg:min-w-[250px] lg:max-w-[400px]"
            class:hidden={isSmallScreen}  
        >
          <FileTree {data} bind:selectedFileId on:notification={handleNotification} />
        </div>

        <!-- Editor Panel (Desktop Visible, Mobile takes full width when file selected) -->
        <div
            class="h-full flex flex-col flex-grow min-w-0 lg:border-l lg:border-gray-300 lg:dark:border-gray-700"
            class:hidden={isSmallScreen && !selectedFileId} 
        >
            <FileEditor
                fileId={selectedFileId}
                parentData={data}
                on:notification={handleNotification}
                on:contentChange={handleEditorContentChange}
                on:filenameChange={handleFilenameChange}
            />
        </div>

        <!-- AI Chat Panel (Desktop Visible, Mobile in Drawer) -->
        <div
            class="h-full flex-shrink-0 lg:block lg:w-1/4 lg:min-w-[300px] lg:border-l lg:border-gray-300 lg:dark:border-gray-700"
            class:hidden={isSmallScreen} 
         >
            {#if filename.endsWith('.sw')}
                <!-- content here -->
                <AiChatSw
                    context={editorContentForAI}
                    on:notification={handleNotification}
                    {data}
                />
            {:else}
                <AIChat
                    context={editorContentForAI}
                    on:notification={handleNotification}
                    {data}
                />
            {/if}
        </div>

        <!-- == Mobile Drawers / Modals == -->

        {#if isSmallScreen}
            <!-- Mobile File Tree Drawer -->
            {#if isMobileFileTreeOpen}
                 <!-- Overlay -->
                <div transition:slide={{ duration: 200, axis: 'x' }}
                     class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                     on:click={toggleMobileFileTree}
                     role="button" tabindex="0" aria-label="Close file tree"
                ></div>
                <!-- Drawer Content -->
                <div transition:slide={{ duration: 300, axis: 'x' }}
                     class="fixed top-0 left-0 h-full w-4/5 max-w-xs bg-white dark:bg-gray-800 shadow-lg z-50 flex flex-col lg:hidden"
                >
                    <!-- Close Button Inside Drawer -->
                    <div class="p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
                         <span class="font-semibold text-sm">Files</span>
                         <button on:click={toggleMobileFileTree} class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600">✕</button>
                    </div>
                    <!-- File Tree Component -->
                    <div class="flex-grow overflow-y-auto">
                         <FileTree {data} bind:selectedFileId on:notification={handleNotification} />
                    </div>
                </div>
            {/if}

             <!-- Mobile AI Chat Drawer -->
             {#if isMobileChatOpen}
                  <!-- Overlay -->
                <div transition:slide={{ duration: 200, axis: 'x' }}
                     class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                     on:click={toggleMobileChat}
                     role="button" tabindex="0" aria-label="Close AI chat"
                ></div>
                 <!-- Drawer Content -->
                 <div transition:slide={{ duration: 300, axis: 'x' }}
                      class="fixed top-0 right-0 h-full w-4/5 max-w-md bg-white dark:bg-gray-800 shadow-lg z-50 flex flex-col lg:hidden"
                 >
                     <!-- Close Button Inside Drawer -->
                     <div class="p-2 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                         <span class="font-semibold text-sm">AI Assistant</span>
                         <button on:click={toggleMobileChat} class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600">✕</button>
                     </div>
                    <!-- AI Chat Component -->
                     <div class="flex-grow overflow-y-auto min-h-0">
                        {#if filename.endsWith('.sw')}
                            <!-- content here -->
                            <AiChatSw
                                context={editorContentForAI}
                                on:notification={handleNotification}
                                {data}
                            />
                        {:else}
                            <AIChat
                                context={editorContentForAI}
                                on:notification={handleNotification}
                                {data}
                            />
                        {/if}
                     </div>
                 </div>
             {/if}

             <!-- AI Chat Floating Action Button (FAB) -->
             {#if !isMobileChatOpen}
                <button
                    on:click={toggleMobileChat}
                    class="fixed bottom-4 right-4 z-30 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 lg:hidden"
                    aria-label="Toggle AI Chat"
                >
                   <!-- Replace with a proper AI/Chat icon -->
                   💬
                </button>
             {/if}

        {/if}


    </div> <!-- End Main Content Area -->
</div><!-- End Main Container -->