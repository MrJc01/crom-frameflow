import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface FrameFlowVersioning extends DBSchema {
  assets: {
    key: string;
    value: {
      id: string;
      name: string;
      type: 'image' | 'video' | 'audio';
      blob: Blob;
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
      data: any; // Full Project JSON (Cards, Elements, etc.)
    };
    indexes: { 'by-date': number };
  };
}

class FrameFlowDB {
  private dbPromise: Promise<IDBPDatabase<FrameFlowVersioning>>;

  constructor() {
    this.dbPromise = openDB<FrameFlowVersioning>('frameflow-db', 1, {
      upgrade(db) {
        // Assets Store
        const assetStore = db.createObjectStore('assets', { keyPath: 'id' });
        assetStore.createIndex('by-date', 'dateAdded');

        // Projects Store
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-date', 'lastModified');
      },
    });
  }

  // --- Asset Operations ---

  async addAsset(file: File): Promise<string> {
    const id = crypto.randomUUID();
    const type = file.type.startsWith('image') ? 'image' : 
                 file.type.startsWith('video') ? 'video' : 'audio'; // Simplification
    
    await (await this.dbPromise).add('assets', {
      id,
      name: file.name,
      type: type as any,
      blob: file,
      dateAdded: Date.now(),
    });
    return id;
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

    await (await this.dbPromise).put('projects', {
      id,
      title: project.title || 'Untitled Project',
      lastModified: Date.now(),
      thumbnail,
      data: project
    });
    return id;
  }

  async getProjects() {
    return (await this.dbPromise).getAllFromIndex('projects', 'by-date');
  }
  
  async getProject(id: string) {
      return (await this.dbPromise).get('projects', id);
  }

  async deleteProject(id: string) {
    return (await this.dbPromise).delete('projects', id);
  }
}

export const db = new FrameFlowDB();
