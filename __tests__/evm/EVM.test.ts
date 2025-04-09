import { LocalAccountSigner } from '@aa-sdk/core'
import { alchemy, sepolia as alchemySepolia } from '@account-kit/infra'
import { createLightAccountAlchemyClient } from '@account-kit/smart-contracts'
import { describe, expect, it, jest } from '@jest/globals'
import { secp256k1 } from '@noble/curves/secp256k1'
import BN from 'bn.js'
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  recoverMessageAddress,
  recoverTypedDataAddress,
} from 'viem'
import type { PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { hardhat } from 'viem/chains'

import { EVM } from '../../src/chain-adapters/EVM/EVM'
import type { EVMTransactionRequest } from '../../src/chain-adapters/EVM/types'
import type {
  ChainSignatureContract,
  BaseChainSignatureContract,
} from '../../src/contracts/ChainSignatureContract'
import type { UncompressedPubKeySEC1 } from '../../src/types'

describe('EVM', () => {
  const privateKey =
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const testAccount = privateKeyToAccount(privateKey)
  const rpcUrl = 'http://127.0.0.1:8545'

  const publicClient = createPublicClient({
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const walletClient = createWalletClient({
    account: testAccount,
    chain: hardhat,
    transport: http(rpcUrl),
  })

  const contract: ChainSignatureContract = {
    sign: async ({ payload }) => {
      const messageBytes = new Uint8Array(payload)
      const privKeyBytes = new Uint8Array(
        Buffer.from(privateKey.slice(2), 'hex')
      )
      const { r, s, recovery } = secp256k1.sign(messageBytes, privKeyBytes)
      return {
        r: r.toString(16).padStart(64, '0'),
        s: s.toString(16).padStart(64, '0'),
        v: recovery + 27,
      }
    },
    getDerivedPublicKey: async () => {
      return '04' as UncompressedPubKeySEC1
    },
    getPublicKey: async () => {
      const pubKey = secp256k1.getPublicKey(
        Buffer.from(privateKey.slice(2), 'hex')
      )
      return ('04' +
        Buffer.from(pubKey.slice(1)).toString('hex')) as UncompressedPubKeySEC1
    },
    getCurrentSignatureDeposit: async () => new BN(0),
  }

  const evm = new EVM({
    contract,
    publicClient: createPublicClient({
      transport: http(rpcUrl),
    }),
  })

  it('should sign a message', async () => {
    const message = 'Hello, World!'
    const { hashToSign } = await evm.prepareMessageForSigning(message)

    const mpcSignature = await contract.sign({
      payload: hashToSign,
      path: '',
      key_version: 0,
    })

    const signature = evm.finalizeMessageSigning({
      rsvSignature: mpcSignature,
    })

    const walletSignature = await walletClient.signMessage({
      message,
    })

    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: walletSignature,
    })

    expect(recoveredAddress).toBe(testAccount.address)
    expect(signature).toBe(walletSignature)
  })

  it('should sign typed data', async () => {
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

    const mpcSignature = await contract.sign({
      payload: hashToSign,
      path: '',
      key_version: 0,
    })

    const signature = evm.finalizeTypedDataSigning({
      rsvSignature: mpcSignature,
    })

    const walletSignature = await walletClient.signTypedData(typedData)

    const recoveredAddress = await recoverTypedDataAddress({
      ...typedData,
      signature: walletSignature,
    })

    expect(recoveredAddress).toBe(testAccount.address)
    expect(signature).toBe(walletSignature)
  })

  it('should sign a transaction', async () => {
    await publicClient.request({
      // @ts-expect-error: hardhat_setBalance is valid as we are using a hardhat client
      method: 'hardhat_setBalance',
      params: [testAccount.address, '0x4563918244f400000000'], // 5 ETH
    })

    const transactionInput = {
      from: testAccount.address,
      to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
      value: parseEther('1'),
      maxFeePerGas: parseEther('0.001'),
      maxPriorityFeePerGas: parseEther('0.0001'),
      gas: 21000n,
      nonce: await publicClient.getTransactionCount({
        address: testAccount.address,
      }),
      type: 'eip1559' as const,
      chainId: hardhat.id,
      accessList: [],
    }

    const { hashesToSign, transaction } =
      await evm.prepareTransactionForSigning(transactionInput)

    const mpcSignature = await contract.sign({
      payload: hashesToSign[0],
      path: '',
      key_version: 0,
    })

    const tx = evm.finalizeTransactionSigning({
      transaction,
      rsvSignatures: [mpcSignature],
    })

    const walletSignature = await walletClient.signTransaction(transactionInput)

    expect(tx).toBe(walletSignature)

    const txHash = await evm.broadcastTx(tx)

    const txReceipt = await publicClient.getTransactionReceipt({
      hash: txHash,
    })

    expect(txReceipt.status).toBe('success')
  })

  it('should sign a user operation', async () => {
    const lightAccountClient = await createLightAccountAlchemyClient({
      transport: alchemy({ apiKey: 'er9VowLvLw2YQbgTaRLudG81JPxs77rT' }),
      chain: alchemySepolia,
      signer: LocalAccountSigner.privateKeyToAccountSigner(privateKey),
    })

    const userOp = {
      sender: testAccount.address,
      nonce: '0x0' as `0x${string}`,
      initCode: '0x' as `0x${string}`,
      callData: '0x' as `0x${string}`,
      callGasLimit: '0x5208' as `0x${string}`,
      verificationGasLimit: '0x5208' as `0x${string}`,
      preVerificationGas: '0x5208' as `0x${string}`,
      maxFeePerGas: '0x38d7ea4c68000' as `0x${string}`,
      maxPriorityFeePerGas: '0x5af3107a4000' as `0x${string}`,
      paymasterAndData: '0x' as `0x${string}`,
      signature: '0x' as `0x${string}`,
    }

    const { hashToSign } = await evm.prepareUserOpForSigning(
      userOp,
      '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
      11155111
    )

    const mpcSignature = await contract.sign({
      payload: hashToSign,
      path: '',
      key_version: 0,
    })

    const signedUserOp = evm.finalizeUserOpSigning({
      userOp,
      rsvSignature: mpcSignature,
    })

    const walletSignature = await lightAccountClient.signUserOperation({
      uoStruct: userOp,
    })

    expect(signedUserOp.signature).toBe(walletSignature.signature)
  })

  // TODO: Include test for v7 user operations.
})

describe('EVM Chain Adapter', () => {
  let evm: EVM
  let mockContract: jest.Mocked<BaseChainSignatureContract>
  let mockPublicClient: PublicClient

  beforeEach(() => {
    mockContract = {
      getDerivedPublicKey: jest.fn(),
    } as unknown as jest.Mocked<BaseChainSignatureContract>

    mockPublicClient = {
      getChainId: async () => await Promise.resolve(1),
      getTransactionCount: async () => await Promise.resolve(BigInt(0)),
      request: async () => await Promise.resolve(undefined),
    } as unknown as PublicClient

    evm = new EVM({
      contract: mockContract,
      publicClient: mockPublicClient,
    })
  })

  describe('prepareTransactionForSigning', () => {
    it('should prepare transfer transaction', async () => {
      const request: EVMTransactionRequest = {
        from: '0x1234567890123456789012345678901234567890',
        to: '0x0987654321098765432109876543210987654321',
        value: BigInt('1000000000000000000'), // 1 ETH
        gas: BigInt('21000'),
        maxFeePerGas: BigInt('100000000000'),
        maxPriorityFeePerGas: BigInt('1000000000'),
      }

      const result = await evm.prepareTransactionForSigning(request)

      expect(result).toEqual({
        transaction: expect.objectContaining({
          from: request.from,
          to: request.to,
          value: request.value,
          gas: request.gas,
          maxFeePerGas: request.maxFeePerGas,
          maxPriorityFeePerGas: request.maxPriorityFeePerGas,
        }),
        hashesToSign: expect.any(Array),
      })
    })
  })
})
