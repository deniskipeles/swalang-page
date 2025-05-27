<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import Icon from '$lib/components/Icon.svelte';
	import type { Database } from '$lib/types/database.types';
	import { invalidateAll } from '$app/navigation';

	export let data: PageData;
	export let form: ActionData; // Now receives data for both create and update

	let isSubmitting = false;

	function handleFormUpdate({ formElement }: { formElement: HTMLFormElement }) {
		isSubmitting = true;
		return async ({ result, update }) => {
			if (result.type === 'success') {
				formElement.reset();
			}
			isSubmitting = false;
			await update();
		};
	}



	let editingCategoryId: string | null = null;
    let editName = '';
    let editDescription = '';
    let isSubmittingUpdate = false;

    function startEdit(category: Database['public']['Tables']['collaborate_swalang_categories']['Row']) {
        editingCategoryId = category.id;
        editName = category.name;
        editDescription = category.description || '';
        // Clear any previous create form errors/success
        if (form?.formId === 'createCategory') form = undefined;
    }

    function cancelEdit() {
        editingCategoryId = null;
    }

    // Separate enhance for update form
    function handleUpdateForm() {
        isSubmittingUpdate = true;
        return async ({ result, update }: { result: any, update: any}) => {
			if (result.type === 'success' && result.status === 200 && result.data?.formId === 'updateCategory') {
				editingCategoryId = null; // Close edit form
				await invalidateAll();
			}
            isSubmittingUpdate = false;
            await update();
        };
    }
</script>

<div class="container mx-auto p-4 md:p-8">
	<h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Swahili Keywords Collaboration</h1>

	{#if !data.session}
		<div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-6" role="alert">
			<p class="font-bold">Authentication Required</p>
			<p>
				Please
				<a href="/auth/login?redirectTo=/swalang" class="underline font-medium">log in</a>
				to view and contribute.
			</p>
		</div>
	{/if}

	{#if data.error && data.session}
		<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
			<p class="font-bold">Error Loading Categories</p>
			<p>{data.error}</p>
		</div>
	{/if}
	{#if data.error}
		<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6" role="alert">
			<p class="font-bold">Error Loading Categories</p>
			<p>{data.error}</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<!-- Category List -->
		<div class="md:col-span-2">
			<h2 class="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Categories</h2>
			{#if data.categories.length === 0 && !data.error && data.session}
				<p class="text-gray-500 dark:text-gray-400 italic">
					No categories found. Add one using the form!
				</p>
				{:else if data.categories.length > 0}
				<div class="space-y-4">
					{#each data.categories as category (category.id)}
						{#if editingCategoryId === category.id}
							<!-- Edit Form for This Category -->
							<form method="POST" action={`/swalang/categories/${category.id}/?/updateCategoryDetails`} use:enhance={handleUpdateForm} class="p-4 bg-yellow-50 dark:bg-gray-700 rounded-lg shadow border border-yellow-300 dark:border-yellow-600 space-y-3">
								<!-- <input type="hidden" name="id" value={category.id} /> -->
								{#if form?.error && form?.formId === 'updateCategory' && form?.id === category.id}<p class="error-box">{form.error}</p>{/if}
								<div>
									<label for={`edit-name-${category.id}`} class="label-style">Name *</label>
									<input type="text" name="name" id={`edit-name-${category.id}`} bind:value={editName} required class="input-style" />
									{#if form?.errors?.name && form?.formId === 'updateCategory' && form?.id === category.id}<p class="error-text">{form.errors.name[0]}</p>{/if}
								</div>
								<div>
									<label for={`edit-desc-${category.id}`} class="label-style">Description</label>
									<textarea name="description" id={`edit-desc-${category.id}`} bind:value={editDescription} rows="2" class="input-style resize-none"></textarea>
									{#if form?.errors?.description && form?.formId === 'updateCategory' && form?.id === category.id}<p class="error-text">{form.errors.description[0]}</p>{/if}
								</div>
								<div class="flex justify-end space-x-2">
									<button type="button" on:click={cancelEdit} class="button-secondary-sm">Cancel</button>
									<button type="submit" disabled={isSubmittingUpdate} class="button-primary-sm">
										{#if isSubmittingUpdate}Saving...{:else}Save Changes{/if}
									</button>
								</div>
							</form>
						{:else}
							<!-- Display Category with Edit Button -->
							<div class="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700 group relative">
								<a href={`/swalang/categories/${category.id}`}>
									<h3 class="text-lg font-medium text-blue-600 dark:text-blue-400 mb-1">{category.name}</h3>
									<p class="text-sm text-gray-600 dark:text-gray-400">{category.description || 'No description provided.'}</p>
								</a>
								{#if data.session?.user?.id === category.created_by} <!-- Basic permission check -->
									<button on:click={() => startEdit(category)} title="Edit Category" class="absolute top-2 right-2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700  group-hover:opacity-100 focus:opacity-100 transition-opacity">
										<Icon name="edit" class="w-4 h-4 text-gray-500 dark:text-gray-400" />
									</button>
								{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Add Category Form -->
		{#if data.session}
			<div class="md:col-span-1">
				<h2 class="text-2xl font-semibold mb-4 text-gray-700 dark:text-gray-300">
					Add New Category
				</h2>
				<form
					method="POST"
					action="?/createCategory"
					use:enhance={handleFormUpdate}
					class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4"
				>
					{#if data.form?.error}
						<p
							class="text-sm text-red-600 dark:text-red-400 mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded"
						>
							{data.form.error}
						</p>
					{/if}
					{#if data.form?.success}
						<p
							class="text-sm text-green-600 dark:text-green-400 mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded"
						>
							Category created successfully!
						</p>
					{/if}

					<div>
						<label
							for="category-name"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Category Name <span class="text-red-500">*</span>
						</label>
						<input
							type="text"
							id="category-name"
							name="name"
							required
							maxlength="100"
							value={data.form?.name || ''}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
							aria-describedby="name-error"
						/>
						{#if data.form?.errors?.name}
							<p id="name-error" class="mt-1 text-xs text-red-600 dark:text-red-400">
								{data.form.errors.name[0]}
							</p>
						{/if}
					</div>

					<div>
						<label
							for="category-description"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Description (Optional)
						</label>
						<textarea
							id="category-description"
							name="description"
							rows="3"
							maxlength="500"
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
							aria-describedby="description-error"
						>{data.form?.description || ''}</textarea>
						{#if data.form?.errors?.description}
							<p id="description-error" class="mt-1 text-xs text-red-600 dark:text-red-400">
								{data.form.errors.description[0]}
							</p>
						{/if}
					</div>

					<div>
						<button
							type="submit"
							disabled={isSubmitting}
							class="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:focus:ring-offset-gray-800"
						>
							{#if isSubmitting}
								<Icon name="loading" class="w-4 h-4 mr-2" /> Submitting...
							{:else}
								Create Category
							{/if}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>



	
