import { jest } from '@jest/globals'

import { Mempool } from '../../src/chain-adapters/Bitcoin/BTCRpcAdapter/Mempool'

// Mock fetch
const mockFetch = jest.fn()
// @ts-expect-error - Ignoring type issues with the mock
global.fetch = mockFetch

// Define a proper mock response type
interface MockResponse {
  ok: boolean
  json: () => Promise<any>
  text: () => Promise<string>
}

// Helper function to create mock responses
function createMockResponse(response: any, ok = true): MockResponse {
  return {
    ok,
    json: async () => response,
    text: async () =>
      typeof response === 'string' ? response : JSON.stringify(response),
  }
}

// Update the mock implementation
mockFetch.mockImplementation(async (url, options) => {
  return await Promise.resolve(createMockResponse({}))
})

describe('Mempool BTCRpcAdapter', () => {
  let mempool: Mempool

  beforeEach(() => {
    mempool = new Mempool('https://mempool.space/api')
    mockFetch.mockClear()
  })

  describe('selectUTXOs', () => {
    it('should select appropriate UTXOs for transaction', async () => {
      const mockUTXOs = [
        { txid: 'tx1', vout: 0, value: 100000 },
        { txid: 'tx2', vout: 1, value: 200000 },
      ]

      // @ts-expect-error - Ignoring type issues with the mock
      mockFetch.mockResolvedValueOnce(createMockResponse(mockUTXOs))
      // Mock the fee rate response
      // @ts-expect-error - Ignoring type issues with the mock
      mockFetch.mockResolvedValueOnce(createMockResponse({ hourFee: 10 }))

      const result = await mempool.selectUTXOs('address', [{ value: 50000 }])
      expect(result.inputs).toHaveLength(1)
      // coinselect adds a change output when there's excess funds
      expect(result.outputs).toHaveLength(2)
      // First output should be our target
      expect(result.outputs[0].value).toBe(50000)
    })
  })

  describe('getBalance', () => {
    it('should fetch and return correct balance', async () => {
      const mockBalance = {
        chain_stats: {
          funded_txo_sum: 1000000,
          spent_txo_sum: 500000,
        },
      }

      // @ts-expect-error - Ignoring type issues with the mock
      mockFetch.mockResolvedValueOnce(createMockResponse(mockBalance))

      const result = await mempool.getBalance('address')
      expect(result).toBe(500000)
    })
  })

  describe('broadcastTransaction', () => {
    it('should broadcast transaction successfully', async () => {
      const txHex = '0123456789abcdef'
      const txId = 'txid123'

      // @ts-expect-error - Ignoring type issues with the mock
      mockFetch.mockResolvedValueOnce(createMockResponse(txId))

      const result = await mempool.broadcastTransaction(txHex)

      expect(result).toBe(txId)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://mempool.space/api/tx',
        expect.objectContaining({
          method: 'POST',
          body: txHex,
        })
      )
    })

    it('should handle broadcast errors', async () => {
      const txHex = '0123456789abcdef'
      const errorMessage = 'Transaction rejected'

      // @ts-expect-error - Ignoring type issues with the mock
      mockFetch.mockResolvedValueOnce(createMockResponse(errorMessage, false))

      await expect(mempool.broadcastTransaction(txHex)).rejects.toThrow(
        errorMessage
      )
    })
  })
})
