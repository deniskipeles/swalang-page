// src/lib/services/contentService.ts
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database.types';
import { z } from 'zod';
import { supabase as globalSupabaseClient } from '$lib/supabaseClient';

// --- Types & Schemas ---
type NewsArticleRow = Database['public']['Tables']['content_news_articles']['Row'];
type EventRow = Database['public']['Tables']['content_events']['Row'];

// Schema for listing news (adjust fields as needed)
export const newsListItemSchema = z.object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    featured_image_url: z.string().url().nullable(),
    published_at: z.coerce.date().nullable(), // Coerce string date
});
export type NewsListItem = z.infer<typeof newsListItemSchema>;

// Schema for listing events (adjust fields as needed)
export const eventListItemSchema = z.object({
    slug: z.string(),
    title: z.string(),
    summary: z.string().nullable(),
    featured_image_url: z.string().url().nullable(),
    start_datetime: z.coerce.date(),
    location_type: z.string(), // Could use z.enum(['physical', 'virtual', 'hybrid'])
    location_address: z.string().nullable(),
    location_virtual_url: z.string().url().nullable(),
});
export type EventListItem = z.infer<typeof eventListItemSchema>;

// Basic error formatting
export interface ContentError { message: string; code?: string; details?: any; }
function formatContentError(message: string, error?: PostgrestError | Error | z.ZodError | null, code?: string): ContentError {
     console.error(`Content Service Error: ${message}`, error);
     return { message, code: code || 'UNKNOWN_ERROR', details: error };
}

// --- Service Functions ---

/**
 * Lists published news articles, ordered by publish date descending.
 */
export async function listPublishedNews(
    client: SupabaseClient<Database> = globalSupabaseClient,
    options?: { limit?: number; offset?: number }
): Promise<{ data?: NewsListItem[], error?: ContentError }> {
    try {
        let query = client
            .from('content_news_articles')
            .select('slug, title, summary, featured_image_url, published_at')
            // RLS policy handles filtering for is_published=true and published_at<=now()
            .order('published_at', { ascending: false, nulls: 'last' }) // Show newest first
            .order('created_at', { ascending: false }); // Secondary sort

        if (options?.limit) {
            query = query.limit(options.limit);
        }
        if (options?.offset) {
             query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
        }

        const { data, error: dbError } = await query;

        if (dbError) {
            return { error: formatContentError(`Failed to list news articles.`, dbError) };
        }

        const validation = z.array(newsListItemSchema).safeParse(data);
        if (!validation.success) {
            console.warn("News list validation failed", validation.error);
            return { data: data as NewsListItem[] }; // Return potentially invalid
        }
        return { data: validation.data };

    } catch (e) {
        return { error: formatContentError(`An unexpected error occurred listing news.`, e as Error) };
    }
}

/**
 * Lists published events, ordered by start date (upcoming first, then past).
 */
export async function listPublishedEvents(
    client: SupabaseClient<Database> = globalSupabaseClient,
    options?: { limit?: number; offset?: number; filter?: 'upcoming' | 'past' | 'all' }
): Promise<{ data?: EventListItem[], error?: ContentError }> {
    const filter = options?.filter ?? 'all';
    const now = new Date().toISOString();

    try {
        let query = client
            .from('content_events')
            .select('slug, title, summary, featured_image_url, start_datetime, location_type, location_address, location_virtual_url')
            // RLS policy handles is_published=true
            .order('start_datetime', { ascending: filter === 'past' ? false : true }); // Upcoming ascending, Past descending

        // Apply time filter
        if (filter === 'upcoming') {
            query = query.gte('start_datetime', now);
        } else if (filter === 'past') {
            query = query.lt('start_datetime', now);
        } // 'all' needs no time filter

        if (options?.limit) {
            query = query.limit(options.limit);
        }
         if (options?.offset) {
             query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
        }

        const { data, error: dbError } = await query;

         if (dbError) {
            return { error: formatContentError(`Failed to list events.`, dbError) };
        }

        const validation = z.array(eventListItemSchema).safeParse(data);
         if (!validation.success) {
             console.warn("Event list validation failed", validation.error);
             return { data: data as EventListItem[] }; // Return potentially invalid
         }
        return { data: validation.data };

    } catch (e) {
         return { error: formatContentError(`An unexpected error occurred listing events.`, e as Error) };
    }
}


// --- Schemas for Detail Pages ---
export const newsArticleSchema = newsListItemSchema.extend({
    // Inherits slug, title, summary, featured_image_url, published_at
    id: z.string().uuid(),
    content: z.string().nullable(),
    is_published: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
    created_by: z.string().uuid().nullable(),
    last_edited_by: z.string().uuid().nullable(),
});
export type NewsArticle = z.infer<typeof newsArticleSchema>;

export const eventSchema = eventListItemSchema.extend({
     // Inherits slug, title, summary, featured_image_url, start_datetime, location*
    id: z.string().uuid(),
    description: z.string().nullable(),
    end_datetime: z.coerce.date().nullable(),
    is_published: z.boolean(),
    created_at: z.coerce.date(),
    updated_at: z.coerce.date(),
    created_by: z.string().uuid().nullable(),
    last_edited_by: z.string().uuid().nullable(),
});
export type EventData = z.infer<typeof eventSchema>;


// --- Service Functions ---

/**
 * Retrieves a single news article by its slug.
 * Honours RLS (e.g., only returns published articles unless user is admin/editor).
 */
export async function getNewsArticleBySlug(
    client: SupabaseClient<Database> = globalSupabaseClient,
    slug: string
): Promise<{ data?: NewsArticle, error?: ContentError }> {
    if (!slug) return { error: formatContentError("Slug is required.", null, 'INVALID_INPUT') };
    try {
        const { data, error: dbError } = await client
            .from('content_news_articles')
            .select('*') // Select all fields for detail view
            .eq('slug', slug)
            // RLS policy 'content_news_select_published' applies for non-admins/editors
            .maybeSingle();

        if (dbError) return { error: formatContentError(`Failed to retrieve article '${slug}'.`, dbError) };
        if (!data) return { error: formatContentError(`News article '${slug}' not found or not published.`, null, 'NOT_FOUND_OR_DENIED') };

        const validation = newsArticleSchema.safeParse(data);
        if (!validation.success) {
            console.warn("News article detail validation failed", validation.error);
            return { data: data as NewsArticle }; // Return potentially invalid
        }
        return { data: validation.data };

    } catch (e) { return { error: formatContentError(`Unexpected error retrieving article '${slug}'.`, e as Error) }; }
}

/**
 * Retrieves a single event by its slug.
 * Honours RLS.
 */
export async function getEventBySlug(
    client: SupabaseClient<Database> = globalSupabaseClient,
    slug: string
): Promise<{ data?: EventData, error?: ContentError }> {
     if (!slug) return { error: formatContentError("Slug is required.", null, 'INVALID_INPUT') };
    try {
        const { data, error: dbError } = await client
            .from('content_events')
            .select('*')
            .eq('slug', slug)
             // RLS policy 'content_events_select_published' applies
            .maybeSingle();

        if (dbError) return { error: formatContentError(`Failed to retrieve event '${slug}'.`, dbError) };
        if (!data) return { error: formatContentError(`Event '${slug}' not found or not published.`, null, 'NOT_FOUND_OR_DENIED') };

        const validation = eventSchema.safeParse(data);
         if (!validation.success) {
            console.warn("Event detail validation failed", validation.error);
            return { data: data as EventData }; // Return potentially invalid
        }
        return { data: validation.data };

    } catch (e) { return { error: formatContentError(`Unexpected error retrieving event '${slug}'.`, e as Error) }; }
}


/**
 * Creates a new news article. Requires authenticated client with insert permissions.
 */
export async function createNewsArticle(
    client: SupabaseClient<Database>,
    details: {
        slug: string; title: string; summary?: string | null; content?: string | null;
        featured_image_url?: string | null; is_published: boolean; published_at?: Date | string | null;
    }
): Promise<{ data?: Pick<NewsArticle, 'slug'>, error?: ContentError }> {

    // Add Zod validation for input details here if desired...
    // const inputSchema = z.object({ ... }); validation = inputSchema.safeParse(details); ...

    try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatContentError("User not authenticated.", userError, 'AUTH_REQUIRED') };
        }

        // Ensure published_at is a valid date string or null
        let pubDate: string | null = null;
        if (details.published_at) {
            try { pubDate = new Date(details.published_at).toISOString(); } catch { /* ignore invalid date */ }
        }

        const { data, error: dbError } = await client
            .from('content_news_articles')
            .insert({
                slug: details.slug,
                title: details.title,
                summary: details.summary || null,
                content: details.content || null,
                featured_image_url: details.featured_image_url || null,
                is_published: details.is_published,
                published_at: details.is_published ? (pubDate || new Date().toISOString()) : null, // Default publish now if published and no date given
                created_by: user.id,
                last_edited_by: user.id
            })
            .select('slug')
            .single();

        if (dbError) {
            if (dbError.code === '23505' && dbError.message.includes('content_news_articles_slug_unique')) {
                 return { error: formatContentError(`Slug "${details.slug}" is already in use.`, dbError, 'DB_UNIQUE_VIOLATION') };
            }
            return { error: formatContentError(`Failed to create news article.`, dbError) };
        }
        return { data };

    } catch (e) { return { error: formatContentError(`Unexpected error creating news article.`, e as Error) }; }
}


/**
 * Creates a new event. Requires authenticated client with insert permissions.
 */
export async function createEvent(
    client: SupabaseClient<Database>,
    details: {
        slug: string; title: string; summary?: string | null; description?: string | null;
        featured_image_url?: string | null; start_datetime: Date | string; end_datetime?: Date | string | null;
        location_type: 'physical' | 'virtual' | 'hybrid'; location_address?: string | null;
        location_virtual_url?: string | null; is_published: boolean;
    }
): Promise<{ data?: Pick<EventData, 'slug'>, error?: ContentError }> {

     // Add Zod validation for input details here if desired...
     // const inputSchema = z.object({ ... }); validation = inputSchema.safeParse(details); ...
      try {
        // Convert dates to ISO strings, handle potential errors
        const startIso = new Date(details.start_datetime).toISOString();
        const endIso = details.end_datetime ? new Date(details.end_datetime).toISOString() : null;

        if (endIso && startIso >= endIso) {
             return { error: formatContentError("End date/time must be after start date/time.", null, 'VALIDATION_ERROR') };
        }

         const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError || !user) {
            return { error: formatContentError("User not authenticated.", userError, 'AUTH_REQUIRED') };
        }

        const { data, error: dbError } = await client
            .from('content_events')
            .insert({
                slug: details.slug,
                title: details.title,
                summary: details.summary || null,
                description: details.description || null,
                featured_image_url: details.featured_image_url || null,
                start_datetime: startIso,
                end_datetime: endIso,
                location_type: details.location_type,
                location_address: details.location_type !== 'virtual' ? (details.location_address || null) : null,
                location_virtual_url: details.location_type !== 'physical' ? (details.location_virtual_url || null) : null,
                is_published: details.is_published,
                created_by: user.id,
                last_edited_by: user.id
            })
            .select('slug')
            .single();

        if (dbError) {
            if (dbError.code === '23505' && dbError.message.includes('content_events_slug_unique')) {
                 return { error: formatContentError(`Slug "${details.slug}" is already in use.`, dbError, 'DB_UNIQUE_VIOLATION') };
            }
            // Handle check constraint violation for dates
             if (dbError.code === '23514' && dbError.message.includes('content_events_end_after_start')) {
                 return { error: formatContentError("End date/time must be after start date/time.", dbError, 'DB_CHECK_VIOLATION') };
            }
            return { error: formatContentError(`Failed to create event.`, dbError) };
        }
        return { data };

    } catch (e) {
        // Catch errors from date parsing or DB
        if(e instanceof Error && e.message.includes("Invalid Date")) {
            return { error: formatContentError("Invalid date format provided.", e, 'VALIDATION_ERROR') };
        }
        return { error: formatContentError(`Unexpected error creating event.`, e as Error) };
    }
}
