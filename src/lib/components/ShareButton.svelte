<script lang="ts">
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
  
  <!-- Trigger Button -->
  <!-- <button
    on:click={() => generateShareLink(fileData?.id)}
    class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed flex"
    disabled={isLoadingShare}
  >
    <Icon name='share' class="w-4 h-4 text-blue-500"/>
    {isLoadingShare ? 'Generating...' : 'Share'}
  </button> -->
  <button title="Share the code" on:click|stopPropagation={() => generateShareLink(fileData?.id)} disabled={isLoadingShare} class="hover:text-green-600 p-0.5 hover:text-red-600 disabled:opacity-50"><Icon name="share" /></button>
  
  <!-- Modal -->
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
  {/if}
  