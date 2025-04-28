<script>
	import { invalidate } from '$app/navigation'
	import { onMount } from 'svelte'
	import "../app.css"
  
	let { data, children } = $props()
	let { session, supabase } = $derived(data)
  
	onMount(() => {
	  const { data } = supabase.auth.onAuthStateChange((_, newSession) => {
		if (newSession?.expires_at !== session?.expires_at) {
		  invalidate('supabase:auth')
		}
	  })
  
	  return () => data.subscription.unsubscribe()
	})
  </script>
  
  <div class="min-h-screen flex flex-col">
    <header class="bg-gray-800 text-white p-4 flex justify-between items-center">
        <a href="/">
            <h1 class="text-xs font-bold">Swalang</h1>
        </a>
      <div>
          {#if data.session?.user}
              <span class="mr-4">Welcome, {data.session.user.email || data.session.user.id}</span>
              <form method="POST" action="/auth?/signout">
                <button class="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded">
                    Logout
                </button>
              </form>
          {/if}
      </div>
    </header>
  
    {@render children()}
  
    <!-- <footer class="bg-gray-200 text-center p-2 text-sm">
      © 2023 AI Coding Assistant
    </footer> -->
  </div>
  
  