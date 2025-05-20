<!-- +layout.svelte -->
<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { onMount } from 'svelte';
	import '../app.css';

	import { slide } from 'svelte/transition'; // For smooth dropdown animation
	import type { Session } from '@supabase/supabase-js';
	import Icon from '$lib/components/Icon.svelte';

	let { data, children } = $props();
	let { session, supabase } = $derived(data);

	onMount(() => {
		const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
			if (newSession?.expires_at !== session?.expires_at) {
				invalidate('supabase:auth');
			}
		});

		// 🔽 Add global listeners for dropdown logic
		window.addEventListener('click', handleClickOutside);
		window.addEventListener('keydown', handleEscape);

		return () => {
			data.subscription.unsubscribe();
			window.removeEventListener('click', handleClickOutside);
			window.removeEventListener('keydown', handleEscape);
		};
	});

	let showUserMenu = $derived(false);
	// $effect(() => { showUserMenu = !showUserMenu; })
	let userMenuButton: HTMLButtonElement | null = null; // Reference to the button for click-outside logic

	function toggleUserMenu(event?: MouseEvent) {
		event?.stopPropagation(); // Prevent event from bubbling up and closing menu immediately
		showUserMenu = !showUserMenu;
	}

	function handleClickOutside(event: MouseEvent) {
		// Close if menu is open and click is outside the button AND outside the menu itself (if menu is rendered)
		if (showUserMenu && userMenuButton && !userMenuButton.contains(event.target as Node)) {
			// Check if click is inside the menu dropdown
			const menuElement = document.querySelector('.user-dropdown-menu'); // Add class to menu
			if (menuElement && !menuElement.contains(event.target as Node)) {
				showUserMenu = false;
			}
		}
	}

	function handleEscape(event: KeyboardEvent) {
		if (event.key === 'Escape' && showUserMenu) {
			showUserMenu = false;
		}
	}

	// Function to get a user avatar or initials
	function getUserDisplay(user: Session['user'] | undefined): {
		type: 'avatar' | 'initials';
		value: string;
	} {
		if (!user) return { type: 'initials', value: '?' };
		// Check for avatar_url in user_metadata (common for Supabase profiles setup)
		if (user.user_metadata?.avatar_url) {
			return { type: 'avatar', value: user.user_metadata.avatar_url };
		}
		// Fallback to initials from email
		const email = user.email;
		if (email) {
			const parts = email.split('@')[0].split(/[._-]/); // Split by common separators
			if (parts.length > 1) {
				return { type: 'initials', value: (parts[0][0] + parts[1][0]).toUpperCase() };
			}
			return { type: 'initials', value: email[0].toUpperCase() };
		}
		return { type: 'initials', value: 'U' }; // Default if no email
	}

	let userDisplayInfo = $derived(getUserDisplay(data?.session?.user));
</script>

<div class="flex min-h-screen flex-col">
	<header class="flex items-center justify-between bg-gray-800 p-4 text-white">
		<a href="/">
			<h1 class="text-xs font-bold">Swalang</h1>
		</a>
		<div>
			{#if session?.user}
				<div class="relative ml-3">
					<div>
						<button
							bind:this={userMenuButton}
							type="button"
							class="flex items-center justify-center rounded-full bg-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-100 dark:bg-gray-700 dark:focus:ring-indigo-400 dark:focus:ring-offset-gray-800"
							id="user-menu-button"
							aria-expanded={showUserMenu}
							aria-haspopup="true"
							on:click={toggleUserMenu}
							title="User menu"
						>
							<span class="sr-only">Open user menu</span>
							{#if userDisplayInfo.type === 'avatar'}
								<img
									class="h-8 w-8 rounded-full object-cover"
									src={userDisplayInfo.value}
									alt="User avatar"
								/>
							{:else}
								<span
									class="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white dark:bg-indigo-600"
								>
									{userDisplayInfo.value}
								</span>
							{/if}
						</button>
					</div>

					<!-- Dropdown menu -->
					{#if showUserMenu}
						<div
							transition:slide={{ duration: 150, axis: 'y' }}
							class="user-dropdown-menu absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-800"
							role="menu"
							aria-orientation="vertical"
							aria-labelledby="user-menu-button"
							tabindex="-1"
						>
							<!-- User Info (Optional) -->
							<div class="border-b border-gray-200 px-4 py-2 dark:border-gray-700">
								<p
									class="truncate text-sm font-medium text-gray-900 dark:text-gray-100"
									title={session.user.email}
								>
									{session.user.email || 'User'}
								</p>
								{#if session.user.user_metadata?.full_name}
									<p
										class="truncate text-xs text-gray-500 dark:text-gray-400"
										title={session.user.user_metadata.full_name}
									>
										{session.user.user_metadata.full_name}
									</p>
								{/if}
							</div>

							<!-- Menu Items -->
							<a
								href="/app/profile"
								class="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								role="menuitem"
								tabindex="-1"
								on:click={() => (showUserMenu = false)}
							>
								Your Profile
								<Icon
									name="user"
									class="mr-2 inline-block h-4 w-4 align-text-bottom text-gray-400 dark:text-gray-500"
								/>
							</a>
							<a
								href="/app/settings"
								class="flex px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
								role="menuitem"
								tabindex="-1"
								on:click={() => (showUserMenu = false)}
							>
								Settings
								<Icon
									name="settings"
									class="mr-2 inline-block h-4 w-4 align-text-bottom text-gray-400 dark:text-gray-500"
								/>
							</a>

							<!-- Logout Form -->
							<form method="POST" action="/auth?/signout" on:submit={() => (showUserMenu = false)}>
								<button
									type="submit"
									class="flex w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-gray-700 dark:hover:text-red-500"
									role="menuitem"
									tabindex="-1"
								>
									Sign out
									<Icon
										name="sign-out"
										class="mr-2 inline-block h-4 w-4 align-text-bottom text-red-400 dark:text-red-500"
									/>
								</button>
							</form>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Optional: Show Login/Signup buttons if no session -->
				<div class="space-x-2">
					<a
						href="/auth/login"
						class="text-sm font-medium text-gray-700 hover:text-indigo-600 dark:text-gray-300 dark:hover:text-indigo-400"
						>Sign in</a
					>
					<!-- <a href="/auth/signup" class="button-primary-sm">Sign up</a> -->
				</div>
			{/if}
		</div>
	</header>

	{@render children()}
</div>
