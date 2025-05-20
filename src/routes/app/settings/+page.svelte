<script lang="ts">
    import type { PageData } from './$types';
    export let data: PageData;
</script>

<div class="container mx-auto p-4 md:p-8">
    <h1 class="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Application Settings</h1>

    <div class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <p class="text-gray-600 dark:text-gray-400">
            This is the settings page. Future application settings will go here, such as:
        </p>
        <ul class="list-disc list-inside mt-4 text-gray-600 dark:text-gray-400 space-y-1">
            <li>Theme preferences (Light/Dark/System)</li>
            <li>Notification settings</li>
            <li>AI Model preferences (default model, API keys for user-provided models)</li>
            <li>Editor settings (font size, tab settings)</li>
            <li>Account management (e.g., change password - link to Supabase Auth, delete account)</li>
        </ul>
    </div>
</div>