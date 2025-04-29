<script lang="ts">
  let { form } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-gray-100 px-4 py-12">
  <div class="w-full max-w-md bg-white rounded-xl shadow-md p-8 space-y-6">
    <h1 class="text-2xl font-bold text-center text-gray-800">Login to Your Account</h1>

    <!-- Email/Password -->
    <form method="POST" action="?/signin_email" class="space-y-4">
      <input
        name="email"
        placeholder="Email"
        type="email"
        value={form?.email ?? ""}
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
      />
      <input
        name="password"
        placeholder="Password"
        type="password"
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
      />
      <div class="flex space-x-2">
        <button
          type="submit"
          class="flex-1 bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition"
        >
          Login
        </button>
        <button
          formaction="?/signup"
          class="flex-1 bg-gray-200 text-gray-800 font-semibold py-2 rounded hover:bg-gray-300 transition"
        >
          Signup
        </button>
      </div>
    </form>

    <!-- GitHub OAuth -->
    <form method="POST" action="/auth?/oauth" class="space-y-2">
      <button
        name="provider"
        value="github"
        class="w-full bg-gray-800 text-white font-semibold py-2 rounded hover:bg-gray-900 transition"
      >
        Login with GitHub
      </button>
    </form>

    <!-- Magic Link -->
    <!-- <form method="POST" action="?/magic" class="space-y-2">
      <input
        name="email"
        placeholder="Email for magic link"
        type="email"
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
      />
      <button
        class="w-full bg-purple-600 text-white font-semibold py-2 rounded hover:bg-purple-700 transition"
      >
        Login with Magic Link
      </button>
    </form> -->

    <!-- Phone OTP -->
    <!-- <form method="POST" action="?/signin_otp" class="space-y-2">
      <input
        name="phone"
        placeholder="Phone Number"
        type="text"
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
      />
      <button
        class="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition"
      >
        Login with Phone OTP
      </button>
    </form> -->

    <!-- Anonymous Login -->
    <form method="POST" action="?/anon">
      <button
        class="w-full bg-yellow-500 text-white font-semibold py-2 rounded hover:bg-yellow-600 transition"
      >
        Login Anonymously
      </button>
    </form>

    <!-- Password Reset -->
    <!-- <form method="POST" action="?/reset" class="space-y-2">
      <input
        name="email"
        placeholder="Email for password reset"
        type="email"
        class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
      />
      <button
        class="w-full bg-red-600 text-white font-semibold py-2 rounded hover:bg-red-700 transition"
      >
        Reset Your Password
      </button>
    </form> -->

    <!-- Messages -->
    {#if form?.message}
      <p class="text-center text-green-600">{form.message}</p>
    {/if}
    {#if form?.error}
      <p class="text-center text-red-600">{form.error}</p>
    {/if}

    <!-- OTP Verification -->
    <!-- {#if form?.verify}
      <form method="POST" action="?/verify_otp" class="space-y-2">
        <input
          name="otp"
          placeholder={`OTP sent to ${form?.phone}`}
          type="text"
          class="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:border-blue-400"
        />
        <input name="phone" type="hidden" value={form?.phone} />
        <button
          class="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition"
        >
          Verify OTP
        </button>
      </form>
    {/if} -->
  </div>
</div>
