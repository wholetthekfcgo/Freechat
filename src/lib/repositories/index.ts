/**
 * Barrel export for repositories
 */

export { chatRepository, IndexedDBChatRepository } from './IndexedDBChatRepository';
export { RepositoryError } from './types';
export type { ChatRepository, Repository } from './types';
export type { ChatRepository as IChatRepository, Repository as IRepository } from './types';
