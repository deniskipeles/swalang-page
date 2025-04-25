import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// Still use the OpenAI library, but configure it for Groq
import { OpenAI } from "https://esm.sh/openai@4.24.7";
import { corsHeaders } from '../_shared/cors.ts';

// --- Configuration ---
const groqApiKey = Deno.env.get("GROQ_API_KEY");
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

// Common Groq models (check Groq documentation for latest)
// https://console.groq.com/docs/models
const DEFAULT_MODEL = "llama3-8b-8192"; // Or "mixtral-8x7b-32768" etc.

const MAX_CONTEXT_TOKENS = 8192; // Adjust based on the chosen Groq model's limit

console.log('ai-stream function initialized (using Groq).');

serve(async (req: Request) => {
  // 1. Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  // --- Basic Request Validation ---
   if (req.method !== 'POST') {
        console.error(`Invalid method: ${req.method}`);
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
         console.error(`Invalid content type: ${contentType}`);
         return new Response(JSON.stringify({ error: 'Unsupported Media Type: Expected application/json' }), {
            status: 415,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // --- Authentication (Placeholder - Needs Proper JWT Verification) ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // TODO: Implement proper JWT verification using SUPABASE_JWT_SECRET
        console.error("Unauthorized: Missing or invalid Authorization Bearer token.");
        return new Response(JSON.stringify({ error: 'Unauthorized: Missing token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
    // console.log("Authorization header present (JWT verification TODO).");
    // const userId = await verifyAndGetUserId(authHeader); // Replace with actual verification

    // --- Main Logic ---
    try {
        console.log("Parsing request body...");
        const {
            prompt,
            context = '',
            config = {} // e.g., { model: 'mixtral-8x7b-32768', max_tokens: 1000 }
        } = await req.json();

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
             console.error("Invalid prompt received.");
             return new Response(JSON.stringify({ error: 'Bad Request: Missing or invalid prompt' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
         console.log(`Received prompt (length: ${prompt.length}), context (length: ${context.length})`);

        // --- API Key Check ---
         if (!groqApiKey) {
            console.error("CRITICAL: GROQ_API_KEY is not set in function secrets.");
            throw new Error("AI service configuration error."); // Internal error
         }

        // --- TODO: PII Redaction (Keep this step) ---
        const sanitizedPrompt = prompt; // Replace with actual sanitized version
        const sanitizedContext = context;
        // console.log("PII Redaction step (TODO)");

        // --- TODO: Context Window Management (Keep this step) ---
        // Use a tokenizer (e.g., tiktoken WASM) compatible with the target Groq model (e.g., Llama3)
        // Truncate context/prompt accurately based on model's limit (e.g., 8192 for llama3-8b)
        let combinedInput = `Context:\n${sanitizedContext}\n\nPrompt:\n${sanitizedPrompt}`;
        // console.log("Context Window Management step (TODO)");


        // --- Initialize Groq Client (using OpenAI library) ---
         console.log("Initializing Groq client (via OpenAI library)...");
         const groq = new OpenAI({
            apiKey: groqApiKey, // Use Groq's API key
            baseURL: GROQ_BASE_URL, // Point to Groq's OpenAI-compatible endpoint
         });

         // --- Call Groq API (Streaming) ---
         const modelToUse = config.model || DEFAULT_MODEL; // Allow overriding model via request config
         console.log(`Calling Groq model: ${modelToUse}`);
         const startTime = Date.now();

         const stream = await groq.chat.completions.create({
            model: modelToUse, // Use the selected Groq model name
            messages: [
                // Optional: Add a system prompt here if desired
                // { role: "system", content: "You are a helpful coding assistant." },
                { role: "user", content: combinedInput }
            ],
            stream: true,
            max_tokens: config.max_tokens || 1500, // Limit response length
            // temperature: config.temperature || 0.7, // Groq supports temperature etc.
            // top_p: config.top_p,
         });
         console.log(`Groq stream initiated (${Date.now() - startTime}ms)`);

         // --- Return Streaming Response ---
        return new Response(stream.toReadableStream(), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
            },
            status: 200,
        });

    } catch (error) {
        console.error('Error in Groq stream function:', error);

        let statusCode = 500;
         let errorMessage = "Internal Server Error";
         let errorCode = "GROQ_STREAM_ERROR"; // Use a more specific code

         if (error instanceof SyntaxError) {
             statusCode = 400;
             errorMessage = "Bad Request: Invalid JSON format.";
             errorCode = "INVALID_JSON";
         } else if (error.message?.includes("configuration error")) {
             statusCode = 503;
             errorMessage = "AI service unavailable due to configuration issues.";
             errorCode = "AI_CONFIG_ERROR";
         } else if (error.response && error.status) { // Handle potential API errors from Groq
             statusCode = error.status; // Use status code from Groq response
             errorMessage = `Groq API Error: ${error.message || error.error?.message || 'Unknown API error'}`;
             errorCode = "GROQ_API_ERROR";
             console.error("Groq API Error Details:", error.response?.data || error.error);
         }

        const errorPayload = {
            code: errorCode,
            message: errorMessage,
            // Avoid leaking full error details in production if sensitive
            // detail: error instanceof Error ? error.message : String(error),
        };
        return new Response(JSON.stringify(errorPayload), {
            status: statusCode,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});