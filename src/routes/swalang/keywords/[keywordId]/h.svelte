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
                <span class="font-bold text-sm text-gray-700 dark:text-gray-300" title="Net votes">{suggestion.total_votes}</span>
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
                Submitted by {suggestion.submitter_username || 'User'}
                on {new Date(suggestion.created_at).toLocaleDateString()}
                {#if suggestion.is_approved}
                  <span class="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 rounded-full text-[0.6rem] font-medium">Approved</span>
                {/if}
              </p>
            </div>
          </div>
        {/each}