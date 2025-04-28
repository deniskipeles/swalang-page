<script lang="ts">
  // Svelte Core Imports
  import { onDestroy, createEventDispatcher, onMount } from 'svelte';

  // Supabase & Environment Imports
  import { supabase } from '$lib/supabaseClient';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

  // Local Component Imports
  import Icon from './Icon.svelte';

  // Store Imports
  import { chatStore, addMessage, setLoading, setModel, updateLastAssistantMessage } from '$lib/stores/chatStore';
  import type { ChatMessage } from '$lib/stores/chatStore';

  // Utility Imports
  import { marked } from 'marked'; // For Markdown rendering
  import DOMPurify from 'dompurify'; // For sanitizing HTML
  import type { PageData } from '../../routes/app/$types';
  export let data:PageData

  // --- Component Properties ---
  /** Context string passed from parent (e.g., editor content) */
  export let context: string = '';
  /** Maximum tokens for the AI response (optional override) */
  export let maxTokens: number | undefined = 1500;

  // --- Internal Component State ---
  /** Bound to the user's prompt input textarea */
  let userPrompt: string = '';
  /** Bound to the optional system prompt textarea */
  let systemPrompt: string = '';
  /** Stores local errors encountered during request sending phase */
  let errorMessage: string | null = null;
  /** Controller to allow cancellation of ongoing fetch requests */
  let abortController: AbortController | null = null;
  /** Reference to the scrollable chat response DOM element */
  let responseElement: HTMLElement | null;
  /** Tracks the current OS color scheme preference for styling */
  let currentTheme: 'vs-dark' | 'vs' = 'vs'; // Default to light

  // --- Event Dispatcher ---
  /** Used to send notifications (e.g., errors) to the parent component */
  const dispatch = createEventDispatcher<{
    notification: { type: 'success' | 'error'; message: string } | null;
  }>();

  // --- Store Subscription ---
  /** Create a reactive reference to the chat store */
  const store = chatStore;

  // --- Configuration ---
  /** List of AI models available for selection */
  const availableModels = [
    "gemma2-9b-it",
    "llama-3.1-70b-versatile",
    "llama-3.1-8b-instant",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "mixtral-8x7b-32768",
    // Add other relevant models from your list here
  ];

  // --- Reactive Computations ---
  /** Filters messages from the store for display (excludes system messages) */
  $: messagesToDisplay = $store.messages.filter(msg => msg.role !== 'system');

  // --- Core Methods ---

  /**
   * Asynchronously renders Markdown string to sanitized HTML.
   * Falls back to preformatted text on error.
   * @param markdown The Markdown string to render.
   * @returns A Promise resolving to the sanitized HTML string or preformatted text.
   */
   async function renderMarkdown(markdown: string): Promise<string> {
    if (!markdown) return '';
    try {
        const rawHtml = await marked.parse(markdown, { async: true, gfm: true, breaks: true });
        const sanitizedHtml = DOMPurify.sanitize(rawHtml);

        // --- Inject Copy Buttons ---
        // Use DOMParser to work with the HTML fragment
        const parser = new DOMParser();
        const doc = parser.parseFromString(sanitizedHtml, 'text/html'); // Parse as full HTML document body

        // Find all <pre> elements (common container for code blocks)
        doc.querySelectorAll('pre').forEach((preElement, index) => {
            // Check if it likely contains code (might have a <code> child)
            const codeElement = preElement.querySelector('code');
            if (!codeElement) return; // Skip pre tags without code tags inside

            // Create the copy button
            const button = document.createElement('button');
            button.textContent = 'Copy';
            button.className = 'code-copy-button'; // Add a class for styling and event delegation
            // Add data attributes to easily find the target code later
            button.dataset.copyTargetId = `code-block-${"message.id"}-${index}`; // Need message context here - tricky!
            preElement.dataset.codeBlockId = `code-block-${"message.id"}-${index}`; // Add ID to pre element itself


            // Style the button (inline or via CSS class) - Minimal inline styles example
            button.style.position = 'absolute';
            button.style.top = '0.3rem';
            button.style.right = '0.3rem';
            button.style.padding = '0.1rem 0.4rem';
            button.style.fontSize = '0.7rem';
            button.style.backgroundColor = '#6b7280'; // gray-500
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '0.25rem';
            button.style.cursor = 'pointer';
            button.style.opacity = '0.7'; // Slightly transparent initially

            // Make the parent <pre> position relative if it's not already
            // to allow absolute positioning of the button
            if (window.getComputedStyle(preElement).position === 'static') {
                 preElement.style.position = 'relative';
            }

            // Add hover effect (could also be done with CSS)
            button.onmouseenter = () => button.style.opacity = '1';
            button.onmouseleave = () => button.style.opacity = '0.7';


            // Prepend or append the button to the <pre> element
            preElement.prepend(button); // Put it inside, at the top
        });

        // Return the modified HTML body content
        return doc.body.innerHTML;

    } catch (error) {
        console.error("Markdown rendering/sanitization/button injection failed:", error);
        const preElement = document.createElement('pre');
        preElement.textContent = markdown;
        return preElement.outerHTML;
    }
  }


  // --- Function to handle copy button clicks ---
  async function handleCopyClick(event: MouseEvent) {
      const target = event.target as HTMLElement;

      // Check if the clicked element is a copy button
      if (target.classList.contains('code-copy-button')) {
          // Find the parent <pre> element
          const preElement = target.closest('pre');
          if (!preElement) return;

          // Find the <code> element inside the <pre>
          const codeElement = preElement.querySelector('code');
          if (!codeElement) return;

          // Get the text content to copy
          const codeToCopy = codeElement.textContent || '';

          try {
              await navigator.clipboard.writeText(codeToCopy);
              // Provide feedback to the user
              target.textContent = 'Copied!';
              target.style.backgroundColor = '#10b981'; // green-500
              setTimeout(() => {
                  target.textContent = 'Copy'; // Reset button text
                  target.style.backgroundColor = '#6b7280'; // Reset color
              }, 1500); // Reset after 1.5 seconds
          } catch (err) {
              console.error('Failed to copy code to clipboard:', err);
              target.textContent = 'Error!';
              target.style.backgroundColor = '#ef4444'; // red-500
              setTimeout(() => {
                  target.textContent = 'Copy';
                  target.style.backgroundColor = '#6b7280';
              }, 2000);
          }
      }
  }


  /**
   * Sends the user's prompt (with context and system prompt) to the AI Edge Function.
   * Manages loading state, adds messages to the store, and handles the streaming response.
   */
  async function sendAiRequest() {
    // Prevent duplicate requests or sending empty prompts
    if ($store.isLoading || !userPrompt.trim()) return;

    setLoading(true); // Update store's loading state
    errorMessage = null; // Clear local errors
    dispatch('notification', null); // Clear parent notifications
    abortController = new AbortController(); // Create a new controller for this request

    // 1. Add User Message to Store
    const userMessage: ChatMessage = {
        id: crypto.randomUUID(), // Generate unique ID
        role: 'user',
        content: userPrompt,
        timestamp: Date.now(),
    };
    addMessage(userMessage);

    // 2. Add Placeholder Assistant Message to Store
    // This will be updated incrementally by the stream.
    const assistantMessageId = crypto.randomUUID();
     addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '', // Start with empty content
        timestamp: Date.now(),
        model: $store.currentModel, // Record the model being used
     });

    // 3. Prepare for request
    const currentPromptForRequest = userPrompt; // Keep a copy as input field is cleared
    userPrompt = ''; // Clear the input field

    // Scroll chat to bottom after adding messages
     requestAnimationFrame(() => {
         if (responseElement) {
             responseElement.scrollTop = responseElement.scrollHeight;
         }
     });

    try {
      // 4. Authenticate: Get Supabase JWT token
      const { data: { session }, error: sessionError } = await data.supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(`Authentication error: ${sessionError?.message || 'Not logged in'}`);
      }
      const token = session.access_token;

      // 5. Construct API Payload (using messages array format)
       const apiMessages: {role: 'system' | 'user' | 'assistant', content: string}[] = [];
       // Add system prompt if provided
       if (systemPrompt.trim()) {
           apiMessages.push({ role: 'system', content: systemPrompt.trim() });
       }
       // TODO: Consider adding previous conversation history here for context
       // Example: const history = $store.messages.slice(-5); // Get last 5 messages
       // history.forEach(msg => apiMessages.push({ role: msg.role, content: msg.content }));

       // Add current user message (potentially embedding context)
       const userContent = context.trim()
           ? `Context:\n\`\`\`\n${context.trim()}\n\`\`\`\n\nUser query: ${currentPromptForRequest}`
           : currentPromptForRequest;
       apiMessages.push({ role: 'user', content: userContent });

      // Final payload for the Edge Function
      const payload = {
          prompt: currentPromptForRequest,
          context: JSON.stringify(apiMessages),
          config: { // Pass configuration options
              model: $store.currentModel, // Model selected by user (from store)
              max_tokens: maxTokens,     // Max response tokens (from prop)
          }
      };

      // 6. Call the Edge Function
       const functionUrl = `${PUBLIC_SUPABASE_URL}/functions/v1/ai-stream`;
       const res = await fetch(functionUrl, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${token}`,
           // Required by Supabase functions unless JWT verification allows authenticated users directly
           'apikey': PUBLIC_SUPABASE_ANON_KEY
         },
         body: JSON.stringify(payload),
         signal: abortController.signal, // Link cancellation controller
       });

       // 7. Handle HTTP Errors from Edge Function
       if (!res.ok) {
           let errorData = { message: `Request failed with status ${res.status}` };
           try { // Try to parse specific error from function response
                errorData = await res.json();
           } catch (e) { /* Ignore parsing error, use status */ }
           throw new Error(`Error ${res.status}: ${errorData.message || res.statusText}`);
       }
       if (!res.body) { // Should not happen if status is OK, but check
           throw new Error("Response body is missing.");
       }

       // 8. Process the Successful Stream Response
       const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
       while (true) {
            const { done, value } = await reader.read();
            if (done) { console.log("Stream finished."); break; } // Exit loop when stream ends

            // Process chunk if it's a non-empty string
            if (typeof value === 'string' && value.trim().length > 0) {
              const lines = value.split('\n');
              for (const line_data of lines) {
                 if (line_data.startsWith('{"id"')) {
                     if (line_data.trim() === '[DONE]') { // OpenAI specific [DONE] marker
                         continue; // Ignore the [DONE] marker itself
                     }
                    try {
                        // Parse the line assuming it's a complete JSON object string
                        const chunk = JSON.parse(line_data);
                        // Extract the text delta from the expected path
                        const delta = chunk.choices?.[0]?.delta?.content;

                        // Append delta to store if it's valid text content
                        if (typeof delta === 'string' && delta.length > 0) {
                            updateLastAssistantMessage(delta, $store.currentModel); // Update store reactively
                            // Scroll chat to bottom as new content arrives
                            requestAnimationFrame(() => {
                                if (responseElement) {
                                    responseElement.scrollTop = responseElement.scrollHeight;
                                }
                            });
                        } else {
                            // Check for finish reason if delta is not content
                            const finishReason = chunk.choices?.[0]?.finish_reason;
                            if (finishReason) {
                                console.log("Stream finished via chunk finish_reason:", finishReason);
                                // Potentially break loop or handle based on reason
                            }
                        }
                    } catch (e) {
                        // Log errors if parsing fails (e.g., unexpected stream format)
                        console.warn("Couldn't parse stream value as JSON:", value, e);
                    }
                }
              }
            } else if (value) {
                // Log unexpected non-string or empty values from the stream
                console.log("Received non-string or empty value from stream:", value);
            }
       } // end while loop for stream reading

    } catch (error: any) {
        // Handle errors during the request/stream process
       if (error.name === 'AbortError') {
         // Handle user cancellation
         console.log('AI request aborted by user.');
         errorMessage = 'Request cancelled.';
         // Clean up: Remove the empty placeholder assistant message from store
         chatStore.update(state => ({ ...state, messages: state.messages.filter(m => m.id !== assistantMessageId || m.content !== '') }));
       } else {
         // Handle other errors (network, auth, API, etc.)
         console.error('AI Chat Error:', error);
         errorMessage = error.message || 'An unknown error occurred.';
         // Add an error message directly to the chat history in the store
         addMessage({
             id: crypto.randomUUID(),
             role: 'error',
             content: `Error: ${errorMessage}`,
             timestamp: Date.now(),
         });
       }
    } finally {
       // Final cleanup steps after request finishes or fails
       setLoading(false); // Ensure loading state is turned off in store
       abortController = null; // Clear the abort controller reference
       // Ensure chat is scrolled to the bottom after everything settles
       requestAnimationFrame(() => {
           if (responseElement) {
               responseElement.scrollTop = responseElement.scrollHeight;
           }
       });
    }
  }

  /**
   * Cancels the ongoing AI request by aborting the fetch controller.
   */
  function cancelRequest() {
    if (abortController) {
      abortController.abort();
      console.log("Request cancellation initiated.");
    }
  }

  /**
   * Handles changes to the model selection dropdown.
   * Updates the chat store with the newly selected model.
   * @param event The change event from the HTMLSelectElement.
   */
  function handleModelChange(event: Event) {
      const target = event.target as HTMLSelectElement;
      setModel(target.value); // Update the reactive store
  }

  // --- Svelte Lifecycle Hooks ---

  /**
   * Runs once after the component mounts.
   * Sets the initial theme based on OS preference and adds a listener for theme changes.
   */
  let themeChangeHandler: ((event: MediaQueryListEvent) => void) | null = null; // Store handler for removal
  onMount(() => {
    // Detect initial OS theme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    currentTheme = mediaQuery.matches ? 'vs-dark' : 'vs';

    // Add event listener for copy clicks using delegation on the response area
    if (responseElement) {
        responseElement.addEventListener('click', handleCopyClick);
    }
    // Define the handler function
    themeChangeHandler = (event: MediaQueryListEvent) => {
        currentTheme = event.matches ? 'vs-dark' : 'vs';
        console.log("Theme changed to:", currentTheme);
    };

    // Add the listener
    mediaQuery.addEventListener('change', themeChangeHandler);
  });

  /**
   * Runs when the component is about to be unmounted.
   * Cleans up by cancelling any ongoing request and removing the theme change listener.
   */
  onDestroy(() => {
    cancelRequest(); // Abort fetch if component is destroyed mid-request
    // Remove theme change listener
    if (themeChangeHandler) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeChangeHandler);
    }
    if (responseElement) {
        responseElement.removeEventListener('click', handleCopyClick);
    }
  });

</script>

<!-- Component Template (HTML Structure) -->
<div class="ai-chat flex flex-col h-full text-sm bg-white dark:bg-gray-800"> 
    <!-- Header: Title and Model Selection Dropdown -->
     <div class="p-2 border-b border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex-shrink-0 flex items-center justify-between space-x-2">
        <span class="font-semibold flex-shrink-0 text-gray-800 dark:text-gray-200">AI Assistant</span>
        <select
            id="ai-model-select"
            class="text-xs p-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-ellipsis overflow-hidden max-w-[200px] sm:max-w-[250px]"
            title="Select AI Model"
            value={$store.currentModel}
            on:change={handleModelChange}
            disabled={$store.isLoading}
        >
            {#each availableModels as modelName (modelName)}
                <option value={modelName}>{modelName}</option>
            {/each}
        </select>
     </div>

    <!-- Chat Response Area: Displays messages from the store -->
    <div bind:this={responseElement} class="response-area flex-grow p-2 overflow-y-auto">
        <!-- Display empty state message -->
        {#if messagesToDisplay.length === 0 && !$store.isLoading}
            <p class="text-gray-500 dark:text-gray-400 italic text-center mt-4 text-xs">Enter a prompt below to start chatting.</p>
        {/if}

        <!-- Iterate over messages stored in the chatStore -->
        {#each messagesToDisplay as message (message.id)}
            <div class="message mb-4 max-w-full">
                 <!-- Role Header (User/Assistant/Error) -->
                 <div class="font-bold text-xs mb-1 capitalize"
                      class:text-blue-700={message.role === 'user' && currentTheme === 'vs'}
                      class:text-blue-400={message.role === 'user' && currentTheme === 'vs-dark'}
                      class:text-green-700={message.role === 'assistant' && currentTheme === 'vs'}
                      class:text-green-400={message.role === 'assistant' && currentTheme === 'vs-dark'}
                      class:text-red-600={message.role === 'error' && currentTheme === 'vs'}
                      class:text-red-400={message.role === 'error' && currentTheme === 'vs-dark'}
                 >
                    {message.role}
                    <!-- Display shortened model name for assistant messages -->
                    {#if message.role === 'assistant' && message.model}
                        <span class="font-normal text-gray-500 dark:text-gray-400 text-[0.65rem] ml-1">
                           ({message.model.split('/')[1] || message.model.split('-')[0] || message.model})
                        </span>
                    {/if}
                </div>

                 <!-- Message Content Area (Renders Markdown or Plain Text) -->
                 <div class="content prose prose-sm dark:prose-invert max-w-none"> 
                    {#if message.role === 'error'}
                        <p class="text-red-600 dark:text-red-400">{message.content}</p> <!-- Style error text explicitly -->
                    {:else}
                         <!-- Asynchronously render markdown content -->
                         {#await renderMarkdown(message.content)}
                             <p class="opacity-50 text-gray-500 dark:text-gray-400 text-xs">Rendering message...</p> <!-- Placeholder during rendering -->
                         {:then htmlContent}
                             {@html htmlContent} <!-- Inject the sanitized HTML -->
                         {:catch error}
                             <!-- Fallback if markdown rendering fails -->
                             <p class="text-red-500 dark:text-red-400 text-xs italic">Error rendering content.</p>
                             <pre class="text-xs mt-1 bg-gray-100 dark:bg-gray-700 p-2 rounded overflow-x-auto">{message.content}</pre> <!-- Show raw content preformatted -->
                         {/await}
                     {/if}
                 </div>
            </div>
        {/each}

        <!-- Loading Indicator during assistant response generation -->
        {#if $store.isLoading && messagesToDisplay.length > 0 && messagesToDisplay[messagesToDisplay.length-1].role === 'assistant' && messagesToDisplay[messagesToDisplay.length-1].content === ''}
            <div class="message assistant mb-4">
                 <div class="font-bold text-xs mb-1 capitalize text-green-700 dark:text-green-400">Assistant</div>
                 <div class="content prose prose-sm dark:prose-invert max-w-none">
                     <!-- Simple pulsing dots or spinner -->
                     <span class="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-0.5"></span><span class="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-0.5 animation-delay-150"></span><span class="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse animation-delay-300"></span>
                 </div>
            </div>
        {/if}
    </div> <!-- End Response Area -->

    <!-- Optional System Prompt Input -->
    <div class="p-2 border-t border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
        <textarea
            bind:value={systemPrompt}
            placeholder="Optional: System Prompt (e.g., Act as a senior developer specializing in Svelte...)"
            rows="2"
            class="w-full p-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs resize-none shadow-sm"
            disabled={$store.isLoading}
            aria-label="System Prompt Input"
        ></textarea>
    </div>

    <!-- User Prompt Input and Controls Area -->
    <div class="input-area p-2 border-t border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 flex-shrink-0">
         <!-- Display local error messages -->
         {#if errorMessage}
            <p class="text-red-600 dark:text-red-400 text-xs mb-1">{errorMessage}</p>
         {/if}
        <div class="flex items-end space-x-2">
            <!-- User Prompt Textarea -->
            <textarea
                bind:value={userPrompt}
                placeholder="Enter your prompt (Ctrl+Enter to send)..."
                rows="3"
                class="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none shadow-sm"
                disabled={$store.isLoading}
                on:keydown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendAiRequest(); } }}
                aria-label="User Prompt Input"
            ></textarea>
            <!-- Action Buttons (Send/Cancel) -->
            {#if $store.isLoading}
                <button
                    on:click={cancelRequest}
                    class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs h-10 self-end flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900"
                    title="Cancel Request"
                    aria-label="Cancel AI Request"
                >
                    <Icon name="trash" class="w-4 h-4"/>
                </button>
            {:else}
                 <button
                    on:click={sendAiRequest}
                    disabled={!userPrompt.trim()}
                    class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed h-10 self-end flex items-center justify-center shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 dark:focus:ring-offset-gray-900" 
                    title="Send Prompt (Ctrl+Enter)"
                    aria-label="Send Prompt"
                 >
                    Send
                 </button>
            {/if}
        </div>
    </div> <!-- End Input Area -->

</div> <!-- End AI Chat Container -->

<!-- Component Styles -->
<style>
  /* Basic message container styling */
  .message {
      /* Add any container styles if needed */
  }

  /* Style for rendered markdown elements inside .prose container */
  /* Targeting elements generated by 'marked' using :global() */

  /* Code Blocks */
  .prose :global(pre) {
      background-color: #f3f4f6; /* Equiv: bg-gray-100 */
      color: #1f2937; /* Equiv: text-gray-800 (adjust for light/dark if needed below) */
      padding: 0.75rem; /* Equiv: p-3 */
      border-radius: 0.375rem; /* Equiv: rounded-md */
      overflow-x: auto; /* Equiv: overflow-x-auto */
      font-size: 0.75rem; /* Equiv: text-xs */
      line-height: 1rem; /* Equiv: text-xs line height */
      box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05); /* Equiv: shadow-inner */
      /* font-size: 0.875em; /* Alternative relative sizing */
  }

  /* Inline Code */
  .prose :global(code):not(:global(pre code)) {
      background-color: #e5e7eb; /* Equiv: bg-gray-200 */
      padding-left: 0.25rem; /* Equiv: px-1 (approx) */
      padding-right: 0.25rem;
      padding-top: 0.125rem; /* Equiv: py-0.5 (approx) */
      padding-bottom: 0.125rem;
      border-radius: 0.25rem; /* Equiv: rounded */
      font-size: 0.875em; /* Use relative size */
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; /* Equiv: font-mono */
      color: #1f2937; /* Default text color */
  }

  /* Paragraphs */
  .prose :global(p) {
      margin-top: 0.5rem; /* Equiv: my-2 */
      margin-bottom: 0.5rem;
  }

  /* Lists */
  .prose :global(ul),
  .prose :global(ol) {
      margin-top: 0.5rem; /* Equiv: my-2 */
      margin-bottom: 0.5rem;
      padding-left: 1.5rem; /* Equiv: pl-6 */
      list-style-position: outside; /* Ensure bullets/numbers are outside */
  }
   .prose :global(ul) {
       list-style-type: disc;
   }
    .prose :global(ol) {
       list-style-type: decimal;
   }


  /* List Items */
  .prose :global(li) {
      margin-top: 0.25rem; /* Equiv: my-1 */
      margin-bottom: 0.25rem;
  }
  /* Ensure nested lists have appropriate margin */
   .prose :global(li > ul),
   .prose :global(li > ol) {
       margin-top: 0.25rem;
       margin-bottom: 0.25rem;
   }


  /* Headings */
  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3),
  .prose :global(h4),
  .prose :global(h5),
  .prose :global(h6) {
      margin-top: 0.75rem; /* Equiv: my-3 */
      margin-bottom: 0.75rem;
      font-weight: 600; /* Equiv: font-semibold */
  }
   /* Optional: Add default heading sizes if not using Typography plugin */
   .prose :global(h1) { font-size: 1.5rem; /* text-2xl */ line-height: 2rem; }
   .prose :global(h2) { font-size: 1.25rem; /* text-xl */ line-height: 1.75rem; }
   .prose :global(h3) { font-size: 1.125rem; /* text-lg */ line-height: 1.75rem; }
   /* etc. for h4, h5, h6 */


  /* Dark Mode Styles - Assumes Tailwind adds 'dark' class to <html> */
  :global(html.dark) .prose :global(pre) {
      background-color: #111827; /* Equiv: dark:bg-gray-900 */
      color: #e5e7eb; /* Equiv: dark:text-gray-200 */
  }
  :global(html.dark) .prose :global(code):not(:global(pre code)) {
      background-color: #4b5563; /* Equiv: dark:bg-gray-600 */
      color: #e5e7eb; /* Equiv: dark:text-gray-200 */
  }
  /* Ensure prose text color is appropriate in dark mode */
  :global(html.dark) .prose {
      color: #d1d5db; /* Equiv: dark:prose-invert base color (text-gray-300) */
  }
   /* Adjust link colors etc. for dark mode if needed */
   :global(html.dark) .prose :global(a) {
      color: #93c5fd; /* Example blue */
   }


  /* Ensure select dropdown text doesn't overflow its container */
  select {
      text-overflow: ellipsis;
  }

  /* Simple pulse animation for loading dots */
  @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
  }
  .animate-pulse {
      /* Note: Using a class name like this might conflict if you also use Tailwind's pulse utility */
      animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  /* Delay animations for staggered effect */
  .animation-delay-150 { animation-delay: 0.15s; }
  .animation-delay-300 { animation-delay: 0.3s; }


  /* Style for the dynamically added copy button */
    /* We target the class added in the script */
    :global(.code-copy-button) {
        position: absolute;
        top: 0.3rem;
        right: 0.3rem;
        padding: 0.1rem 0.4rem;
        font-size: 0.7rem;
        background-color: #6b7280; /* Tailwind gray-500 */
        color: white;
        border: none;
        border-radius: 0.25rem; /* rounded-md */
        cursor: pointer;
        opacity: 0; /* Hide initially */
        transition: opacity 0.2s ease-in-out, background-color 0.2s ease-in-out;
        z-index: 10; /* Ensure it's above code highlighting */
    }

    /* Show button on hover of the parent <pre> element */
    :global(pre:hover .code-copy-button) {
        opacity: 0.7;
    }
     /* Full opacity on button hover */
    :global(.code-copy-button:hover) {
         opacity: 1;
         background-color: #4b5563; /* gray-600 */
    }

    /* Ensure the <pre> tag can contain the absolutely positioned button */
    /* This might already be handled by prose styles, but good to ensure */
    .prose :global(pre) {
        position: relative; /* Needed for absolute positioning of children */
         /* Add some padding top/right if button overlaps code too much */
         /* padding-top: 1.8rem; */
    }

</style>