<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { createFileShare } from '$lib/services/fileSystemService';
	import type { FileNode } from '$lib/services/fileSystemService';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import Icon from './Icon.svelte';

	// --- Props ---
	/** The file/folder data to be shared */
	export let file: FileNode;
	export let btnName = '';
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
			errorMessage = 'Invalid file selected.';
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
					errorMessage = 'Invalid or past expiry date.';
					isLoadingShare = false;
					return;
				}
			} catch {
				errorMessage = 'Invalid expiry date format.';
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
			errorMessage = error.message || 'Failed to generate share link.';
			console.error('Share error:', error);
		} else if (data) {
			generatedLink = `${window.location.origin}/share/${data.share_token}`;
			dispatch('shareCreated', { link: generatedLink, title: data.title || file.name });
			// Keep modal open to show the link
		}
		isLoadingShare = false;
	}

	function copyLink() {
		if (!generatedLink) return;
		navigator.clipboard
			.writeText(generatedLink)
			.then(() => {
				// Optional: Add "Copied!" feedback
				const copyButton = document.getElementById('copy-share-link-button');
				if (copyButton) {
					copyButton.textContent = 'Copied!';
					setTimeout(() => {
						copyButton.textContent = 'Copy Link';
					}, 1500);
				}
			})
			.catch((err) => console.error('Failed to copy share link:', err));
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

<button
	title="Share the code"
	on:click|stopPropagation={() => (show = true)}
	disabled={isLoadingShare}
	class="flex p-0.5 hover:text-green-600 hover:text-red-600 disabled:opacity-50"
	><Icon name="share" /> {btnName}</button
>

{#if show}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		on:click|self={closeModalAndReset}
	>
		<div
			class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
			on:click|stopPropagation
		>
			<button
				on:click={closeModalAndReset}
				class="absolute right-3 top-3 rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
				aria-label="Close share modal">×</button
			>

			<h2 class="mb-4 text-lg font-semibold dark:text-white">Share "{file.name}"</h2>

			{#if errorMessage}
				<p
					class="mb-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400"
				>
					{errorMessage}
				</p>
			{/if}

			{#if generatedLink}
				<!-- Display Generated Link -->
				<div class="mb-4">
					<p class="mb-1 text-sm text-gray-700 dark:text-gray-300">Shareable Link:</p>
					<input
						type="text"
						readonly
						bind:value={generatedLink}
						class="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
						on:focus={(e) => e.currentTarget.select()}
					/>
				</div>
				<div class="flex justify-end gap-2">
					<button
						id="copy-share-link-button"
						on:click={copyLink}
						class="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
					>
						Copy Link
					</button>
					<button
						on:click={closeModalAndReset}
						class="rounded bg-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
					>
						Done
					</button>
				</div>
			{:else}
				<!-- Form to Enter Title & Generate Link -->
				<form on:submit|preventDefault={generateAndShare} class="space-y-4">
					<div>
						<label
							for="share-title"
							class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Share Title (Optional)
						</label>
						<input
							type="text"
							id="share-title"
							bind:value={shareTitle}
							maxlength="250"
							placeholder="e.g., My Project Draft"
							class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							A title for this specific share link.
						</p>
					</div>

					<!-- Optional: Expiry Date Input -->
					<div>
						<label
							for="share-expiry"
							class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Expires At (Optional)
						</label>
						<input
							type="datetime-local"
							id="share-expiry"
							bind:value={expiryDate}
							min={new Date(new Date().getTime() + 60000).toISOString().slice(0, 16)}
							class="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
						/>
					</div>

					<div class="flex justify-end gap-2 pt-2">
						<button
							type="button"
							on:click={closeModalAndReset}
							class="rounded bg-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
							disabled={isLoadingShare}
						>
							{#if isLoadingShare}
								<Icon name="loading" class="mr-1 inline-block h-4 w-4" /> Generating...
							{:else}
								Generate Link
							{/if}
						</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}
