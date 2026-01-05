import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ProjectTemplate } from '../types';

interface TemplateDB extends DBSchema {
  templates: {
    key: string;
    value: ProjectTemplate;
    indexes: { 'by-date': number };
  };
}

const DB_NAME = 'frameflow-templates';
const DB_VERSION = 1;

class TemplateService {
  private dbPromise: Promise<IDBPDatabase<TemplateDB>>;

  constructor() {
    this.dbPromise = openDB<TemplateDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('templates', { keyPath: 'id' });
        store.createIndex('by-date', 'createdAt');
      },
    });
  }

  async saveTemplate(template: ProjectTemplate): Promise<void> {
    const db = await this.dbPromise;
    await db.put('templates', template);
  }

  async loadTemplate(id: string): Promise<ProjectTemplate | undefined> {
    const db = await this.dbPromise;
    return await db.get('templates', id);
  }

  async listTemplates(): Promise<ProjectTemplate[]> {
    const db = await this.dbPromise;
    return await db.getAllFromIndex('templates', 'by-date');
  }

  async deleteTemplate(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete('templates', id);
  }
}

export const templateService = new TemplateService();
