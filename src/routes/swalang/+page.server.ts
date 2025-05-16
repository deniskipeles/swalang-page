// src/routes/swalang/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z } from 'zod';
import { ZodError } from 'zod';
import { listCategories, createCategory } from '$lib/services/swahiliCollaborationService'; // Import service functions
import { updateCategory } from '$lib/services/swahiliCollaborationService'; // Add import

const updateCategorySchema = z.object({
    id: z.string().uuid("Invalid category ID."),
    name: z.string().trim().min(1, "Category name cannot be empty.").max(100),
    description: z.string().trim().max(500).optional(),
});

// Define Zod schema for form validation
const createCategorySchema = z.object({
  name: z.string().trim().min(1, { message: "Category name cannot be empty." }).max(100, { message: "Name too long (max 100)."}),
  description: z.string().trim().max(500, { message: "Description too long (max 500)."}).optional(), // Optional description
});

// Load function: Fetch categories on server load
export const load: PageServerLoad = async (event) => {
    const { locals: { supabase, safeGetSession:getSession } } = event; // Use server client from hooks

    const session = await getSession();
    console.log("Session:", session)
    if (!session) {
        // Optionally redirect or just let UI handle showing login prompt
        // throw redirect(303, '/auth/login?redirectTo=/swalang');
        return { categories: [], error: 'Authentication required to collaborate.', session }; // Return empty list if not logged in
    }

    const { data: categories, error } = await listCategories(supabase); // Pass server client

    if (error) {
        console.error("Error loading categories:", error);
        // Return error to the page props
        return { categories: [], error: `Error loading categories: ${error.message}`, session };
    }

    return { categories: categories || [], error: null, session }; // Pass categories and session to page
};

// Actions: Handle form submissions
export const actions: Actions = {
    // Action for creating a new category
    createCategory: async (event) => {
        const { request, locals: { supabase, safeGetSession:getSession } } = event;

        const session = await getSession();
        if (!session) {
            return fail(401, { error: 'You must be logged in to create a category.' });
        }

        const formData = await request.formData();
        const name = formData.get('name');
        const description = formData.get('description');

        try {
            // Validate form data using Zod schema
            const validatedData = createCategorySchema.parse({
                name: name,
                description: description || undefined // Ensure optional field is handled
            });

            // Call the service function to create the category (passing server client)
            const { data: newCategory, error } = await createCategory(supabase, {
                name: validatedData.name,
                description: validatedData.description
            });

            if (error) {
                 // Return specific errors from the service layer
                 return fail(400, { // Use 400 for bad request/validation type errors
                     name, description, // Return submitted data to repopulate form
                     error: error.message,
                     errorCode: error.code // Pass code for specific handling if needed
                 });
            }

            // Success!
            // No need to return data, load function will re-run or use invalidateAll
            // You could return a success message if desired:
            // return { success: true, message: `Category "${newCategory?.name}" created!` };
             return { success: true }; // Indicate success, form will clear

        } catch (err) {
            if (err instanceof ZodError) {
                // Extract Zod validation errors
                const errors = err.flatten().fieldErrors;
                console.log("Validation Errors:", errors);
                return fail(400, {
                    name, description, // Return submitted data
                    errors // Pass Zod errors object to the form
                 });
            }
            // Handle unexpected errors
            console.error("Unexpected error creating category:", err);
            return fail(500, {
                 name, description,
                 error: 'An unexpected server error occurred.'
             });
        }
    }
};