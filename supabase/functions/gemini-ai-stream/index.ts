import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'; // Use appropriate std version

interface RequestPayload {
  prompt: string;
  model?: string; // e.g., 'gemini-pro' or 'gemini-1.5-pro-latest'
}

// No need to define GeminiResponse interface here, as we'll stream raw SSE data

serve(async (req: Request) => {
  // 1. Handle CORS Preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*', // Or specific origin
      'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    } })
  }

  // Allow only POST method for the actual request
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*', // CORS
      },
    });
  }

  try {
    // 2. Retrieve the API Key from secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY environment variable not set.");
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 3. Parse the incoming request body
    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { prompt, model = 'gemini-1.5-pro-latest', ...rest } = payload; // Default model

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing "prompt" in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 4. Construct the Gemini API Request (using streaming endpoint + SSE format)
    //    Refer to Google's Gemini REST API documentation
    //    https://ai.google.dev/docs/rest_api/v1beta/models/streamGenerateContent
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${geminiApiKey}&alt=sse`; // <--- Use streamGenerateContent & alt=sse

    const requestBody = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      // Optional: Add generationConfig, safetySettings etc.
    };

    // 5. Make the API call to Gemini (DO NOT await the full body here)
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // 6. Handle potential errors from the initial API connection
    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text(); // Read error body fully
      console.error(`Gemini API error (${geminiResponse.status}):`, errorBody);
      return new Response(JSON.stringify({ error: `Gemini API Error: ${geminiResponse.statusText}`, details: errorBody }), {
        status: geminiResponse.status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // CORS for error
        },
      });
    }

    // 7. Check if the response body exists
    if (!geminiResponse.body) {
        return new Response(JSON.stringify({ error: 'Gemini API returned no response body' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    }

    // 8. Return the stream directly to the client
    //    Set appropriate headers for Server-Sent Events (SSE)
    return new Response(geminiResponse.body, { // <--- Pass the readable stream directly
      headers: {
        'Content-Type': 'text/event-stream', // <--- Crucial for SSE
        'Cache-Control': 'no-cache', //   <--- Prevent buffering
        'Connection': 'keep-alive',  // <--- Keep connection open
        'Access-Control-Allow-Origin': '*', // <--- CORS for the stream
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });

  } catch (error) {
    console.error('Error processing request:', error);
    // Don't return JSON here if the client expects a stream,
    // although at this point the stream hasn't started. Returning JSON might be okay.
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
})

console.log(`Function "gemini-handler" (streaming) up and running!`);



// // Follow this setup guide to integrate the Deno language server with your editor:
// // https://deno.land/manual/getting_started/setup_your_environment
// // This enables autocomplete, go to definition, etc.

// // Setup type definitions for built-in Supabase Runtime APIs
// import "jsr:@supabase/functions-js/edge-runtime.d.ts"

// console.log("Hello from Functions!")

// Deno.serve(async (req) => {
//   const { name } = await req.json()
//   const data = {
//     message: `Hello ${name}!`,
//   }

//   return new Response(
//     JSON.stringify(data),
//     { headers: { "Content-Type": "application/json" } },
//   )
// })

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/gemini-ai-stream' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
