<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';

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
</script>

<div class="container mx-auto p-4 md:p-8">
	<!-- Breadcrumb -->
	<div class="mb-4">
		<a href="/swalang" class="text-blue-600 dark:text-blue-400 hover:underline text-sm">← Back to Categories</a>
	</div>

	{#if data.category}
		<!-- Category Header -->
		<div class="mb-6 pb-4 border-b border-gray-300 dark:border-gray-700">
			<h1 class="text-3xl font-bold text-gray-800 dark:text-gray-200">{data.category.name}</h1>
			{#if data.category.description}
				<p class="mt-2 text-md text-gray-600 dark:text-gray-400">{data.category.description}</p>
			{/if}
		</div>

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
				{:else}
					<div class="space-y-3" id="keywords-list">
						{#each data.keywords as keyword (keyword.id)}
							<a
								href={`/swalang/keywords/${keyword.id}`}
								class="block p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
							>
								<h3 class="text-md font-medium text-gray-900 dark:text-gray-100 mb-1">
									{keyword.english_keyword}
								</h3>
								{#if keyword.description}
									<p class="text-sm text-gray-500 dark:text-gray-400">
										{keyword.description}
									</p>
								{/if}
							</a>
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
