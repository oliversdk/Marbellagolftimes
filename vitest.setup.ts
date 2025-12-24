import { vi } from 'vitest'

class MockedObjectStorageService {
  getPrivateFile = vi.fn()
}

vi.mock('./server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'ingestion-id' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn(),
  },
}))

vi.mock('./server/objectStorage', () => ({
  ObjectStorageService: MockedObjectStorageService,
}))

vi.mock('unpdf', () => ({
  extractText: vi.fn(),
  getDocumentProxy: vi.fn(),
}))
