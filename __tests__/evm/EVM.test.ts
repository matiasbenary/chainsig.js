import { jest } from '@jest/globals'
// import BN from 'bn.js'
import { config } from 'dotenv'
import { http } from 'viem'
import { mainnet } from 'viem/chains'

// import { BaseChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
// import type { KeyDerivationPath, RSVSignature } from '../../src/types'

config()

const mockPublicClientFunctions = {
  getChainId: jest.fn<() => Promise<number>>().mockResolvedValue(1),
  getTransactionCount: jest
    .fn<() => Promise<bigint>>()
    .mockResolvedValue(BigInt(0)),
  getBalance: jest
    .fn<() => Promise<bigint>>()
    .mockResolvedValue(BigInt('1000000000000000000')),
  estimateGas: jest
    .fn<() => Promise<bigint>>()
    .mockResolvedValue(BigInt('21000')),
  estimateFeesPerGas: jest
    .fn<() => Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }>>()
    .mockResolvedValue({
      maxFeePerGas: BigInt('1000000000'),
      maxPriorityFeePerGas: BigInt('1000000000'),
    }),
}

jest.unstable_mockModule('viem', () => ({
  createPublicClient: jest.fn().mockReturnValue({
    ...mockPublicClientFunctions,
    chain: mainnet,
    account: undefined,
    batch: undefined,
    cacheTime: 0,
    ccipRead: false,
    key: 'public',
    name: 'Public Client',
    pollingInterval: 4000,
    transport: http(),
    type: 'public',
    uid: 'public-client',
  }),
  http: jest.fn(),
}))

// class MockChainSignatureContract extends BaseChainSignatureContract {
//   async getCurrentSignatureDeposit(): Promise<BN> {
//     return new BN(BigInt(0).toString())
//   }

//   async getDerivedPublicKey(
//     args: { path: KeyDerivationPath; predecessor: string } & Record<
//       string,
//       unknown
//     >
//   ): Promise<`04${string}`> {
//     return `04${'a'.repeat(128)}`
//   }

//   async sign(): Promise<RSVSignature> {
//     return { r: 'a'.repeat(64), s: 'b'.repeat(64), v: 27 }
//   }

//   async getPublicKey(): Promise<`04${string}`> {
//     return '04'.padEnd(130, 'a') as `04${string}`
//   }
// }

// describe('EVM', () => {
//   let evm: EVM
//   let mockChainSignatureContract: MockChainSignatureContract

//   beforeEach(() => {
//     mockChainSignatureContract = new MockChainSignatureContract()
//     evm = new evm({
//       chainSignatureContract: mockChainSignatureContract,
//     })
//   })
// })
