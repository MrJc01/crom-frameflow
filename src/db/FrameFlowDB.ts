import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { compressData, decompressData } from '../utils/compression';

interface FrameFlowVersioning extends DBSchema {
  assets: {
    key: string;
    value: {
      id: string;
      name: string;
      type: 'image' | 'video' | 'audio';
      blob?: Blob; // Optional if path is present
      path?: string; // Local filesystem path (Tauri)
      proxyPath?: string; // Path to generated low-res proxy
      fileHandle?: FileSystemFileHandle; // File System Access API
      metadata?: {
          width: number;
          height: number;
          duration: number;
      };
      dateAdded: number;
    };
    indexes: { 'by-date': number };
  };
  projects: {
    key: string;
    value: {
      id: string;
      title: string;
      lastModified: number;
      thumbnail?: string; // Base64 thumbnail for quick list view
      data: any; // Full Project JSON (or Blob if compressed)
    };
    indexes: { 'by-date': number };
  };
}

class FrameFlowDB {
  private dbPromise: Promise<IDBPDatabase<FrameFlowVersioning>>;

  constructor() {
    this.dbPromise = openDB<FrameFlowVersioning>('frameflow-db', 2, { // Version bump to 2
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
            // Assets Store
            const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
            assetStore.createIndex('by-date', 'dateAdded');

            // Projects Store
            const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
            projectStore.createIndex('by-date', 'lastModified');
        }
        // Future migrations handle here
      },
    });
  }

  // --- Asset Operations ---

  async addAsset(file: File, path?: string, metadata?: { width: number, height: number, duration: number }, fileHandle?: FileSystemFileHandle, proxyPath?: string): Promise<string> {
    const id = crypto.randomUUID();
    const type = file.type.startsWith('image') ? 'image' : 
                 file.type.startsWith('video') ? 'video' : 'audio'; // Simplification
    
    // If we have a handle or path, we can skip storing the blob to save space 
    // IF we are sure we can retrieve it. 
    // For handles, we need permission, so maybe keep blob as fallback?
    // Actually, zero-copy goal implies NOT storing blob.
    const shouldStoreBlob = !path && !fileHandle;

    await (await this.dbPromise).add('assets', {
      id,
      name: file.name,
      type: type as any,
      blob: shouldStoreBlob ? file : undefined,
      path,
      proxyPath,
      fileHandle,
      metadata,
      dateAdded: Date.now(),
    });
    return id;
  }

  async updateAsset(id: string, updates: Partial<FrameFlowVersioning['assets']['value']>) {
    const db = await this.dbPromise;
    const tx = db.transaction('assets', 'readwrite');
    const store = tx.objectStore('assets');
    const asset = await store.get(id);
    if (asset) {
        await store.put({ ...asset, ...updates });
    }
    await tx.done;
  }

  async getAsset(id: string) {
    return (await this.dbPromise).get('assets', id);
  }

  async getAllAssets() {
    return (await this.dbPromise).getAllFromIndex('assets', 'by-date');
  }

  async deleteAsset(id: string) {
    return (await this.dbPromise).delete('assets', id);
  }

  // --- Project Operations ---

  async saveProject(project: any, thumbnail?: string) {
    const id = project.id || crypto.randomUUID();
    // Ensure project has ID
    project.id = id; 

    let dataToStore = project;
    try {
        dataToStore = await compressData(project);
    } catch (e) {
        console.warn("Compression failed, storing uncompressed", e);
    }

    await (await this.dbPromise).put('projects', {
      id,
      title: project.title || 'Untitled Project',
      lastModified: Date.now(),
      thumbnail,
      data: dataToStore
    });
    return id;
  }

  async getProjects() {
    return (await this.dbPromise).getAllFromIndex('projects', 'by-date');
  }
  
  async getProject(id: string) {
      const record = await (await this.dbPromise).get('projects', id);
      if (record && record.data instanceof Blob) {
           try {
              record.data = await decompressData(record.data);
           } catch(e) {
              console.error("Decompression failed", e);
           }
      }
      return record;
  }

  async deleteProject(id: string) {
    return (await this.dbPromise).delete('projects', id);
  }
}

export const db = new FrameFlowDB();
