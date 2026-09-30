import { validateProfileImage } from './shared/profile-assets';
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('screenplay-project-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function importProjectImage(projectId: string, dataUrl: string) {
  validateProfileImage(dataUrl);
  const id = crypto.randomUUID(), db = await database();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('images', 'readwrite'); tx.objectStore('images').put(dataUrl, `${projectId}:${id}`); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); return id; } finally { db.close(); }
}
export async function readProjectImage(projectId: string, assetId: string) {
  const db = await database();
  try { return await new Promise<string>((resolve, reject) => { const request = db.transaction('images').objectStore('images').get(`${projectId}:${assetId}`); request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error('Image unavailable.')); request.onerror = () => reject(request.error); }); } finally { db.close(); }
}
