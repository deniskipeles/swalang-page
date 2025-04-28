<script lang="ts">
    // Standard Svelte imports
    import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
    // Import VFS service and types
    import * as vfs from '$lib/services/fileSystemService';
    import type { FileNode, VfsError } from '$lib/services/fileSystemService';
    // Import local components and utils
    import Icon from './Icon.svelte';
    import { getLanguageFromFilename } from '$lib/utils/languageUtils';
    // swalang language syntax
    import { registerSwLanguage } from '$lib/monaco/swLanguage';
  
    import type { PageData } from '../../routes/app/$types';
    export let parentData:PageData
    // --- Monaco Editor Setup ---
    // Type definition for the Monaco library (will be populated by dynamic import)
    let monaco: typeof import('monaco-editor');
    // Reference to the created editor instance
    let editor: import('monaco-editor').editor.IStandaloneCodeEditor | null = null;
    // Reference to the DOM element where the editor will be mounted
    let editorContainer: HTMLDivElement;
  
    // --- Component Properties ---
    /** The ID of the file currently selected for editing. Passed from parent. */
    export let fileId: string | null = null;
  
    // --- Internal Component State ---
    /** Keeps track of the last file ID processed to detect changes */
    let currentFileIdInternal: string | null = null;
    /** Holds the metadata of the currently loaded file */
    let fileData: FileNode | null = null;
    /** Stores the original content loaded from the server (for dirty checking) */
    let originalContent: string = '';
    /** Flag indicating if the file data is currently being loaded */
    let isLoading: boolean = false;
    /** Flag indicating if the file content is currently being saved */
    let isSaving: boolean = false;
    /** Flag indicating if the Monaco Editor instance is fully initialized */
    let editorIsReady = false;
    /** Stores any error encountered during loading, saving, or editor init */
    let error: VfsError | { message: string, code?: string } | null = null;
    /** Flag indicating if the editor content differs from the last saved state */
    let isDirty: boolean = false;
    /** Current theme applied to the editor ('vs' for light, 'vs-dark' for dark) */
    let currentTheme: 'vs-dark' | 'vs' = 'vs'; // Default to light theme
  
    // --- Event Dispatcher ---
    /** Used to communicate events (notifications, content changes) to the parent component */
    const dispatch = createEventDispatcher<{
      notification: { type: 'success' | 'error'; message: string } | null;
      contentChange: string; // Emits the current editor content
    }>();
  
    // --- Core Methods ---
  
    /**
     * Sets the content of the Monaco editor instance.
     * Also updates the original content reference and resets the dirty state.
     * @param value The new content string.
     */
    function setEditorContent(value: string) {
      // Only update Monaco if the editor exists and the value is different
      if (editor && editor.getValue() !== value) {
          editor.setValue(value);
          // Optional: Reset the editor's undo history after programmatic change
          // editor.getModel()?.pushStackElement();
      }
      // Update the reference point for dirty checking
      originalContent = value;
      // Reset dirty flag as the content now matches the (newly set) original
      isDirty = false;
      // Notify parent about the content change
      dispatchContent();
    }
  
    /**
     * Dispatches the current content of the editor (or a fallback)
     * via the 'contentChange' event.
     */
    function dispatchContent() {
        if(editor && editorIsReady) {
           // Get current value from the active editor instance
           dispatch('contentChange', editor.getValue());
        } else {
           // Fallback: Dispatch the stored original content if editor isn't ready
           // This ensures context is available even if editor is initializing or null
           dispatch('contentChange', originalContent || '');
        }
    }
  
    /**
     * Loads the file data and content for the given file ID.
     * Handles resetting state, fetching data, and initializing the editor.
     * @param id The ID of the file to load, or null to clear the editor.
     */
    async function loadFile(id: string | null) {
      console.log(`loadFile called with ID: ${id}`);
      // 1. Reset component state for the new load operation
      fileData = null;
      isDirty = false;
      isLoading = true;
      isSaving = false; // Cancel any ongoing save
      error = null;
      dispatch('notification', null); // Clear previous notifications
  
      // 2. CRITICAL: Ensure any previous editor instance is disposed
      destroyEditor();
  
      // 3. Handle case where no file is selected (id is null)
      if (!id) {
          console.log("loadFile: ID is null, clearing editor state.");
          isLoading = false;
          if(editorContainer) editorContainer.innerHTML = ''; // Clear the container div visually
          originalContent = ''; // Reset original content
          dispatchContent(); // Dispatch empty content
          return; // Stop execution
      }
  
      // 4. Fetch file data using the VFS service
      console.log(`loadFile: Fetching file data for ID: ${id}`);
      const { data, error: fetchError } = await vfs.getFile(parentData.supabase, id);
  
      // 5. Process the fetch result
      if (fetchError) {
        // Handle API errors
        console.error(`loadFile: Error fetching file ${id}:`, fetchError);
        error = fetchError;
        dispatch('notification', { type: 'error', message: `Error loading file: ${fetchError.message}` });
        originalContent = ''; // Clear content on error
        dispatchContent();
      } else if (data) {
         // Successfully fetched data
         console.log(`loadFile: Received data for ${id}:`, data);
         fileData = data; // Store the file metadata
  
         if (data.is_folder) {
              // Handle selection of a folder
              console.log(`loadFile: Item ${id} is a folder.`);
              error = { message: "Folders cannot be edited.", code: 'EDITOR_IS_FOLDER' };
              originalContent = ''; // Clear content for folder
              dispatchContent();
         } else {
              // Handle selection of a file
              const fileContent = data.content ?? ''; // Use empty string if content is null
              const language = getLanguageFromFilename(data.name);
              console.log(`loadFile: Item ${id} is a file. Language: ${language}`);
              originalContent = fileContent; // Store the fetched content
  
              // Attempt to initialize the editor only if Monaco library is loaded AND the container div is ready
              if (monaco && editorContainer) {
                  console.log(`loadFile: Monaco lib & container ready, initializing editor for ${id}.`);
                  initializeEditor(fileContent, language);
              } else {
                  // If Monaco isn't ready yet (e.g., during initial mount), the content is stored in originalContent.
                  // The editor initialization will be triggered later (e.g., by onMount or reactive block)
                  console.log(`loadFile: Monaco lib or container not ready yet for ${id}. Content stored, editor init deferred.`);
              }
         }
      } else {
          // Handle case where API returns success but no data (e.g., RLS issue, file deleted race condition)
          console.warn(`loadFile: File data not found for ${id} (API returned no data).`);
          error = { message: "File not found or access denied.", code: 'EDITOR_FILE_NOT_FOUND' };
          originalContent = ''; // Clear content
          dispatchContent();
      }
      // 6. Mark loading as complete
      isLoading = false;
      console.log(`loadFile: Finished processing ID: ${id}`);
    }
  
    /**
     * Creates and configures a new Monaco Editor instance within the editorContainer.
     * @param initialContent The initial text content for the editor.
     * @param language The language identifier (e.g., 'javascript', 'python') for syntax highlighting.
     */
    async function initializeEditor(initialContent: string, language: string) {
        // Safety checks: ensure Monaco library is loaded, container div exists, and no editor instance currently exists
        if (!monaco || !editorContainer || editor) {
             console.warn(`initializeEditor: Aborting initialization. Conditions not met. Monaco: ${!!monaco}, Container: ${!!editorContainer}, Editor Exists: ${!!editor}`);
             return;
         }
        console.log(`Initializing Monaco Editor. Language: ${language}, Theme: ${currentTheme}`);
        editorIsReady = false; // Mark editor as initializing
  
        try {
          // Ensure the container is empty before mounting a new editor
          editorContainer.innerHTML = '';
  
          // Create the Monaco Editor instance
          editor = monaco.editor.create(editorContainer, {
              value: initialContent,        // Set initial text content
              language: language,           // Set language for highlighting/intellisense
              theme: currentTheme,          // Apply the current theme (vs or vs-dark)
              automaticLayout: true,        // Auto-resize editor on container resize
              minimap: { enabled: false },  // Optional: Disable the minimap
              wordWrap: 'on',               // Optional: Enable word wrapping
              tabSize: 4,                   // Standard tab size
              insertSpaces: true,           // Use spaces instead of tab characters
              fontSize: 14,                 // Set font size
              // Consider adding other options: readOnly, lineNumbers, scrollBeyondLastLine, etc.
          });
  
          // Set the reference point for dirty checking *after* editor creation
          originalContent = initialContent;
          isDirty = false; // Editor starts in a clean state
  
          // Attach listener for content changes within the editor
          editor.onDidChangeModelContent(() => {
              if (editor) { // Check if editor still exists (might be disposed)
                  const currentContent = editor.getValue();
                  // Update dirty state by comparing current content to the last saved state
                  isDirty = currentContent !== originalContent;
                  // Notify parent component of content change (e.g., for AI context)
                   dispatchContent();
              }
          });
  
           // Mark the editor as fully ready
           editorIsReady = true;
           console.log("Monaco Editor Initialized successfully.");
           // Dispatch the initial content state to the parent
           dispatchContent();
  
        } catch (e) {
            // Handle errors during editor creation
            console.error("Failed to initialize Monaco Editor:", e);
            error = { message: "Failed to initialize code editor.", code: 'EDITOR_INIT_FAILED' };
            editorIsReady = false;
            // Display error message within the container
            if (editorContainer) editorContainer.innerHTML = '<p class="p-4 text-red-500">Error: Failed to load the code editor.</p>';
        }
    }
  
    /**
     * Properly disposes of the current Monaco Editor instance to free up resources.
     */
     function destroyEditor() {
          if (editor) {
              console.log("Disposing Monaco Editor instance.");
              editor.dispose(); // Call Monaco's cleanup method
              editor = null;    // Clear the reference
              editorIsReady = false; // Mark editor as not ready
          }
          // Optionally clear the container's HTML content as well
          // if (editorContainer) editorContainer.innerHTML = '';
      }
  
    /**
     * Saves the current content of the editor back to the server via the VFS service.
     */
    async function saveFile() {
      // Prevent saving under various conditions
      if (!fileData || !isDirty || isSaving || !editor || !editorIsReady) {
        console.warn("Save aborted. Conditions not met.", { fileData: !!fileData, isDirty, isSaving, editor: !!editor, editorIsReady });
        return;
      }
  
      isSaving = true; // Indicate saving process start
      error = null;    // Clear previous errors
      dispatch('notification', null); // Clear previous notifications
  
      const currentContent = editor.getValue(); // Get content directly from Monaco instance
      console.log(`Saving file ${fileData.id}...`);
  
      // Call the VFS service to update the file
      const { data, error: saveError } = await vfs.updateFile(parentData.supabase, fileData.id, {
        content: currentContent,
      });
  
      // Handle the save operation result
      if (saveError) {
        // Handle save error
        console.error(`Error saving file ${fileData.id}:`, saveError);
        error = saveError;
        dispatch('notification', { type: 'error', message: `Error saving file: ${saveError.message}` });
      } else if(data) {
        // Handle successful save
        console.log(`File ${fileData.id} saved successfully.`);
        fileData = data; // Update local file metadata (e.g., updated_at)
        // Reset editor state to reflect the successful save
        setEditorContent(currentContent); // This updates originalContent and resets isDirty
        dispatch('notification', { type: 'success', message: `"${fileData.name}" saved successfully.` });
      } else {
           // Handle unexpected case where save succeeds but returns no data
           console.error(`Save completed for ${fileData.id} but no data returned.`);
           error = { message: "Save completed but no data returned.", code: 'EDITOR_SAVE_NO_DATA' };
           dispatch('notification', { type: 'error', message: error.message });
      }
      isSaving = false; // Indicate saving process end
    }
  
    /**
     * Handles keydown events within the component, specifically for the Ctrl+S/Cmd+S save shortcut.
     * @param event The KeyboardEvent object.
     */
    function handleKeyDown(event: KeyboardEvent) {
      // Check for Ctrl or Command key + 's'
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // Prevent the browser's default save action
        saveFile();           // Trigger the save function
      }
      // Note: Monaco handles Tab key behavior internally based on its configuration.
    }
  
    /**
     * Sets the theme for the Monaco editor instance.
     * @param theme The theme identifier ('vs' for light, 'vs-dark' for dark).
     */
    function setTheme(theme: 'vs-dark' | 'vs') {
        currentTheme = theme;
        // Apply the theme change only if Monaco library is loaded and editor exists
        if (monaco && editor) {
            monaco.editor.setTheme(theme);
        }
    }
  
    // --- Svelte Lifecycle & Reactivity ---
  
    /**
     * Runs once after the component is first mounted to the DOM.
     * Responsible for loading the Monaco library and handling initial file load.
     */
    onMount(async () => {
        console.log("FileEditor onMount: Initial fileId=", fileId);
        // Sync internal state on mount in case prop was set before mount finished
        currentFileIdInternal = fileId;
  
        isLoading = true; // Indicate loading until Monaco lib is ready
        try {
            // Dynamically import the Monaco editor library (code splitting)
            monaco = await import('monaco-editor');

            // === REGISTER CUSTOM LANGUAGE HERE ===
            registerSwLanguage(monaco); // <<<--- CALL REGISTRATION FUNCTION
            // ===================================
  
            // Set initial theme based on user's OS preference
            const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'vs-dark' : 'vs');
  
            // Add a listener to automatically update theme if OS preference changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                setTheme(event.matches ? 'vs-dark' : 'vs');
            });
  
            console.log("Monaco library loaded successfully.");
  
            // If a fileId was provided when the component mounted, load it now
            if (currentFileIdInternal) {
                console.log("FileEditor onMount: Loading initial file identified by fileId:", currentFileIdInternal);
                await loadFile(currentFileIdInternal); // Await initial load
            } else {
                // If no initial fileId, stop the loading indicator
                isLoading = false;
                dispatchContent(); // Ensure initial (empty) content state is dispatched
            }
  
        } catch (e) {
            // Handle errors if the Monaco library fails to load
            console.error("Fatal Error: Failed to load Monaco Editor library:", e);
            error = { message: "Failed to load code editor library.", code: 'EDITOR_LIB_LOAD_FAILED' };
            isLoading = false; // Stop loading indicator on critical error
            // Display error directly in container might be useful here
            if (editorContainer) editorContainer.innerHTML = '<p class="p-4 text-red-500">Error: Could not load the editor component.</p>';
        }
    });
  
    /**
     * Runs when the component is about to be removed from the DOM.
     * Responsible for cleaning up the Monaco editor instance.
     */
    onDestroy(() => {
        console.log("FileEditor onDestroy: Cleaning up editor instance.");
        destroyEditor(); // Dispose the Monaco editor
        // Remove the theme change listener to prevent memory leaks
        // window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', ...); // Need to store the handler function to remove it correctly
    });
  
    /**
     * Svelte Reactive Statement (`$:`).
     * This code block automatically re-runs whenever its dependencies (in this case, `fileId`) change
     * *after* the component has been mounted.
     */
    $: {
        // Check if Monaco library is loaded and the `fileId` prop has actually changed
        if (monaco && fileId !== currentFileIdInternal) {
            console.log(`$: Reactive change detected. fileId changed from ${currentFileIdInternal} to ${fileId}`);
            currentFileIdInternal = fileId; // Update the internal tracking ID
            loadFile(currentFileIdInternal); // Trigger the load process for the new file
        }
    }
  
  </script>
  
  <!-- Template (HTML Structure) -->
  <div class="file-editor flex flex-col h-full text-sm" on:keydown={handleKeyDown}>
    <!-- Header Section: Displays file name and save button -->
    <div class="flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex-shrink-0">
      <!-- File Name and Status Display -->
      <div class="font-semibold truncate flex items-center min-w-0 mr-2" title={fileData?.name ?? (isLoading ? 'Loading...' : 'No file selected')}>
          {#if fileData && !isLoading}
              <!-- Show file/folder icon and name -->
              <span class="mr-1 flex-shrink-0">
                <Icon 
                  name={
                    fileData.is_folder
                      ? 'folder'
                      : fileData.name.endsWith('.sw')
                        ? 'swalang'
                        : 'file'
                  } 
                   height={20} width={20}
                  class="w-4 h-4 align-text-bottom"
                />
                <!-- <Icon name={fileData.is_folder ? 'folder' : 'file'} class="w-4 h-4 align-text-bottom" /> -->
              </span>
              <span class="truncate">{fileData.name}</span>
              <!-- Show unsaved changes indicator (*) -->
              {#if isDirty}
                  <span class="text-blue-500 ml-1 flex-shrink-0" title="Unsaved changes">*</span>
              {/if}
          {:else if isLoading}
              <!-- Show loading indicator -->
              <span class="mr-1 flex-shrink-0"><Icon name="loading" class="w-4 h-4 align-text-bottom"/></span> Loading...
          {:else if !currentFileIdInternal && !error}
              <!-- Show when no file is selected initially -->
              No File Selected
          {:else if error && error.code !== 'EDITOR_IS_FOLDER'}
               <!-- Show error state -->
               <span class="mr-1 flex-shrink-0 text-red-500"><Icon name="file" class="w-4 h-4 align-text-bottom"/></span> Error Loading
          {:else if fileData?.is_folder}
               <!-- Show folder name when a folder is selected -->
               <span class="mr-1 flex-shrink-0">
                <Icon name="folder" class="w-4 h-4 align-text-bottom"/></span> <span class="truncate">{fileData.name}</span>
          {:else}
               <!-- Fallback state -->
               No File Selected
          {/if}
      </div>
      <!-- Save Button -->
      <button
        on:click={saveFile}
        disabled={!isDirty || isSaving || !editorIsReady} 
        class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        title={isDirty ? 'Save changes (Ctrl+S)' : (editorIsReady ? 'No changes to save' : 'Editor not ready')}
      >
        {#if isSaving} <Icon name="loading" class="inline-block mr-1 w-4 h-4 align-text-bottom" /> Saving... {:else} Save {/if}
      </button>
    </div>
  
    <!-- Main Editor Area with Overlays for Different States -->
    <div class="flex-grow relative min-h-0"> 
  
        <!-- Loading Overlay -->
        {#if isLoading}
            <div class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 z-10">
                <Icon name="loading" class="w-6 h-6 mr-2"/> Loading file...
            </div>
        <!-- Error Overlay -->
        {:else if error}
             <div class="absolute inset-0 flex items-center justify-center text-red-600 p-4 bg-gray-50 dark:bg-gray-800 z-10">
                Error: {error.message}
                {#if error.code !== 'EDITOR_IS_FOLDER' && error.code !== 'EDITOR_FILE_NOT_FOUND'}
                  <button on:click={() => loadFile(currentFileIdInternal)} class="ml-2 underline">Retry</button>
                {/if}
             </div>
        <!-- Folder Selected Overlay -->
        {:else if fileData?.is_folder}
          <div class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 z-10">
              Folders cannot be edited. Select a file.
          </div>
        <!-- No File Selected Overlay -->
         {:else if !currentFileIdInternal && !isLoading && !error} 
             <div class="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-800 z-10">
                 Select a file to begin editing.
             </div>
        {/if}
  
        <!-- Monaco Editor Container Div -->
        <!-- This div holds the actual editor. It always exists for `bind:this` -->
        <!-- We use `invisible` class to hide it visually when overlays are shown, preserving layout -->
        <div bind:this={editorContainer}
             class="editor-container w-full h-full"
             class:invisible={isLoading || error || !currentFileIdInternal || fileData?.is_folder}
        >
            <!-- Monaco Editor instance gets created inside this div by the script -->
        </div>
    </div>
  </div>
  
  <!-- Component Styles -->
  <style>
    .editor-container {
      min-height: 100px; /* Ensure container has a minimum size */
      /* Background color is controlled by the Monaco theme */
    }
    .editor-container.invisible {
        visibility: hidden; /* Hides the element but keeps its space in the layout */
    }
  </style>