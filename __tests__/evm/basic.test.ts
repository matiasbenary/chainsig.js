// @ts-nocheck - Disable TypeScript type checking for this file
import { describe, expect, it, jest } from '@jest/globals'
import {
  createPublicClient,
  http,
  parseEther,
  recoverMessageAddress,
  recoverTypedDataAddress,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'

import { EVM } from '../../src/chain-adapters/EVM/EVM'
import type { UserOperationV7 } from '../../src/chain-adapters/EVM/types'
import type { ChainSignatureContract } from '../../src/contracts/ChainSignatureContract'
import type { RSVSignature } from '../../src/types'

// Make BigInt serializable
if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function () {
      return this.toString()
    },
  })
}

describe('EVM Basic', () => {
  const privateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testAccount = privateKeyToAccount(privateKey)
  const rpcUrl = 'http://127.0.0.1:8545'

  const createMockContract = () => {
    return {
      sign: jest.fn().mockResolvedValue([
        {
          r: 'a'.repeat(64),
          s: 'b'.repeat(64),
          v: 27,
        },
      ]),
      getPublicKey: jest.fn().mockResolvedValue(`04${'a'.repeat(128)}`),
      getDerivedPublicKey: jest.fn().mockResolvedValue(`04${'a'.repeat(128)}`),
      contractId: 'test',
      networkId: 'testnet',
      provider: {},
      viewFunction: jest.fn().mockResolvedValue({}),
    } as any as ChainSignatureContract
  }

  it('should create an EVM instance', () => {
    const mockContract = createMockContract()

    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http(rpcUrl),
    })

    const evm = new EVM({
      contract: mockContract,
      publicClient,
    })

    expect(evm).toBeDefined()
  })

  it('should sign a message', async () => {
    const mockContract = createMockContract()
    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http(rpcUrl),
    })

    const evm = new EVM({
      contract: mockContract,
      publicClient,
    })

    const message = 'Hello, World!'
    const { hashToSign } = await evm.prepareMessageForSigning(message)

    expect(hashToSign).toBeDefined()
    expect(Array.isArray(hashToSign)).toBe(true)

    const signature = evm.finalizeMessageSigning({
      rsvSignature: {
        r: 'a'.repeat(64),
        s: 'b'.repeat(64),
        v: 27,
      } as RSVSignature,
    })

    expect(signature).toBeDefined()
  })

  it('should sign typed data', async () => {
    const mockContract = createMockContract()
    const publicClient = createPublicClient({
      chain: hardhat,
      transport: http(rpcUrl),
    })

    const evm = new EVM({
      contract: mockContract,
      publicClient,
    })

    const typedData = {
      domain: {
        name: 'Test',
        version: '1',
        chainId: hardhat.id,
        verifyingContract:
          '0x1234567890123456789012345678901234567890' as `0x${string}`,
      },
      types: {
        Person: [
          { name: 'name', type: 'string' },
          { name: 'wallet', type: 'address' },
        ],
      },
      primaryType: 'Person' as const,
      message: {
        name: 'Bob',
        wallet: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      },
    }

    const { hashToSign } = await evm.prepareTypedDataForSigning(typedData)

    expect(hashToSign).toBeDefined()
    expect(Array.isArray(hashToSign)).toBe(true)

    const signature = evm.finalizeTypedDataSigning({
      rsvSignature: {
        r: 'a'.repeat(64),
        s: 'b'.repeat(64),
        v: 27,
      } as RSVSignature,
    })

    expect(signature).toBeDefined()
  })

  it('should sign a transaction', async () => {
    const mockContract = createMockContract()

    const mockPublicClient = {
      getChainId: jest.fn().mockResolvedValue(1),
      getTransactionCount: jest.fn().mockResolvedValue(BigInt(0)),
      request: jest.fn().mockResolvedValue(undefined),
      getGasPrice: jest.fn().mockResolvedValue(BigInt(1000000000)),
      estimateGas: jest.fn().mockResolvedValue(BigInt(21000)),
      estimateFeesPerGas: jest.fn().mockResolvedValue({
        maxFeePerGas: BigInt('1000000000'),
        maxPriorityFeePerGas: BigInt('100000000'),
      }),
    } as any

    const evm = new EVM({
      contract: mockContract,
      publicClient: mockPublicClient,
    })

    const transactionInput = {
      from: testAccount.address,
      to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      value: parseEther('1'),
      maxFeePerGas: parseEther('0.001'),
      maxPriorityFeePerGas: parseEther('0.0001'),
      gas: 21000n,
      nonce: 0,
      type: 'eip1559' as const,
      chainId: hardhat.id,
      accessList: [],
    }

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning(transactionInput)

    expect(hashesToSign).toBeDefined()
    expect(Array.isArray(hashesToSign[0])).toBe(true)
    expect(transaction).toBeDefined()

    const tx = evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [
        {
          r: 'a'.repeat(64),
          s: 'b'.repeat(64),
          v: 27,
        } as RSVSignature,
      ],
    })

    expect(tx).toBeDefined()
  })

  it('should sign a user operation', async () => {
    const mockContract = createMockContract()

    const mockPublicClient = {
      getChainId: jest.fn().mockResolvedValue(1),
    } as any

    const evm = new EVM({
      contract: mockContract,
      publicClient: mockPublicClient,
    })

    const userOp: UserOperationV7 = {
      sender: '0x1234567890123456789012345678901234567890',
      nonce: '0x0',
      initCode: '0x',
      callData: '0x',
      callGasLimit: '0x5000',
      verificationGasLimit: '0x100000',
      preVerificationGas: '0x20000',
      maxFeePerGas: '0x3B9ACA00',
      maxPriorityFeePerGas: '0x3B9ACA00',
      paymasterAndData: '0x',
      signature: '0x',
    }

    const { hashToSign, userOp: resultUserOp } =
      await evm.prepareUserOpForSigning(userOp)

    expect(hashToSign).toBeDefined()
    expect(Array.isArray(hashToSign)).toBe(true)
    expect(resultUserOp).toBeDefined()

    const signedUserOp = evm.finalizeUserOpSigning({
      userOp: resultUserOp,
      rsvSignature: {
        r: 'a'.repeat(64),
        s: 'b'.repeat(64),
        v: 27,
      } as RSVSignature,
    })

    expect(signedUserOp).toBeDefined()
    expect(signedUserOp.signature).not.toBe('0x')
  })
})
