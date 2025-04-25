<script lang="ts">
    import type { LayoutData } from './$types';
    import { supabase } from '$lib/supabaseClient';
    import { goto } from '$app/navigation';
  
    export let data: LayoutData; // Contains session from load function
  
    async function handleLogout() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("Logout Error:", error);
            alert("Logout failed: " + error.message);
        } else {
            // Ensure client-side redirect after signout
            await goto('/auth/login');
        }
    }
  </script>
  
  <div class="min-h-screen flex flex-col">
    <header class="bg-gray-800 text-white p-4 flex justify-between items-center">
      <h1 class="text-xl font-bold">AI Coding Assistant</h1>
      <div>
          {#if data.session?.user}
              <span class="mr-4">Welcome, {data.session.user.email || data.session.user.id}</span>
              <button on:click={handleLogout} class="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded">
                  Logout
              </button>
          {/if}
      </div>
    </header>
  
    <main class="flex-grow p-4">
      <!-- Nested route content will be rendered here -->
      <slot />
    </main>
  
    <footer class="bg-gray-200 text-center p-2 text-sm">
      © 2023 AI Coding Assistant
    </footer>
  </div>