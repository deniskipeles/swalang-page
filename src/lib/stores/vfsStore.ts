import { writable, get } from 'svelte/store';
import * as vfs from '$lib/services/fileSystemService';
import type { FileNode, VfsError } from '$lib/services/fileSystemService';

// Define the shape of our store's state
export interface VfsState {
  nodesByParentId: Record<string, FileNode[]>; // Key: parent_id ('root' for null)
  loading: Record<string, boolean>;          // Loading state per parent_id
  errors: Record<string, VfsError | null>;   // Error state per parent_id
  isPerformingAction: boolean;              // Global flag for CUD operations
}

const initialState: VfsState = {
  nodesByParentId: { root: [] }, // Initialize root
  loading: { root: false },
  errors: { root: null },
  isPerformingAction: false,
};

// Create the underlying writable store
const { subscribe, update, set } = writable<VfsState>(initialState);

// --- Helper Functions ---
function getParentKey(parentId: string | null): string {
    return parentId === null ? 'root' : parentId;
}

// --- Store Actions (Public Interface) ---

/**
 * Loads nodes for a given parent ID (or root if null).
 * Fetches from API if not already loaded or if forced.
 */
async function loadNodes(parentId: string | null, forceReload: boolean = false) {
    const parentKey = getParentKey(parentId);
    const currentState = get({ subscribe }); // Get current state non-reactively

    // Don't reload if already loading or already loaded (unless forced)
    if (currentState.loading[parentKey] || (currentState.nodesByParentId[parentKey] && !forceReload)) {
        return;
    }

    update(state => ({
        ...state,
        loading: { ...state.loading, [parentKey]: true },
        errors: { ...state.errors, [parentKey]: null },
    }));

    const { data, error } = await vfs.listFiles(undefined, parentId);

    update(state => ({
        ...state,
        nodesByParentId: { ...state.nodesByParentId, [parentKey]: data || [] },
        loading: { ...state.loading, [parentKey]: false },
        errors: { ...state.errors, [parentKey]: error || null },
    }));
}

/**
 * Creates a file or folder via the API and updates the store.
 */
async function createNodeWrapper(details: {
    name: string,
    content?: string | null,
    is_folder: boolean,
    parent_id: string | null
    user_id: string | null
}): Promise<{ success: boolean, error?: VfsError }> {
    update(state => ({ ...state, isPerformingAction: true }));
    const { data: newNode, error } = await vfs.createFile(undefined, details);
    let success = false;

    if (newNode) {
        const parentKey = getParentKey(details.parent_id);
        // Add the new node to the correct parent list in the store
        update(state => {
            const parentNodes = state.nodesByParentId[parentKey] || [];
            // Add and sort (folders first, then alpha)
            const updatedNodes = [...parentNodes, newNode].sort((a, b) => {
                 if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
                 return a.name.localeCompare(b.name);
            });
            return {
                ...state,
                nodesByParentId: { ...state.nodesByParentId, [parentKey]: updatedNodes },
            };
        });
        success = true;
    }

    update(state => ({ ...state, isPerformingAction: false }));
    return { success, error };
}

/**
 * Updates a file/folder name via the API and updates the store.
 */
async function renameNodeWrapper(nodeId: string, newName: string): Promise<{ success: boolean, error?: VfsError }> {
    update(state => ({ ...state, isPerformingAction: true }));
    const { data: updatedNode, error } = await vfs.updateFile(undefined, nodeId, { name: newName });
    let success = false;

    if (updatedNode) {
         const parentKey = getParentKey(updatedNode.parent_id);
        // Find and update the node within its parent list
        update(state => {
             const parentNodes = state.nodesByParentId[parentKey] || [];
             const nodeIndex = parentNodes.findIndex(n => n.id === nodeId);
             if (nodeIndex === -1) return state; // Node not found (shouldn't happen ideally)

             const updatedNodes = [...parentNodes];
             updatedNodes[nodeIndex] = updatedNode; // Replace with updated data
             // Re-sort if name change affected order
             updatedNodes.sort((a, b) => {
                 if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1;
                 return a.name.localeCompare(b.name);
             });

             return {
                ...state,
                nodesByParentId: { ...state.nodesByParentId, [parentKey]: updatedNodes },
             };
        });
        success = true;
    }

     update(state => ({ ...state, isPerformingAction: false }));
     return { success, error };
}

/**
 * Deletes a file/folder via the API and updates the store.
 */
async function deleteNodeWrapper(nodeId: string, parentId: string | null): Promise<{ success: boolean, error?: VfsError }> {
    update(state => ({ ...state, isPerformingAction: true }));
    const { error } = await vfs.deleteFile(undefined, nodeId);
    let success = false;

    if (!error) {
        const parentKey = getParentKey(parentId);
        // Remove the node from its parent list
        update(state => {
            const parentNodes = state.nodesByParentId[parentKey] || [];
            const updatedNodes = parentNodes.filter(n => n.id !== nodeId);
             return {
                ...state,
                nodesByParentId: { ...state.nodesByParentId, [parentKey]: updatedNodes },
             };
        });
        success = true;
    }

     update(state => ({ ...state, isPerformingAction: false }));
     return { success, error };
}

// --- Export the custom store interface ---
export const vfsStore = {
  subscribe,
  loadNodes,
  createNode: createNodeWrapper, // Renamed for clarity from component perspective
  renameNode: renameNodeWrapper,
  deleteNode: deleteNodeWrapper,
  // Expose helper if needed by components, e.g., to reset state
  reset: () => set(initialState)
};

// Type helper for components using the store's value
export type VfsStoreValue = VfsState;