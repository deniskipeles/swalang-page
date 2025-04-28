<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { goto } from '$app/navigation';

  onMount(async () => {
    try {
      const {
        data: { session },
        error
      } = await supabase.auth.getSession();

      if (error || !session) {
        console.error('OAuth callback failed:', error);
        goto('/auth/login?error=session_not_found');
        return;
      }

      // ✅ Store session in cookies so the server sees it on next requests
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });

      if (sessionError) {
        console.error('Error setting session:', sessionError);
        goto('/auth/login?error=session_store_failed');
        return;
      }

      // ✅ Redirect to the app once everything is in place
      goto('/app',{});
    } catch (err) {
      console.error('Unexpected error during OAuth callback:', err);
      goto('/auth/login?error=unexpected_callback_error',{});
    }
  });
</script>

<p class="text-center mt-20">Logging you in...</p>
