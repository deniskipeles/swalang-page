<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import { invalidateAll } from '$app/navigation';

	export let data: PageData;

	let isSubmittingKeyword = false;

	function handleKeywordFormUpdate({ formElement }: { formElement: HTMLFormElement }) {
		isSubmittingKeyword = true;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				formElement.reset();
			}
			isSubmittingKeyword = false;
			await update();
		};
	}

	export let form: ActionData; // For all forms on this page

  // --- Category Edit State ---
  let isEditingCategory = false;
  let editCategoryName = data.category?.name || '';
  let editCategoryDescription = data.category?.description || '';
  let isSubmittingCategoryUpdate = false;

  // --- Keyword Add/Edit State ---
//   let isSubmittingKeyword = false; // For new keywords
  let editingKeywordId: string | null = null; // ID of keyword being edited
  let editKeywordEnglish = '';
  let editKeywordDescription = '';
  let isSubmittingKeywordUpdate = false; // For existing keywords


  // --- Category Edit Functions ---
  function startEditCategory() {
    if (!data.category) return;
    editCategoryName = data.category.name;
    editCategoryDescription = data.category.description || '';
    isEditingCategory = true;
  }
  function cancelEditCategory() {
    isEditingCategory = false;
    // Reset form values to original if needed, or let 'form' prop handle it if error
  }
  function handleCategoryUpdateForm() {
    isSubmittingCategoryUpdate = true;
    return async ({ result, update }: { result: any, update: any}) => {
      if (result.type === 'success' && result.status === 200 && result.data?.formId === 'updateCategory') {
        isEditingCategory = false; // Close edit form
        await invalidateAll(); // Refresh all data on the page
      }
      isSubmittingCategoryUpdate = false;
      await update();
    };
  }

  // --- Keyword Add Form Functions ---
  function handleKeywordAddForm({ formElement }: { formElement: HTMLFormElement }) {
    isSubmittingKeyword = true;
    return async ({ result, update }: { result: any, update: any}) => {
      if (result.type === 'success' && result.status === 200 && result.data?.formId !== 'updateKeyword') { // Ensure it's not updateKeyword success
        formElement.reset();
        await invalidateAll();
      }
      isSubmittingKeyword = false;
      await update();
    };
  }

  // --- Keyword Edit Functions ---
  function startEditKeyword(keyword: typeof data.keywords[0]) {
    editingKeywordId = keyword.id;
    editKeywordEnglish = keyword.english_keyword;
    editKeywordDescription = keyword.description || '';
  }
  function cancelEditKeyword() {
    editingKeywordId = null;
  }
  function handleKeywordUpdateForm() {
    isSubmittingKeywordUpdate = true;
    return async ({ result, update }: { result: any, update: any}) => {
      if (result.type === 'success' && result.status === 200 && result.data?.formId === 'updateKeyword') {
        editingKeywordId = null; // Close edit form
        await invalidateAll();
      }
      isSubmittingKeywordUpdate = false;
      await update();
    };
  }

  // Permission check helper (basic, assumes creator can edit)
  function canEdit(itemCreatorId: string | null | undefined): boolean {
      return !!data.session && data.session.user?.id === itemCreatorId;
  }
</script>

<div class="container mx-auto p-4 md:p-8">
	<!-- Breadcrumb -->
	<div class="mb-4">
		<a href="/swalang" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Categories</a>
	</div>

	{#if data.category}
		<!-- Category Header & Edit Form -->
        <div class="mb-6 pb-4 border-b border-gray-300 dark:border-gray-700">
            {#if isEditingCategory && canEdit(data.category.created_by)}
                <form method="POST" action="?/updateCategoryDetails" use:enhance={handleCategoryUpdateForm} class="space-y-3 p-3 bg-yellow-50 dark:bg-gray-700/50 rounded-md">
                    <input type="hidden" name="id" value={data.category.id} />
                    {#if form?.error && form?.formId === 'updateCategory'}<p class="error-box">{form.error}</p>{/if}
                    <div>
                        <label for="edit-cat-name" class="label-style">Category Name *</label>
                        <input type="text" name="name" id="edit-cat-name" bind:value={editCategoryName} required class="input-style w-full" />
                        {#if form?.errors?.name && form?.formId === 'updateCategory'}<p class="error-text">{form.errors.name[0]}</p>{/if}
                    </div>
                    <div>
                        <label for="edit-cat-desc" class="label-style">Description</label>
                        <textarea name="description" id="edit-cat-desc" bind:value={editCategoryDescription} rows="2" class="input-style w-full resize-none"></textarea>
                         {#if form?.errors?.description && form?.formId === 'updateCategory'}<p class="error-text">{form.errors.description[0]}</p>{/if}
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" on:click={cancelEditCategory} class="button-secondary-sm">Cancel</button>
                        <button type="submit" disabled={isSubmittingCategoryUpdate} class="button-primary-sm">
                            {isSubmittingCategoryUpdate ? 'Saving...' : 'Save Category'}
                        </button>
                    </div>
                </form>
            {:else}
                <div class="flex justify-between items-start">
                    <div>
                        <h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">{data.category.name}</h1>
                        {#if data.category.description}
                            <p class="mt-2 text-md text-gray-600 dark:text-gray-400">{data.category.description}</p>
                        {/if}
                    </div>
                    {#if canEdit(data.category.created_by)}
                        <button on:click={startEditCategory} title="Edit Category Details" class="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0">
                            <Icon name="edit" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                    {/if}
                </div>
            {/if}
        </div>


		<!-- =================================== -->

		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<!-- Keywords List -->
			<div class="md:col-span-2">
				<h2 class="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Keywords</h2>

				{#if data.keywordsError}
					<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4" role="alert">
						<p class="font-bold">Error Loading Keywords</p>
						<p>{data.keywordsError}</p>
					</div>
				{/if}

				{#if data.keywords.length === 0 && !data.keywordsError}
					<p class="text-gray-500 dark:text-gray-400 italic">No keywords found in this category yet. Add one!</p>
				{:else if data.keywords.length > 0}
                    <div class="space-y-3" id="keywords-list">
                        {#each data.keywords as keyword (keyword.id)}
                            {#if editingKeywordId === keyword.id && canEdit(keyword.created_by)}
                                <!-- Edit Keyword Form -->
                                <form method="POST" action="?/updateKeyword" use:enhance={handleKeywordUpdateForm} class="p-3 bg-yellow-50 dark:bg-gray-700/50 rounded-lg shadow-sm border border-yellow-300 dark:border-yellow-600 space-y-2">
                                    <input type="hidden" name="keywordId" value={keyword.id} />
                                    {#if form?.error && form?.formId === 'updateKeyword' && form?.keywordId === keyword.id}<p class="error-box">{form.error}</p>{/if}
                                    <div>
                                        <label for={`edit-kw-eng-${keyword.id}`} class="label-style text-xs">English Keyword *</label>
                                        <input type="text" name="english_keyword" id={`edit-kw-eng-${keyword.id}`} bind:value={editKeywordEnglish} required class="input-style w-full text-sm" />
                                        {#if form?.errors?.english_keyword && form?.formId === 'updateKeyword' && form?.keywordId === keyword.id}<p class="error-text">{form.errors.english_keyword[0]}</p>{/if}
                                    </div>
                                    <div>
                                        <label for={`edit-kw-desc-${keyword.id}`} class="label-style text-xs">Description</label>
                                        <textarea name="description" id={`edit-kw-desc-${keyword.id}`} bind:value={editKeywordDescription} rows="2" class="input-style w-full resize-none text-sm"></textarea>
                                         {#if form?.errors?.description && form?.formId === 'updateKeyword' && form?.keywordId === keyword.id}<p class="error-text">{form.errors.description[0]}</p>{/if}
                                    </div>
                                    <div class="flex justify-end space-x-2">
                                        <button type="button" on:click={cancelEditKeyword} class="button-secondary-sm">Cancel</button>
                                        <button type="submit" disabled={isSubmittingKeywordUpdate} class="button-primary-sm">
                                            {isSubmittingKeywordUpdate ? 'Saving...' : 'Save Keyword'}
                                        </button>
                                    </div>
                                </form>
                            {:else}
                                <!-- Display Keyword with Edit Button -->
                                <div class="group relative block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700">
                                    <a href={`/swalang/keywords/${keyword.id}`}>
                                        <h3 class="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">{keyword.english_keyword}</h3>
                                        {#if keyword.description}<p class="text-sm text-gray-500 dark:text-gray-400">{keyword.description}</p>{/if}
                                    </a>
                                    {#if canEdit(keyword.created_by)}
                                        <button on:click={() => startEditKeyword(keyword)} title="Edit Keyword" class="absolute top-1.5 right-1.5 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                                            <Icon name="edit" class="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        {/each}
                    </div>
                {/if}
			</div>

			<!-- Keyword Form -->
			{#if data.session}
				<div class="md:col-span-1">
					<h2 class="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Add Keyword</h2>
					<form
						method="POST"
						action="?/createKeyword"
						use:enhance={handleKeywordFormUpdate}
						class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4"
					>
						{#if data.form?.error}
							<p class="text-sm text-red-600 dark:text-red-400 mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded">
								{data.form.error}
							</p>
						{/if}

						{#if data.form?.success}
							<p class="text-sm text-green-600 dark:text-green-400 mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded">
								Keyword added successfully!
							</p>
						{/if}

						<div>
							<label for="keyword-english" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								English Keyword <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="keyword-english"
								name="english_keyword"
								required
								maxlength="150"
								value={data.form?.english_keyword || ''}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
								aria-describedby="keyword-error"
							/>
							{#if data.form?.errors?.english_keyword}
								<p id="keyword-error" class="mt-1 text-xs text-red-600 dark:text-red-400">
									{data.form.errors.english_keyword[0]}
								</p>
							{/if}
						</div>

						<div>
							<label for="keyword-description" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
								Description (Optional)
							</label>
							<textarea
								id="keyword-description"
								name="description"
								rows="3"
								maxlength="1000"
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
								aria-describedby="kw-description-error"
							>{data.form?.description || ''}</textarea>
							{#if data.form?.errors?.description}
								<p id="kw-description-error" class="mt-1 text-xs text-red-600 dark:text-red-400">
									{data.form.errors.description[0]}
								</p>
							{/if}
						</div>

						<div>
							<button
								type="submit"
								disabled={isSubmittingKeyword}
								class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
							>
								{#if isSubmittingKeyword}
									<Icon name="loading" class="w-4 h-4 mr-2" /> Adding...
								{:else}
									Add Keyword
								{/if}
							</button>
						</div>
					</form>
				</div>
			{/if}
		</div>
	{:else}
		<!-- Fallback if category failed to load -->
		<p class="text-red-600 dark:text-red-400">Could not load category details.</p>
		<p class="text-sm text-gray-500">{data.error || 'Unknown error'}</p>
	{/if}
</div>


