// src/routes/share/[shareToken]/[[...filePath]]/+page.server.ts
import { error as svelteKitError, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSharedFileOrFolderByToken } from '$lib/services/fileSystemService';

export const load: PageServerLoad = async (event) => {
    const { params, locals: { safeGetSession:getSession } } = event; // No supabase needed if service uses global for public view
    const shareToken = params.shareToken;
    const filePathParts = params.filePath?.split('/') || []; // For navigating within shared folders

    if (!shareToken) {
        throw svelteKitError(400, 'Share link is invalid (missing token).');
    }

    // We need to determine the actual parent_id to list within the shared structure.
    // This is complex if filePathParts are deep. For now, we'll simplify:
    // - If filePath is empty, we are at the root of the share.
    // - If filePath is present, it means navigating inside. This logic needs to
    //   resolve filePathParts to an actual file_id within the shared VFS,
    //   which requires recursive checks against the shared file names.
    //
    // SIMPLIFIED: This version only handles the root of the share or direct children.
    // A full filePath navigation requires a more complex service function.
    // For now, we'll pass null as sharedContextParentId, meaning we either see the shared file
    // or the direct children of the shared folder.

    const { shareInfo, fileNode, children, error } = await getSharedFileOrFolderByToken(shareToken, null); // Simplified

    if (error) {
        console.error(`Error loading shared content for token ${shareToken}:`, error);
        if (error.code === 'SHARE_INVALID' || error.code === 'NOT_FOUND') {
            throw svelteKitError(404, { message: error.message });
        }
        throw svelteKitError(500, { message: `Could not load shared content: ${error.message}` });
    }

    const session = await getSession(); // Get session to know if user is logged in

    return {
        shareToken: shareToken,
        shareInfo: shareInfo,   // Info about the share link itself
        rootFileNode: fileNode, // The actual file/folder item that was shared
        children: children || [], // Direct children if rootFileNode is a folder
        filePathParts: filePathParts, // For UI to build breadcrumbs etc.
        isOwnerViewing: session?.user?.id === shareInfo?.user_id, // Is the owner viewing their own share?
        session // Pass session for general UI conditional rendering
    };
};