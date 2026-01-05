/// <reference types="wicg-file-system-access" />

/**
 * Service to handle File System Access API operations.
 * Allows Zero-Copy file loading by persisting handles instead of blobs.
 */

export class FileSystemService {
  /**
   * Check if the API is supported
   */
  static isSupported(): boolean {
    return 'showOpenFilePicker' in window;
  }

  /**
   * Open file picker requesting specific types
   */
  static async openFile(options?: OpenFilePickerOptions): Promise<{ file: File, handle: FileSystemFileHandle } | null> {
    if (!this.isSupported()) {
      throw new Error('File System Access API not supported');
    }

    try {
      const [handle] = await window.showOpenFilePicker(options);
      const file = await handle.getFile();
      return { file, handle };
    } catch (err: any) {
      if (err.name === 'AbortError') return null; // User cancelled
      throw err;
    }
  }

  /**
   * Verify permission for a handle, asking user if needed
   */
  static async verifyPermission(handle: FileSystemHandle, readWrite: boolean = false): Promise<boolean> {
    const options: FileSystemHandlePermissionDescriptor = {
      mode: readWrite ? 'readwrite' : 'read'
    };

    if ((await handle.queryPermission(options)) === 'granted') {
      return true;
    }

    if ((await handle.requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  }

  // --- Tauri Bridge ---
  static async saveToBackend(path: string, content: string): Promise<void> {
      try {
           // Dynamic import to allow running in browser mode without Tauri errors on load
           const { invoke } = await import('@tauri-apps/api/core');
           await invoke('save_project_file', { path, content });
      } catch (e) {
          console.error("Failed to save via Tauri backend", e);
          throw e;
      }
  }
}
