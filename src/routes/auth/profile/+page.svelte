<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import Icon from '$lib/components/Icon.svelte';
  
    export let data: PageData; // { profile, profileError, session }
    export let form: ActionData; // From updateProfile action
  
    let isSubmitting = false;
  
    // Initialize form fields from loaded profile data or action data (if error/repopulation)
    let username = form?.username ?? data.profile?.username ?? '';
    let full_name = form?.full_name ?? data.profile?.full_name ?? '';
    let avatar_url = form?.avatar_url ?? data.profile?.avatar_url ?? '';
    let website = form?.website ?? data.profile?.website ?? '';
  
    // Reactive update if data.profile changes (e.g., after successful form submission and page reload)
    $: if (data.profile && !form?.error) { // Only update from data.profile if no form error is present
        username = data.profile.username ?? '';
        full_name = data.profile.full_name ?? '';
        avatar_url = data.profile.avatar_url ?? '';
        website = data.profile.website ?? '';
    }
  
    function handleProfileUpdate() {
        isSubmitting = true;
        // enhance will handle form submission and update 'form' prop
        return async ({ result, update }) => {
            isSubmitting = false;
            if (result.type === 'success' && result.data?.success) {
                // Optionally, show a temporary success message that fades out
                // form = { success: true, message: result.data.message }; // Update local form state for message
                // setTimeout(() => form = undefined, 3000);
            }
            await update(); // Important to update form prop with errors/data
        };
    }
  
  </script>
  
  <div class="container mx-auto p-4 md:p-8 max-w-2xl">
      <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Your Profile</h1>
  
      {#if data.profileError && !data.profile}
          <div class="error-box mb-6">
              <p class="font-bold">Could not load profile:</p>
              <p>{data.profileError}</p>
          </div>
      {/if}
  
      <form
          method="POST"
          action="?/updateProfile"
          use:enhance={handleProfileUpdate}
          class="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700"
      >
          {#if form?.error && !form?.errors}
              <div class="error-box"><p>{form.error}</p></div>
          {/if}
          {#if form?.success}
              <div class="success-box"><p>{form.message || 'Profile updated!'}</p></div>
          {/if}
  
          <div>
              <label for="email" class="label-style">Email</label>
              <input type="email" id="email" value={data.session?.user?.email || ''} readonly class="input-style bg-gray-100 dark:bg-gray-700 cursor-not-allowed" />
              <p class="help-text">Email cannot be changed here.</p>
          </div>
  
          <div>
              <label for="profile-username" class="label-style">Username</label>
              <input type="text" id="profile-username" name="username" bind:value={username} minlength="3" maxlength="50" pattern="^[a-zA-Z0-9_]+$" class="input-style" aria-describedby="username-error" />
              <p class="help-text">3-50 characters. Letters, numbers, and underscores only.</p>
              {#if form?.errors?.username}<p id="username-error" class="error-text">{form.errors.username[0]}</p>{/if}
          </div>
  
          <div>
              <label for="profile-fullname" class="label-style">Full Name</label>
              <input type="text" id="profile-fullname" name="full_name" bind:value={full_name} maxlength="150" class="input-style" aria-describedby="fullname-error" />
               {#if form?.errors?.full_name}<p id="fullname-error" class="error-text">{form.errors.full_name[0]}</p>{/if}
          </div>
  
          <div>
              <label for="profile-avatar" class="label-style">Avatar URL</label>
              <div class="flex items-center space-x-3">
                  {#if avatar_url || form?.avatar_url}
                      <img src={avatar_url || form?.avatar_url} alt="Avatar preview" class="h-16 w-16 rounded-full object-cover bg-gray-200 dark:bg-gray-700" />
                  {:else}
                       <span class="flex items-center justify-center h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-400">
                          <Icon name="loading" class="w-8 h-8"/> 
                       </span>
                  {/if}
                  <input type="url" id="profile-avatar" name="avatar_url" bind:value={avatar_url} placeholder="https://..." class="input-style flex-grow" aria-describedby="avatar-error" />
              </div>
              {#if form?.errors?.avatar_url}<p id="avatar-error" class="error-text">{form.errors.avatar_url[0]}</p>{/if}
          </div>
  
          <div>
              <label for="profile-website" class="label-style">Website URL</label>
              <input type="url" id="profile-website" name="website" bind:value={website} placeholder="https://..." class="input-style" aria-describedby="website-error" />
               {#if form?.errors?.website}<p id="website-error" class="error-text">{form.errors.website[0]}</p>{/if}
          </div>
  
          <div class="pt-4 border-t dark:border-gray-700">
              <button type="submit" disabled={isSubmitting} class="button-primary w-full md:w-auto">
                  {#if isSubmitting}<Icon name="loading" class="w-4 h-4 mr-2"/> Updating...{:else}Update Profile{/if}
              </button>
          </div>
      </form>
  </div>
  
  <!-- <style>
      /* Define .label-style, .input-style, .error-text, .help-text, .error-box, .success-box, .button-primary */
      .label-style { @apply block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1; }
      .input-style { @apply px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm; }
      .error-text { @apply mt-1 text-xs text-red-600 dark:text-red-400; }
      .help-text { @apply mt-1 text-xs text-gray-500 dark:text-gray-400; }
      .error-box { @apply text-sm text-red-600 dark:text-red-400 mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded; }
      .success-box { @apply text-sm text-green-600 dark:text-green-400 mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-500/30 rounded; }
      .button-primary { @apply inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 dark:focus:ring-offset-gray-800; }
  </style> -->