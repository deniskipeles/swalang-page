<!-- src/routes/auth/signup/+page.svelte -->
<script lang="ts">
    import { supabase } from '$lib/supabaseClient';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
  
    let email = '';
    let password = '';
    let confirmPassword = '';
    let loading = false;
    let errorMessage: string | null = null;
    let successMessage: string | null = null;
  
    // Redirect if already logged in
    onMount(() => {
      const session = $page.data.session; // Assumes session is available via root layout potentially
      if (session) {
        goto('/app'); // Redirect to the main app area
      }
    });
  
    async function handleSignup(event: Event) {
      event.preventDefault(); // Prevent default form submission
      if (loading) return;
  
      // Basic client-side validation
      if (!email || !password || !confirmPassword) {
        errorMessage = 'Please fill in all fields.';
        return;
      }
      if (password !== confirmPassword) {
        errorMessage = 'Passwords do not match.';
        return;
      }
      if (password.length < 6) {
          errorMessage = 'Password must be at least 6 characters long.';
          return;
      }
  
      loading = true;
      errorMessage = null;
      successMessage = null;
  
      try {
        // Call Supabase signUp
        const { data, error } = await supabase.auth.signUp({
          email: email,
          password: password,
          // Optional: Add options like redirect URL after confirmation
          // options: {
          //   emailRedirectTo: `${window.location.origin}/app`, // Redirect to app after email link clicked
          // }
        });
  
        if (error) throw error;
  
        // Check if email confirmation is required (Supabase default)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            // This usually indicates an issue, maybe email already exists but unconfirmed.
            // Supabase might return a user object even if confirmation is needed.
            // The most reliable indicator is often the lack of a session immediately after signup.
            errorMessage = "An issue occurred during sign up. The email might already be registered.";
        } else if (data.session) {
            // Should generally NOT happen if email confirmation is enabled.
            // If it does, the user is logged in immediately.
            successMessage = 'Signup successful! Redirecting...';
            await goto('/app'); // Redirect to app if logged in immediately
        }
         else if (data.user) {
             // Standard case: User created, confirmation email sent.
             successMessage = 'Signup successful! Please check your email to confirm your account.';
             // Optional: Clear form, redirect to login, or show message prominently.
             email = '';
             password = '';
             confirmPassword = '';
             // Consider redirecting to login after a short delay
             // setTimeout(() => goto('/auth/login'), 5000);
         } else {
             // Unexpected response structure
             throw new Error("Unexpected response from signup service.");
         }
  
      } catch (error: any) {
        console.error('Error signing up:', error);
        errorMessage = error.error_description || error.message || 'Failed to sign up.';
        // Specific checks
         if (errorMessage?.toLowerCase().includes("user already registered")) {
             errorMessage = "This email address is already registered. Try logging in instead.";
         } else if (errorMessage?.toLowerCase().includes("rate limit exceeded")) {
             errorMessage = "Too many signup attempts. Please try again later.";
         }
  
      } finally {
        loading = false;
      }
    }
  </script>
  
  <div class="container mx-auto p-8 max-w-sm mt-16">
    <h1 class="text-2xl font-bold mb-6 text-center">Create Account</h1>
  
    {#if errorMessage}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">{errorMessage}</span>
      </div>
    {/if}
  
    {#if successMessage}
      <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
        <span class="block sm:inline">{successMessage}</span>
      </div>
    {/if}
  
    <form on:submit={handleSignup}>
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="email">
          Email
        </label>
        <input
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          id="email"
          type="email"
          placeholder="your.email@example.com"
          bind:value={email}
          required
          disabled={loading}
        />
      </div>
      <div class="mb-4">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="password">
          Password
        </label>
        <input
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
          id="password"
          type="password"
          placeholder="******************"
          bind:value={password}
          required
          minlength="6"
          disabled={loading}
        />
         <!-- Optional: Add password strength indicator here -->
      </div>
       <div class="mb-6">
        <label class="block text-gray-700 text-sm font-bold mb-2" for="confirmPassword">
          Confirm Password
        </label>
        <input
          class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline"
          id="confirmPassword"
          type="password"
          placeholder="******************"
          bind:value={confirmPassword}
          required
          disabled={loading}
        />
      </div>
      <div class="flex items-center justify-between">
        <button
          class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full disabled:opacity-50"
          type="submit"
          disabled={loading}
        >
          {loading ? 'Signing Up...' : 'Sign Up'}
        </button>
      </div>
       <div class="mt-6 text-center">
        <a href="/auth/login" class="inline-block align-baseline font-bold text-sm text-blue-500 hover:text-blue-800">
          Already have an account? Log In
        </a>
      </div>
    </form>
  </div>