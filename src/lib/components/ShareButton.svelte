<!-- <script lang="ts">
    import { createFileShare } from '$lib/services/fileSystemService';
    import type { PageData } from '../../routes/app/$types';
	  import Icon from './Icon.svelte';
  
    export let fileData = {}
    export let parentData: PageData
  
    let generatedLink = ''
    let isLoadingShare = false
    let showModal = false
  
    async function generateShareLink(fileId: string) {
      isLoadingShare = true;
      const { data, error } = await createFileShare(parentData.supabase, fileId);
      if (error) {
        generatedLink = '';
        showModal = false;
      } else if (data) {
        generatedLink = `${window.location.origin}/share/${data.share_token}`;
        showModal = true;
      }
      isLoadingShare = false;
    }
  
    function closeModal() {
      showModal = false;
      generatedLink = '';
    }
  </script>
  
  <!-- Trigger Button --
  <!-- <button
    on:click={() => generateShareLink(fileData?.id)}
    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex"
    disabled={isLoadingShare}
  >
    <Icon name='share' class="w-4 h-4 text-blue-500"/>
    {isLoadingShare ? 'Generating...' : 'Share'}
  </button> --
  <button title="Share the code" on:click|stopPropagation={() => generateShareLink(fileData?.id)} disabled={isLoadingShare} class="hover:text-green-600 p-0.5 hover:text-red-600 disabled:opacity-50"><Icon name="share" /></button>
  
  <!-- Modal --
  {#if showModal}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
        <h2 class="text-lg font-semibold mb-4">Share Link</h2>
        <input
          type="text"
          readonly
          bind:value={generatedLink}
          class="w-full px-3 py-2 border border-gray-300 rounded bg-gray-100 text-sm mb-4"
        />
        <div class="flex justify-end gap-2">
          <button
            on:click={() => navigator.clipboard.writeText(generatedLink)}
            class="px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded text-sm"
          >
            Copy
          </button>
          <button
            on:click={closeModal}
            class="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if} -->
  


  <!-- src/lib/components/ShareModal.svelte -->
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { createFileShare } from '$lib/services/fileSystemService';
  import type { FileNode } from '$lib/services/fileSystemService';
  import type { SupabaseClient } from '@supabase/supabase-js';
  import Icon from './Icon.svelte';

  // --- Props ---
  /** The file/folder data to be shared */
  export let file: FileNode;
  /** Authenticated Supabase client of the file owner */
  export let supabaseClient: SupabaseClient;
  /** Prop to control modal visibility from parent */
  export let show: boolean = false;

  // --- State ---
  let shareTitle: string = file?.name; // Default share title to file name
  let generatedLink: string = '';
  let isLoadingShare: boolean = false;
  let errorMessage: string | null = null;
  let expiryDate: string = ''; // For optional expiry input

  const dispatch = createEventDispatcher<{
    close: void;
    shareCreated: { link: string; title: string }; // Optional: dispatch details
  }>();

  async function generateAndShare() {
    if (!file?.id) {
        errorMessage = "Invalid file selected.";
        return;
    }
    isLoadingShare = true;
    errorMessage = null;
    generatedLink = '';

    let expiry: Date | null = null;
    if (expiryDate) {
        try {
            expiry = new Date(expiryDate);
            if (isNaN(expiry.getTime()) || expiry < new Date()) {
                errorMessage = "Invalid or past expiry date.";
                isLoadingShare = false;
                return;
            }
        } catch {
            errorMessage = "Invalid expiry date format.";
            isLoadingShare = false;
            return;
        }
    }

    const { data, error } = await createFileShare(
        supabaseClient,
        file.id,
        shareTitle.trim() || null, // Send null if title is empty
        expiry
    );

    if (error) {
      errorMessage = error.message || "Failed to generate share link.";
      console.error("Share error:", error);
    } else if (data) {
      generatedLink = `${window.location.origin}/share/${data.share_token}`;
      dispatch('shareCreated', { link: generatedLink, title: data.title || file.name });
      // Keep modal open to show the link
    }
    isLoadingShare = false;
  }

  function copyLink() {
      if (!generatedLink) return;
      navigator.clipboard.writeText(generatedLink)
          .then(() => {
              // Optional: Add "Copied!" feedback
              const copyButton = document.getElementById('copy-share-link-button');
              if (copyButton) {
                  copyButton.textContent = 'Copied!';
                  setTimeout(() => { copyButton.textContent = 'Copy Link'; }, 1500);
              }
          })
          .catch(err => console.error('Failed to copy share link:', err));
  }

  function closeModalAndReset() {
    generatedLink = '';
    errorMessage = null;
    // Reset title to file name for next time, or keep it as is?
    shareTitle = file.name;
    expiryDate = '';
    show = false;
    dispatch('close');
  }

  // Initialize shareTitle when file prop changes or on mount
  $: if (file && !isLoadingShare && !generatedLink) shareTitle = file.name;

</script>


<button title="Share the code" on:click|stopPropagation={() => show = true } disabled={isLoadingShare} class="hover:text-green-600 p-0.5 hover:text-red-600 disabled:opacity-50"><Icon name="share" /></button>
  
{#if show}
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" on:click|self={closeModalAndReset}>
  <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-md relative" on:click|stopPropagation>
    <button
        on:click={closeModalAndReset}
        class="absolute top-3 right-3 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Close share modal"
    >×</button>

    <h2 class="text-lg font-semibold mb-4 dark:text-white">Share "{file.name}"</h2>

    {#if errorMessage}
        <p class="text-sm text-red-600 dark:text-red-400 mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">{errorMessage}</p>
    {/if}

    {#if generatedLink}
        <!-- Display Generated Link -->
        <div class="mb-4">
            <p class="text-sm text-gray-700 dark:text-gray-300 mb-1">Shareable Link:</p>
            <input
              type="text"
              readonly
              bind:value={generatedLink}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-sm dark:text-gray-200"
              on:focus={(e) => e.currentTarget.select()}
            />
        </div>
        <div class="flex justify-end gap-2">
          <button
            id="copy-share-link-button"
            on:click={copyLink}
            class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Copy Link
          </button>
          <button
            on:click={closeModalAndReset}
            class="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 rounded text-sm"
          >
            Done
          </button>
        </div>
    {:else}
        <!-- Form to Enter Title & Generate Link -->
        <form on:submit|preventDefault={generateAndShare} class="space-y-4">
            <div>
                <label for="share-title" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Share Title (Optional)
                </label>
                <input
                    type="text"
                    id="share-title"
                    bind:value={shareTitle}
                    maxlength="250"
                    placeholder="e.g., My Project Draft"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
                 <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">A title for this specific share link.</p>
            </div>

            <!-- Optional: Expiry Date Input -->
            <div>
                <label for="share-expiry" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expires At (Optional)
                </label>
                 <input
                    type="datetime-local"
                    id="share-expiry"
                    bind:value={expiryDate}
                    min={new Date(new Date().getTime() + 60000).toISOString().slice(0, 16)}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            <div class="flex justify-end gap-2 pt-2">
                <button
                    type="button"
                    on:click={closeModalAndReset}
                    class="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200 rounded text-sm"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm disabled:opacity-50"
                    disabled={isLoadingShare}
                >
                    {#if isLoadingShare} <Icon name="loading" class="w-4 h-4 mr-1 inline-block"/> Generating... {:else} Generate Link {/if}
                </button>
            </div>
        </form>
    {/if}
  </div>
</div>
{/if}