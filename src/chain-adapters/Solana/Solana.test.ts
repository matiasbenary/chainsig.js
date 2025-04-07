import { jest } from '@jest/globals'
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { Solana } from './Solana'
import { BaseChainSignatureContract } from '../../contracts/ChainSignatureContract'
import { KeyDerivationPath, UncompressedPubKeySEC1 } from '../../types'

describe('Solana Chain Adapter', () => {
  let solana: Solana
  let mockConnection: jest.Mocked<Connection>
  let mockContract: jest.Mocked<BaseChainSignatureContract>

  beforeEach(() => {
    mockConnection = {
      getBalance: jest.fn(),
      getLatestBlockhash: jest.fn(),
      sendRawTransaction: jest.fn(),
    } as unknown as jest.Mocked<Connection>

    mockContract = {
      getDerivedPublicKey: jest.fn(),
    } as unknown as jest.Mocked<BaseChainSignatureContract>

    solana = new Solana({
      connection: mockConnection,
      contract: mockContract,
    })
  })

  describe('getBalance', () => {
    it('should return balance and decimals', async () => {
      const address = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'
      const expectedBalance = 1000000000n // 1 SOL in lamports

      mockConnection.getBalance.mockResolvedValue(Number(expectedBalance))

      const result = await solana.getBalance(address)

      expect(result).toEqual({
        balance: expectedBalance,
        decimals: 9,
      })
      expect(mockConnection.getBalance).toHaveBeenCalledWith(
        new PublicKey(address)
      )
    })
  })

  describe('deriveAddressAndPublicKey', () => {
    it('should derive address and public key', async () => {
      const predecessor = 'predecessor'
      const path: KeyDerivationPath = { index: 0, scheme: 'ed25519' }
      const mockPubKey = ('04' + '0'.repeat(128)) as UncompressedPubKeySEC1
      const expectedAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'

      mockContract.getDerivedPublicKey.mockResolvedValue(mockPubKey)

      const result = await solana.deriveAddressAndPublicKey(predecessor, path)

      expect(result).toEqual({
        address: expect.any(String),
        publicKey: mockPubKey,
      })
      expect(mockContract.getDerivedPublicKey).toHaveBeenCalledWith({
        path,
        predecessor,
      })
    })
  })

  describe('transaction serialization', () => {
    const mockTransaction = {
      transaction: new Transaction(),
      feePayer: new PublicKey('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'),
      recentBlockhash: 'mockBlockhash',
    }

    it('should serialize and deserialize transaction', () => {
      const serialized = solana.serializeTransaction(mockTransaction)
      const deserialized = solana.deserializeTransaction(serialized)

      expect(deserialized).toEqual(
        expect.objectContaining({
          feePayer: expect.any(Object),
          recentBlockhash: mockTransaction.recentBlockhash,
        })
      )
    })
  })

  describe('prepareTransactionForSigning', () => {
    it('should prepare transfer transaction', async () => {
      const request = {
        from: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        to: 'GrAkKfEpTKQuVHG2Y97Y2FF4i7y7Q5AHLK94JBy7Y5yv',
        amount: 1000000000n, // 1 SOL
      }

      const mockBlockhash = 'mockBlockhash'
      mockConnection.getLatestBlockhash.mockResolvedValue({
        blockhash: mockBlockhash,
        lastValidBlockHeight: 123456789,
      })

      const result = await solana.prepareTransactionForSigning(request)

      expect(result).toEqual({
        transaction: expect.objectContaining({
          recentBlockhash: mockBlockhash,
          feePayer: new PublicKey(request.from),
        }),
        hashesToSign: expect.arrayContaining([expect.any(Array)]),
      })
    })
  })

  describe('finalizeTransactionSigning', () => {
    it('should throw error for unimplemented signature conversion', () => {
      const mockTransaction = {
        transaction: new Transaction(),
        feePayer: new PublicKey('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'),
        recentBlockhash: 'mockBlockhash',
      }

      expect(() =>
        solana.finalizeTransactionSigning({
          transaction: mockTransaction,
          rsvSignatures: [{ r: '0x', s: '0x', v: 0 }],
        })
      ).toThrow('Not implemented')
    })
  })

  describe('broadcastTx', () => {
    it('should broadcast transaction', async () => {
      const mockTxHash = 'mockTxHash'
      mockConnection.sendRawTransaction.mockResolvedValue(mockTxHash)

      const serializedTx = solana.serializeTransaction({
        transaction: new Transaction(),
        feePayer: new PublicKey('DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK'),
        recentBlockhash: 'mockBlockhash',
      })

      const result = await solana.broadcastTx(serializedTx)

      expect(result).toBe(mockTxHash)
      expect(mockConnection.sendRawTransaction).toHaveBeenCalled()
    })
  })
})
