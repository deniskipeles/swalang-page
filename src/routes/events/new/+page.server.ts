import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { z, ZodError } from 'zod';
import { createEvent } from '$lib/services/contentService';

const eventSchema = z.object({
    title: z.string().trim().min(1, 'Title is required').max(250),
    slug: z.string().trim().min(1, 'Slug is required').max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format'),
    summary: z.string().trim().max(600).optional(),
    description: z.string().optional(),
    featured_image_url: z.string().url('Invalid URL').max(512).optional().or(z.literal('')),
    start_datetime: z.string().min(1, 'Start date/time is required'), // datetime-local string
    end_datetime: z.string().optional(), // datetime-local string
    location_type: z.enum(['physical', 'virtual', 'hybrid']),
    location_address: z.string().max(500).optional(),
    location_virtual_url: z.string().url('Invalid URL').max(512).optional().or(z.literal('')),
    is_published: z.enum(['on']).optional(),
}).refine(data => data.location_type !== 'physical' || (data.location_address && data.location_address.trim().length > 0), {
    message: "Address is required for physical events",
    path: ["location_address"],
}).refine(data => data.location_type !== 'virtual' || (data.location_virtual_url && data.location_virtual_url.trim().length > 0), {
     message: "Virtual URL is required for virtual events",
     path: ["location_virtual_url"],
});

export const load: PageServerLoad = async ({ locals }) => {
    const { session } = await locals.safeGetSession();
    if (!session) {
        throw redirect(303, '/auth/login?redirectTo=/events/new');
    }
     // TODO: Role check
    return {};
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
         const { supabase } = locals;
         const { session } = await locals.safeGetSession();
         if (!session) return fail(401, { error: 'Unauthorized' });
          // TODO: Role check

         const formData = await request.formData();
         const formDataObj = Object.fromEntries(formData);

         try {
            const validatedData = eventSchema.parse(formDataObj);

             const { data: result, error } = await createEvent(supabase, {
                 ...validatedData,
                 featured_image_url: validatedData.featured_image_url || null,
                 summary: validatedData.summary || null,
                 description: validatedData.description || null,
                 end_datetime: validatedData.end_datetime || null,
                 is_published: !!validatedData.is_published,
                 // Types already validated by Zod
                 location_type: validatedData.location_type,
                 location_address: validatedData.location_address || null,
                 location_virtual_url: validatedData.location_virtual_url || null,
             });

             if (error) {
                 return fail(400, { ...formDataObj, error: error.message, errorCode: error.code });
             }
             if (result?.slug) {
                 throw redirect(303, `/events/${result.slug}`);
             } else {
                 return fail(500, { ...formDataObj, error: 'Failed to create event, slug not returned.' });
             }

         } catch (err) {
              if (err instanceof ZodError) {
                 return fail(400, { ...formDataObj, errors: err.flatten().fieldErrors });
             }
             console.error("Unexpected error creating event:", err);
             return fail(500, { ...formDataObj, error: 'Server error.' });
         }
    }
};