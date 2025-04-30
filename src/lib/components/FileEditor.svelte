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
    import { getWasmExports, loadWasm } from '$lib/utils/wasm';
    import { loadSwalangWasm, getWasmSwalangExports } from "$lib/utils/wasm";
    import { renderMarkdown } from '$lib/utils/renderMarkdown';
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
      filenameChange: string; // Emits the current editor content
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
              dispatch('filenameChange',data.name)
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










    // --- State for Console, Preview, Runner ---
    let showBottomPanel = false; // Controls visibility of the entire bottom panel
    let activeTab: 'console' | 'preview' = 'console'; // Which tab is active
    let consoleOutput: string[] = []; // Array of lines for console output
    let isRunningCode = false; // Flag for simulated execution state
    let previewHtml = ''; // Holds the content for the HTML preview iframe
    /** Appends a line to the console output state */
    function logToConsole(message: string, type: 'log' | 'error' | 'info' = 'log') {
        const timestamp = new Date().toLocaleTimeString();
        // Add type prefix for potential styling later
        consoleOutput = [...consoleOutput, `[${timestamp} ${type.toUpperCase()}]: ${message}`];
        // Auto-scroll console (implementation needed in template or helper function)
    }

    /** Clears the console output */
    function clearConsole() {
        consoleOutput = [];
    }

    let wasm 
    onMount(async () => {
        await loadSwalangWasm();
		wasm = getWasmSwalangExports();
        await loadWasm();
        wasm = getWasmExports();
    });

    /** Simulates running the code in the editor */
    async function runCode() {
        if (!editor || isRunningCode) return;

        isRunningCode = true;
        showBottomPanel = true; // Ensure panel is visible
        activeTab = 'console'; // Switch to console tab
        clearConsole(); // Clear previous output
        logToConsole("Executing code...", 'info');
        dispatch('notification', { type: 'success', message: 'Running code...' });

        await tick(); // Allow UI to update

        const code = editor.getValue();
        const language = getLanguageFromFilename(fileData?.name);

        // --- !!! DANGER ZONE: SIMULATION ONLY !!! ---
        // Replace this section with actual secure execution logic (e.g., call to WASM or backend API)
        console.log(`--- SIMULATING EXECUTION (${language}) ---`);
        console.log(code);
        // Simulate execution time
        await new Promise(resolve => setTimeout(resolve, 1500));

        try {
            // Simulate different outputs based on language (VERY basic example)
            if (language === 'javascript' || language === 'typescript') {
                logToConsole("Simulated JS Output: Hello from JS!");
                logToConsole(`Code length: ${code.length}`);
            } else if (language === 'python') {
                logToConsole(window.runPylearn(code, fileData?.name));
            } else if (language === 'html') {
                logToConsole("HTML file detected. Use 'Preview' tab to view.", 'info');
            } else if (language === 'swalang') {
                // logToConsole(`Swalang code detected (length: ${code.length}). Execution simulation...`);
                // logToConsole("Mfumo: Mipangilio imekamilika."); // System: Setup complete.
                logToConsole(window.runSwalang(code, fileData?.name)); // Output: Hello Swalang!
            }
            else {
                logToConsole(`Execution simulation finished for ${language}.`);
            }
            logToConsole("Execution successful (simulation).", 'info');
        } catch (simulatedError: any) {
            logToConsole(`Execution failed (simulation): ${simulatedError.message}`, 'error');
        }
        // --- !!! END SIMULATION !!! ---

        isRunningCode = false;
        dispatch('notification', null); // Clear running notification
    }


    /** Updates the HTML preview iframe content */
    async function updatePreview() {
        if (!editor) {
            previewHtml = '<p class="p-4 text-sm italic text-gray-500">Editor not ready.</p>';
            return;
        }
        const content = editor.getValue();
        const language = getLanguageFromFilename(fileData?.name);

        if (language === 'html') {
            // Directly use HTML content (DOMPurify might be needed if content is untrusted)
            // For untrusted HTML, sanitize it first:
            // previewHtml = DOMPurify.sanitize(content);
            previewHtml = content; // Assuming trusted for now
        } else if (language === 'markdown') {
            // Render Markdown to HTML
            previewHtml = await renderMarkdown(content); // Reuse existing markdown renderer
        } else {
            // Show plain text for other languages
            const pre = document.createElement('pre');
            pre.textContent = content;
            previewHtml = `<div class="p-2 text-xs font-mono">${pre.outerHTML}</div>`;
        }
    }
    // Toggle bottom panel visibility
    function toggleBottomPanel() {
        showBottomPanel = !showBottomPanel;
    }

    // Switch active tab in bottom panel
    function setActiveTab(tab: 'console' | 'preview') {
        activeTab = tab;
        if (tab === 'preview') {
            updatePreview(); // Update preview when switching to it
        }
        showBottomPanel = true; // Ensure panel is visible when switching tab
    }

    // Update preview when content changes AND preview tab is active
    $: if (editorIsReady && activeTab === 'preview' && showBottomPanel) {
        // Maybe debounce this if updates are too frequent
        updatePreview();
    }
  
  </script>
  
  <!-- Template (HTML Structure) -->
  <div class="file-editor flex flex-col h-full text-sm" on:keydown={handleKeyDown}>
    <!-- Header Section: File name, Save, Run buttons -->
    <div class="flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex-shrink-0">
      <!-- File Name and Status Display -->
      <div class="font-semibold truncate flex items-center min-w-0 mr-2" title={fileData?.name ?? (isLoading ? 'Loading...' : 'No file selected')}>
          <!-- ... (existing file name/icon/dirty indicator logic) ... -->
            {#if fileData && !isLoading}
                <span class="mr-1 flex-shrink-0"><Icon name={fileData.is_folder ? 'folder' : (fileData.name.endsWith('.html') ? 'html5' : (fileData.name.endsWith('.sw') ? 'swalang' : 'file'))} class="w-4 h-4 align-text-bottom" /></span>
                <span class="truncate">{fileData.name}</span>
                {#if isDirty}<span class="text-blue-500 ml-1 flex-shrink-0" title="Unsaved changes">*</span>{/if}
            {:else if isLoading} <span class="mr-1 flex-shrink-0"><Icon name="loading"/></span> Loading...
            {:else if !currentFileIdInternal && !error} No File Selected
            {:else if error && error.code !== 'EDITOR_IS_FOLDER'} <span class="mr-1 flex-shrink-0 text-red-500"><Icon name="file"/></span> Error Loading
            {:else if fileData?.is_folder} <span class="mr-1 flex-shrink-0"><Icon name="folder"/></span> <span class="truncate">{fileData.name}</span>
            {:else} No File Selected
            {/if}
      </div>
      <!-- Action Buttons -->
      <div class="flex items-center space-x-2 flex-shrink-0">
          <!-- Run Button -->
           <button
              on:click={runCode}
              disabled={isRunningCode || !editorIsReady || fileData?.is_folder}
              class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              title="Run Code (Simulation)"
           >
              {#if isRunningCode} <Icon name="loading" class="w-4 h-4 mr-1"/> {:else} <Icon name="loading" class="w-4 h-4 mr-1"/> {/if} 
              Run
          </button>
           <!-- Save Button -->
          <button
              on:click={saveFile}
              disabled={!isDirty || isSaving || !editorIsReady}
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title={isDirty ? 'Save changes (Ctrl+S)' : (editorIsReady ? 'No changes to save' : 'Editor not ready')}
          >
              {#if isSaving} <Icon name="loading" class="w-4 h-4 mr-1"/> Saving... {:else} Save {/if}
          </button>
           <!-- Toggle Bottom Panel Button -->
           <button
              on:click={toggleBottomPanel}
              class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              title={showBottomPanel ? 'Hide Panel' : 'Show Panel'}
           >
               {#if showBottomPanel}
                   <Icon name="chevron-down" class="w-4 h-4"/> 
               {:else}
                    <Icon name="chevron-right" class="w-4 h-4"/> 
               {/if}
           </button>
      </div>
    </div>
  
    <!-- Main Content Area (Editor + Collapsible Panel) -->
    <div class="flex-grow flex flex-col relative min-h-0">
  
        <!-- Editor Container (Takes up remaining space when panel collapsed, shrinks when open) -->
        <div class="editor-area flex-grow relative" class:flex-shrink={showBottomPanel} style={showBottomPanel ? 'height: 65%;' : 'height: 100%;'}> 
            {#if isLoading} <div class="overlay-center"><Icon name="loading"/> Loading file...</div>
            {:else if error} <div class="overlay-center text-red-600">Error: {error.message} {#if error.code !== 'EDITOR_IS_FOLDER'}<button on:click={() => loadFile(currentFileIdInternal)} class="ml-2 underline">Retry</button>{/if}</div>
            {:else if fileData?.is_folder} <div class="overlay-center text-gray-500">Folders cannot be edited.</div>
            {:else if !currentFileIdInternal} <div class="overlay-center text-gray-500">Select a file to edit.</div>
            {/if}
            <div bind:this={editorContainer} class="editor-container w-full h-full" class:invisible={isLoading || error || !currentFileIdInternal || fileData?.is_folder}></div>
        </div>
  
         <!-- Collapsible Bottom Panel (Console/Preview) -->
         {#if showBottomPanel}
         <div class="bottom-panel flex flex-col border-t border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0" style="height: 35%;"> 
             <!-- Panel Tabs -->
             <div class="flex flex-shrink-0 border-b border-gray-300 dark:border-gray-600 text-xs">
                 <button
                      class="px-3 py-1"
                      class:bg-white={activeTab === 'console'} class:dark:bg-gray-800={activeTab === 'console'}
                      class:text-blue-600={activeTab === 'console'} class:dark:text-blue-400={activeTab === 'console'} class:font-medium={activeTab === 'console'}
                      class:text-gray-500={activeTab !== 'console'} class:dark:text-gray-400={activeTab !== 'console'}
                      class:hover:bg-gray-100={activeTab !== 'console'} class:dark:hover:bg-gray-700={activeTab !== 'console'}
                      on:click={() => setActiveTab('console')}
                  >
                     Console
                 </button>
                 <button
                      class="px-3 py-1"
                      class:bg-white={activeTab === 'preview'} class:dark:bg-gray-800={activeTab === 'preview'}
                      class:text-blue-600={activeTab === 'preview'} class:dark:text-blue-400={activeTab === 'preview'} class:font-medium={activeTab === 'preview'}
                      class:text-gray-500={activeTab !== 'preview'} class:dark:text-gray-400={activeTab !== 'preview'}
                      class:hover:bg-gray-100={activeTab !== 'preview'} class:dark:hover:bg-gray-700={activeTab !== 'preview'}
                      on:click={() => setActiveTab('preview')}
                  >
                     Preview
                 </button>
                  <!-- Console Clear Button -->
                  {#if activeTab === 'console'}
                  <button
                      on:click={clearConsole}
                      class="ml-auto mr-2 px-2 py-0.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-xs"
                      title="Clear Console"
                  >
                      Clear
                  </button>
                  {/if}
             </div>
  
             <!-- Panel Content Area -->
             <div class="flex-grow p-2 overflow-auto min-h-0"> 
                  {#if activeTab === 'console'}
                      <pre class="console-output whitespace-pre-wrap break-words text-xs font-mono text-gray-800 dark:text-gray-300">
                          {#each consoleOutput as line, i (i)}
                              <span>{line}</span><br/>
                          {/each}
                          {#if consoleOutput.length === 0}
                              <span class="text-gray-500 italic">Console output will appear here...</span>
                          {/if}
                      </pre>
                       <!-- TODO: Auto-scroll -->
                  {:else if activeTab === 'preview'}
                      <iframe
                          title="HTML Preview"
                          sandbox="allow-scripts allow-same-origin"
                          srcdoc={previewHtml}
                          class="w-full h-full border-0 bg-white"
                      ></iframe>
                  {/if}
             </div>
         </div>
         {/if}
    </div> 

  </div> 
  
  <!-- Component Styles -->
  <style>
    .editor-container { min-height: 100px; }
    .editor-container.invisible { visibility: hidden; }

    /* Simple overlay style for loading/error messages */
    .overlay-center {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(249, 250, 251, 0.8); /* bg-gray-50/80 */
         z-index: 10;
     }
     :global(html.dark) .overlay-center {
          background-color: rgba(17, 24, 39, 0.8); /* dark:bg-gray-900/80 */
     }

    /* Basic console styling */
    .console-output {
        /* Add specific styles if needed */
         word-break: break-all;
    }

    /* Ensure iframe takes full height */
    iframe { min-height: 100%; }
  </style>