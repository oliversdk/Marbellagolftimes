import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContractParserService } from './contractParser'
import { db } from '../db'
import { ObjectStorageService } from '../objectStorage'
import OpenAI from 'openai' // Import the mocked version
import { extractText, getDocumentProxy } from 'unpdf'

// Mock the 'openai' module. This is hoisted.
vi.mock('openai', () => {
  // Define the mock function inside the factory to avoid hoisting issues.
  const mockCreate = vi.fn()

  // Define a mock class for OpenAI.
  const MockOpenAI = class {
    // Expose the mock function via a static property for test access.
    static _mockCreate = mockCreate
    chat = {
      completions: {
        create: mockCreate,
      },
    }
  }
  return {
    default: MockOpenAI,
  }
})

describe('ContractParserService', () => {
  let contractParserService: ContractParserService
  let mockDb: any
  let mockObjectStorageService: any
  let mockOpenAICreate: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Get a reference to the exposed mock function and reset it.
    mockOpenAICreate = (OpenAI as any)._mockCreate
    mockOpenAICreate.mockReset()

    mockDb = db
    mockObjectStorageService = new (ObjectStorageService as any)()

    contractParserService = new ContractParserService()
    ;(contractParserService as any).objectStorage = mockObjectStorageService

    vi.mocked(mockObjectStorageService.getPrivateFile).mockResolvedValue(
      Buffer.from(''),
    )
    vi.mocked(getDocumentProxy).mockResolvedValue({} as any)
    vi.mocked(extractText).mockResolvedValue({ text: 'pdf text' })
    vi.mocked(mockDb.select).mockReturnThis()
    vi.mocked(mockDb.from).mockReturnThis()
    vi.mocked(mockDb.where).mockResolvedValue([
      { id: 'doc-id', fileUrl: 'test-url' },
    ])
  })

  it('should be defined', () => {
    expect(contractParserService).toBeDefined()
  })

  describe('processDocument', () => {
    it('should process a document successfully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [
          { message: { content: JSON.stringify({ ratePeriods: [], contacts: [] }) } },
        ],
      })
      const result = await contractParserService.processDocument('doc-id')
      expect(result).toBeDefined()
      expect(result.ingestionId).toBe('ingestion-id')
      expect(result.ratePeriods).toBe(0)
      expect(result.contacts).toBe(0)
      expect(mockDb.insert).toHaveBeenCalledTimes(1)
      expect(mockDb.update).toHaveBeenCalledTimes(2)
    })

    it('should throw an error if the document is not found', async () => {
      vi.mocked(mockDb.where).mockResolvedValue([])
      await expect(
        contractParserService.processDocument('doc-id'),
      ).rejects.toThrow('Document not found: doc-id')
    })

    it('should handle AI parsing errors', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('AI error'))
      await expect(
        contractParserService.processDocument('doc-id'),
      ).rejects.toThrow('AI parsing failed: Error: AI error')
      expect(mockDb.update).toHaveBeenCalledWith(expect.any(Object))
    })
  })
})
