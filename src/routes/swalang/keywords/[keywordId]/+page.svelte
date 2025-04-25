<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import Icon from '$lib/components/Icon.svelte';
    import { invalidateAll } from '$app/navigation';
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';
    import { tick } from 'svelte';
  
    export let data: PageData;
    export let form: ActionData;
  
    let isSubmittingSuggestion = false;
    let suggestionFormElement: HTMLFormElement;
  
    let optimisticSuggestions = data.suggestions;
    $: optimisticSuggestions = data.suggestions;
  
    async function renderMarkdown(markdown: string | null | undefined): Promise<string> {
      if (!markdown) return '';
      try {
        const rawHtml = await marked.parse(markdown, { async: true, gfm: true, breaks: true });
        return DOMPurify.sanitize(rawHtml);
      } catch (error) {
        console.error("Markdown rendering/sanitization failed:", error);
        const preElement = document.createElement('pre');
        preElement.textContent = markdown;
        return preElement.outerHTML;
      }
    }
  
    function handleSuggestionFormUpdate() {
      isSubmittingSuggestion = true;
      return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
        if (result.type === 'success' && result.status === 200) {
          suggestionFormElement?.reset();
          await invalidateAll();
        }
        isSubmittingSuggestion = false;
        await update();
      };
    }
  
    function handleVoteClick(suggestionId: string, newVote: -1 | 1 | 0) {
      const index = optimisticSuggestions.findIndex(s => s.id === suggestionId);
      if (index === -1) return;
  
      const currentSuggestion = optimisticSuggestions[index];
      const currentVote = currentSuggestion.user_vote;
      const currentScore = currentSuggestion.votes;
  
      const actualNewVote = (newVote === currentVote) ? 0 : newVote;
  
      let optimisticScore = currentScore;
      if (actualNewVote === 1) {
        optimisticScore = currentVote === 1 ? currentScore : (currentVote === -1 ? currentScore + 2 : currentScore + 1);
      } else if (actualNewVote === -1) {
        optimisticScore = currentVote === -1 ? currentScore : (currentVote === 1 ? currentScore - 2 : currentScore - 1);
      } else {
        optimisticScore = currentVote === 1 ? currentScore - 1 : (currentVote === -1 ? currentScore + 1 : currentScore);
      }
  
      optimisticSuggestions = [
        ...optimisticSuggestions.slice(0, index),
        { ...currentSuggestion, user_vote: actualNewVote, votes: optimisticScore },
        ...optimisticSuggestions.slice(index + 1)
      ];
    }
  </script>
  
  
  <div class="container mx-auto p-4 md:p-8">
    <!-- Breadcrumbs -->
    <div class="mb-4 text-sm">
      <a href="/swalang" class="text-blue-600 dark:text-blue-400 hover:underline">Categories</a>
      {#if data.keyword?.category_id && data.keyword?.category_name}
        <span class="mx-1 text-gray-400">/</span>
        <a href={`/swalang/categories/${data.keyword.category_id}`} class="text-blue-600 dark:text-blue-400 hover:underline">{data.keyword.category_name}</a>
      {/if}
      <span class="mx-1 text-gray-400">/</span>
      <span class="text-gray-600 dark:text-gray-300">Keyword</span>
    </div>
  
    {#if data.keyword}
      <!-- Keyword Header -->
      <div class="mb-6 pb-4 border-b border-gray-300 dark:border-gray-700">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">{data.keyword.english_keyword}</h1>
        {#if data.keyword.description}
          <p class="mt-2 text-md text-gray-600 dark:text-gray-400">{data.keyword.description}</p>
        {/if}
      </div>
  
      <h2 class="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Suggestions</h2>
  
      {#if data.suggestionsError}
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
          <p class="font-bold">Error Loading Suggestions</p>
          <p>{data.suggestionsError}</p>
        </div>
      {/if}
  
      <!-- Suggestions List -->
      <div class="space-y-4 mb-8">
        {#if optimisticSuggestions.length === 0 && !data.suggestionsError}
          <p class="text-gray-500 dark:text-gray-400 italic">No suggestions yet. Be the first!</p>
        {/if}
  
        {#each optimisticSuggestions as suggestion (suggestion.id)}
          <div class="suggestion-card bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex space-x-4 items-start">
            <!-- Vote Controls -->
            {#if data.session}
              <form method="POST" action="?/castVote" class="flex flex-col items-center flex-shrink-0 space-y-1">
                <input type="hidden" name="suggestionId" value={suggestion.id} />
                <!-- Upvote -->
                <button
                  type="submit"
                  name="voteValue"
                  value="1"
                  class="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  class:text-green-600={suggestion.user_vote === 1}
                  class:dark:text-green-400={suggestion.user_vote === 1}
                  class:text-gray-400={suggestion.user_vote !== 1}
                  class:dark:text-gray-500={suggestion.user_vote !== 1}
                  title="Upvote"
                  aria-label="Upvote suggestion"
                  on:click|preventDefault={() => handleVoteClick(suggestion.id, 1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.99 9.47a.75.75 0 0 1-1.06-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1-1.06 1.06L10.75 5.612V16.25A.75.75 0 0 1 10 17Z" clip-rule="evenodd"/>
                  </svg>
                </button>
                <span class="font-bold text-sm text-gray-700 dark:text-gray-300" title="Net votes">{suggestion.votes}</span>
                <!-- Downvote -->
                <button
                  type="submit"
                  name="voteValue"
                  value="-1"
                  class="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  class:text-red-600={suggestion.user_vote === -1}
                  class:dark:text-red-400={suggestion.user_vote === -1}
                  class:text-gray-400={suggestion.user_vote !== -1}
                  class:dark:text-gray-500={suggestion.user_vote !== -1}
                  title="Downvote"
                  aria-label="Downvote suggestion"
                  on:click|preventDefault={() => handleVoteClick(suggestion.id, -1)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.26-3.868a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.53 11.638a.75.75 0 1 1 1.06-1.06l3.26 3.868V3.75A.75.75 0 0 1 10 3Z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </form>
            {/if}
  
            <!-- Suggestion Content -->
            <div class="flex-grow min-w-0">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{suggestion.swahili_word}</h3>
              {#if suggestion.description}
                <div class="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400">
                  {#await renderMarkdown(suggestion.description)}
                    <p class="opacity-50">...</p>
                  {:then html}
                    {@html html}
                  {:catch}
                    <pre>{suggestion.description}</pre>
                  {/await}
                </div>
              {/if}
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-2">
                Submitted by {suggestion.submitter_email || 'User'}
                on {new Date(suggestion.created_at).toLocaleDateString()}
                {#if suggestion.is_approved}
                  <span class="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full text-[0.6rem] font-medium">Approved</span>
                {/if}
              </p>
            </div>
          </div>
        {/each}
      </div>
  
      <!-- Add Suggestion Form -->
      {#if data.session}
        <div class="pt-6 border-t border-gray-300 dark:border-gray-700">
          <h2 class="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Suggest a Translation</h2>
          <form
            bind:this={suggestionFormElement}
            method="POST"
            action="?/createSuggestion"
            use:enhance={handleSuggestionFormUpdate}
            class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4"
          >
            {#if form?.error && form?.formId === 'suggestion'}
              <p class="text-sm text-red-600 dark:text-red-400 mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">
                {form.error}
              </p>
            {/if}
  
            <div>
              <label for="suggestion-swahili" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Swahili Word / Phrase <span class="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="suggestion-swahili"
                name="swahili_word"
                required
                maxlength="200"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                aria-describedby="swahili-error"
                value={form?.formId === 'suggestion' ? form.swahili_word : ''}
              />
              {#if form?.errors?.swahili_word && form?.formId === 'suggestion'}
                <p id="swahili-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.swahili_word[0]}</p>
              {/if}
            </div>
  
            <div>
              <label for="suggestion-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description / Context (Optional, Markdown Supported)
              </label>
              <textarea
                id="suggestion-description"
                name="description"
                rows="4"
                maxlength="1500"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-y"
                aria-describedby="sugg-description-error"
                value={form?.formId === 'suggestion' ? form.description : ''}
              ></textarea>
              {#if form?.errors?.description && form?.formId === 'suggestion'}
                <p id="sugg-description-error" class="mt-1 text-xs text-red-600 dark:text-red-400">{form.errors.description[0]}</p>
              {/if}
            </div>
  
            <div>
              <button
                type="submit"
                disabled={isSubmittingSuggestion}
                class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
              >
                {#if isSubmittingSuggestion}
                  <Icon name="loading" class="w-4 h-4 mr-2" /> Submitting...
                {:else}
                  Submit Suggestion
                {/if}
              </button>
            </div>
          </form>
        </div>
      {/if}
    {:else}
      <p class="text-red-600 dark:text-red-400">Could not load keyword details.</p>
    {/if}
  </div>
  
  
  <style>
      /* Reuse styles from AIChat or define globally */
      /* ... (prose styles for markdown: pre, code, p, etc.) ... */
      /* ... pulse animation ... */
  </style>