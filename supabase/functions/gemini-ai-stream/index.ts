import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'; // Use appropriate std version
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestPayload {
  prompt: string;
  model?: string; // e.g., 'gemini-pro' or 'gemini-1.5-pro-latest'
  contextSearchTerm?: string
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

    const { prompt, model = 'gemini-2.0-flash', contextSearchTerm = '' } = payload; // Default model

    // 2. Initialize Supabase Client (Admin)
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      global: {
        fetch: fetch
      } 
    } // Deno's global fetch
    );

    const { data: aiContextData, error: rpcError } = await supabase.rpc(
        'collaborate_swalang_fn_get_ai_context',
        { p_search_term: contextSearchTerm }
    );

    if (rpcError) throw new Error("Failed to gather context for AI.");

    console.log("AI Context Data:"); // Pretty print JSON

    // Format context for LLM, accessing data within the new structure
    let formattedContext = "Relevant Information Context:\n";
    if(aiContextData.search_term_used) {
        formattedContext += `(Based on search term: "${aiContextData.search_term_used}")\n\n`;
    }

    // --- Keywords Section ---
    if (aiContextData.keywords_section && aiContextData.keywords_section.keywords?.length > 0) {
        formattedContext += `Section: ${aiContextData.keywords_section.description}\n`; // Use the description from DB
        aiContextData.keywords_section.keywords.forEach((kw: any) => { // Access the 'keywords' array
            formattedContext += `- Keyword: ${kw.english_keyword} (${kw.category || 'General'})\n`;
            formattedContext += `  Desc: ${kw.keyword_description || 'N/A'}\n`;
            if (kw.top_suggestions?.length > 0) {
                formattedContext += `  Suggestions:\n`;
                kw.top_suggestions.forEach((sugg: any) => {
                    formattedContext += `    * Swahili: ${sugg.swahili_word} (Votes: ${sugg.votes})\n      Desc: ${sugg.description || 'N/A'}\n`;
                });
            }
        });
        formattedContext += "\n";
    }

    // --- Documentation Section ---
    if (aiContextData.documentation_section && aiContextData.documentation_section.documents?.length > 0) {
        formattedContext += `Section: ${aiContextData.documentation_section.description}\n`; // Use the description from DB
        aiContextData.documentation_section.documents.forEach((doc: any) => { // Access the 'documents' array
            formattedContext += `- Doc: ${doc.title} (${doc.category || 'General'})\n  Summary: ${doc.summary || 'N/A'}\n Summary: ${doc.summary || 'N/A'}\n swahili_content: ${doc.swahili_content || 'N/A'}\n english_content: ${doc.english_content || 'N/A'}\n (Slug: ${doc.slug}, Updated: ${doc.updated_at})\n`;
        });
        formattedContext += "\n";
    }

    // --- Final Prompt ---
    if (formattedContext === "Relevant Information Context:\n" || formattedContext.includes('(Based on search term:')) {
        formattedContext += "No specific context found in knowledge base for the search term.\n\n";
    }

    const finalPrompt = `${formattedContext}User Query:\n${prompt}`;
    console.log("--- Final Prompt for LLM ---");
    console.log(finalPrompt);
    console.log("---------------------------");





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
          parts: [{ text: finalPrompt }],
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
