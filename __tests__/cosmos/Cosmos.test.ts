import { type EncodeObject } from '@cosmjs/proto-signing'
import { jest } from '@jest/globals'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'

import { Cosmos } from '../../src/chain-adapters/Cosmos/Cosmos'
import type {
  CosmosTransactionRequest,
  CosmosUnsignedTransaction,
} from '../../src/chain-adapters/Cosmos/types'
import {
  type ChainSignatureContract,
  type SignArgs,
} from '../../src/contracts/ChainSignatureContract'

// Mock elliptic related dependencies
jest.mock('elliptic', () => {
  class EC {
    curve: any

    constructor(curve: any) {
      this.curve = curve
    }

    keyFromPrivate(): any {
      return {
        getPublic: () => ({
          encode: () => Buffer.from('mock_public_key'),
          encodeCompressed: () => Buffer.from('mock_compressed_key'),
        }),
      }
    }

    keyFromPublic(): any {
      return {
        getPublic: () => ({
          encode: () => Buffer.from('mock_public_key'),
          encodeCompressed: () => Buffer.from('mock_compressed_key'),
        }),
        verify: () => true,
      }
    }
  }

  return {
    ec: EC,
  }
})

const mockContract = {
  getCurrentSignatureDeposit: () => 1,
  getDerivedPublicKey: async ({
    path,
    predecessor,
  }: {
    path: string
    predecessor: string
  }) => ('04' + '0'.repeat(128)) as `04${string}`,
  sign: async ({ payloads, path, keyType, signerAccount }: SignArgs) => [
    { r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 },
  ],
  contractId: 'test',
  networkId: 'testnet' as any,
  provider: {} as any,
  viewFunction: async (): Promise<object> => ({}),
  getPublicKey: async (): Promise<`04${string}`> =>
    ('04' + '0'.repeat(128)) as `04${string}`,
} as any as ChainSignatureContract

describe('Cosmos', () => {
  let cosmos: Cosmos

  beforeEach(() => {
    cosmos = new Cosmos({
      chainId: 'cosmoshub-4',
      contract: mockContract,
      endpoints: {
        rpcUrl: 'https://rpc.cosmos.network',
        restUrl: 'https://api.cosmos.network',
      },
    })
  })

  describe('deriveAddressAndPublicKey', () => {
    it('should derive address and public key', async () => {
      const predecessor = 'predecessor'
      const path: string = '0/0'

      const result = await cosmos.deriveAddressAndPublicKey(predecessor, path)

      expect(result).toEqual({
        address: expect.any(String),
        publicKey: expect.stringMatching(/^04/),
      })
    })
  })

  describe('prepareTransactionForSigning', () => {
    it('should prepare transfer transaction', async () => {
      // Create a proper CosmosTransactionRequest with the required fields
      const address = 'cosmos1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      const publicKey = '04'.padEnd(130, 'a')

      // Create a proper message for Cosmos
      const amount = '1000000'
      const recipient = 'cosmos1yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy'

      const msgSend: EncodeObject = {
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: MsgSend.encode({
          fromAddress: address,
          toAddress: recipient,
          amount: [{ denom: 'uatom', amount }],
        }).finish(),
      }

      const request: CosmosTransactionRequest = {
        address,
        publicKey,
        messages: [msgSend],
        memo: 'Test transaction',
        gas: 200000,
      }

      const result = await cosmos.prepareTransactionForSigning(request)

      expect(result).toEqual({
        transaction: expect.any(Object),
        hashesToSign: expect.any(Array),
      })
    })
  })

  it('should get balance', async () => {
    // Create a mock response with the minimum required properties
    const mockResponse = new Response(
      JSON.stringify({
        balances: [{ denom: 'uatom', amount: '1000000' }],
        pagination: { next_key: null, total: '1' },
      })
    )

    jest.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    const balance = await cosmos.getBalance(
      'cosmos1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    )
    expect(balance).toBeDefined()
  })

  // it('should create MPC payload and transaction', async () => {
  //   const request: CosmosTransactionRequest = {
  //     address: 'cosmos1...',
  //     publicKey: '04'.padEnd(130, 'a'),
  //     messages: [],
  //   };
  //   const { transaction, mpcPayloads } = await cosmos.getMPCPayloadAndTransaction(request);
  //   expect(transaction).toBeDefined();
  //   expect(mpcPayloads.length).toBeGreaterThan(0);
  // });

  it('should add signature to transaction', () => {
    const transaction: CosmosUnsignedTransaction = {
      bodyBytes: new Uint8Array(),
      authInfoBytes: new Uint8Array(),
      signatures: [],
    }
    const signedTx = cosmos.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [{ r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }],
    })
    expect(signedTx).toMatch(/^[0-9a-f]+$/i)
  })

  // it('should broadcast transaction', async () => {
  //   jest.spyOn(global, 'fetch').mockResolvedValue({
  //     ok: true,
  //     json: async () => ({ tx_response: { txhash: 'mock_tx_hash' } }),
  //   } as Response);

  //   const txHash = await cosmos.broadcastTx('mock_tx_serialized');
  //   expect(txHash).toBe('mock_tx_hash');
  // });
})
