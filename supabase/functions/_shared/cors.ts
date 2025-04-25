// // supabase/functions/_shared/cors.ts
// // Define allowed origins. Be specific in production for security.
// // Use '*' for development/testing ONLY if necessary.
// // Consider using an environment variable for allowed origins.
// const allowedOrigins = [
//     'http://localhost:5173',
//     'http://localhost:3000',
//     'https://5173-01jp06r43r3zeenk9nb1sbyeyg.cloudspaces.litng.ai',
//     'https://test-konnect.netlify.app'
//   ];
//   const defaultOrigin = 'http://localhost:5173'; // A default for safety
//   ;
//   export const corsHeaders = (requestOrigin)=>{
//     const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : defaultOrigin; // Or maybe reject if origin not allowed?
//     return {
//       'Access-Control-Allow-Origin': origin,
//       'Access-Control-Allow-Headers': '*',//authorization, x-client-info, apikey, content-type, x-requested-with, accept, origin,Authorization',
//       'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
//       "Access-Control-Max-Age": "86400"
//     };
//   };
//   // You can also create a pre-configured header object if the origin doesn't need to be dynamic per request
//   export const staticCorsHeaders = {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': '*',
//     'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH'
//   };
//   export const corsHeaders2 = {
//     'Access-Control-Allow-Origin': '*',
//     'Access-Control-Allow-Headers': 'authorization, content-type'
//   } // --- How to use it in your functions ---
//    /*
//   import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
//   import { corsHeaders } from '../_shared/cors.ts' // Import the headers function
  
//   serve(async (req) => {
//     // Get the request origin
//     const requestOrigin = req.headers.get('origin');
  
//     // Handle CORS preflight request
//     if (req.method === 'OPTIONS') {
//       return new Response('ok', { headers: corsHeaders(requestOrigin) }) // Pass origin
//     }
  
//     // Handle actual request
//     try {
//       // ... your function logic ...
  
//       return new Response(JSON.stringify({ message: "Success!" }), {
//         headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' }, // Spread dynamic headers
//         status: 200,
//       });
//     } catch (error) {
//       return new Response(JSON.stringify({ error: error.message }), {
//         headers: { ...corsHeaders(requestOrigin), 'Content-Type': 'application/json' }, // Spread dynamic headers
//         status: 500, // Or appropriate error code
//       });
//     }
//   })
//   */ ;
  


// supabase/functions/_shared/cors.ts
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origin in production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS for preflight
};