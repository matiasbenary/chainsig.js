import { type CodeResult } from '@near-js/types'
import {
  type FinalExecutionOutcome,
  type Wallet,
} from '@near-wallet-selector/core'
import { najToUncompressedPubKeySEC1 } from '@utils/cryptography'
import BN from 'bn.js'
import { providers } from 'near-api-js'

import {
  ChainSignatureContract as AbstractChainSignatureContract,
  type SignArgsBitcoin,
  type PayloadV2Args,
  type SignArgs,
} from '@contracts/ChainSignatureContract'
import {
  type RSVSignature,
  type UncompressedPubKeySEC1,
  type NajPublicKey,
  type Ed25519Signature,
} from '@types'

import { NEAR_MAX_GAS } from './constants'
import { responseToMpcSignature } from './transaction'
import { type NearNetworkIds } from './types'

interface ViewMethodParams {
  method: string
  args?: Record<string, unknown>
}

export class ChainSignatureContractWallet extends AbstractChainSignatureContract {
  private readonly wallet: Wallet
  private readonly contractId: string
  private readonly networkId: NearNetworkIds
  private readonly provider: providers.FailoverRpcProvider

  constructor({
    wallet,
    contractId,
    networkId,
    fallbackRpcUrls,
  }: {
    wallet: Wallet
    contractId: string
    networkId: NearNetworkIds
    fallbackRpcUrls?: string[]
  }) {
    super()
    this.wallet = wallet
    this.contractId = contractId
    this.networkId = networkId

    const rpcProviderUrls =
      fallbackRpcUrls && fallbackRpcUrls.length > 0
        ? fallbackRpcUrls
        : [`https://rpc.${this.networkId}.near.org`]

    this.provider = new providers.FailoverRpcProvider(
      rpcProviderUrls.map((url) => new providers.JsonRpcProvider({ url }))
    )
  }

  async viewFunction(params: {
    method: 'public_key'
    args?: Record<string, unknown>
  }): Promise<NajPublicKey>
  async viewFunction(params: {
    method: 'experimental_signature_deposit'
    args?: Record<string, unknown>
  }): Promise<number>
  async viewFunction(params: {
    method: 'derived_public_key'
    args: { path: string; predecessor: string; domain_id?: number }
  }): Promise<NajPublicKey | `Ed25519:${string}`>
  async viewFunction({
    method,
    args = {},
  }: ViewMethodParams): Promise<unknown> {
    const res = await this.provider.query<CodeResult>({
      request_type: 'call_function',
      account_id: this.contractId,
      method_name: method,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
      finality: 'optimistic',
    })

    return JSON.parse(Buffer.from(res.result).toString())
  }

  async getCurrentSignatureDeposit(): Promise<BN> {
    return new BN(
      (
        await this.viewFunction({
          method: 'experimental_signature_deposit',
        })
      ).toLocaleString('fullwide', {
        useGrouping: false,
      })
    )
  }

  async sign(
    args: SignArgsBitcoin & Record<string, unknown>
  ): Promise<RSVSignature[]>
  async sign(
    args: PayloadV2Args & Record<string, unknown>
  ): Promise<Ed25519Signature>
  async sign(args: SignArgs & Record<string, unknown>): Promise<RSVSignature>
  async sign(
    args: (SignArgs | PayloadV2Args | SignArgsBitcoin) &
      Record<string, unknown>,
    options?: { nonce?: number }
  ): Promise<RSVSignature | Ed25519Signature | RSVSignature[]> {
    if (
      args.payload &&
      Array.isArray(args.payload) &&
      Array.isArray(args.payload[0])
    ) {
      const mpcTransactions = args.payload.map((hash) => ({
        receiverId: this.contractId,
        actions: [
          {
            type: 'FunctionCall' as const,
            params: {
              methodName: 'sign',
              args: {
                request: {
                  payload: hash,
                  path: args.path,
                  key_version: 0,
                },
              },
              gas: '250000000000000',
              deposit: '1',
            },
          },
        ],
      }))

      const sentTxs = (await this.wallet.signAndSendTransactions({
        transactions: mpcTransactions,
      })) as FinalExecutionOutcome[]

      const rsvSignatures = sentTxs.map((tx) =>
        responseToMpcSignature({ response: tx })
      )
      return rsvSignatures as RSVSignature[]
    }

    const result = (await this.wallet.signAndSendTransaction({
      receiverId: this.contractId,
      actions: [
        {
          type: 'FunctionCall',
          params: {
            methodName: 'sign',
            args,
            gas: NEAR_MAX_GAS.toString(),
            deposit: '1',
          },
        },
      ],
    })) as FinalExecutionOutcome

    const signature = responseToMpcSignature({ response: result })

    if (!signature) {
      throw new Error('Transaction failed')
    }

    return signature as RSVSignature
  }

  async getPublicKey(): Promise<UncompressedPubKeySEC1> {
    const najPubKey = await this.viewFunction({
      method: 'public_key',
    })
    return najToUncompressedPubKeySEC1(najPubKey)
  }

  async getDerivedPublicKey(args: {
    path: string
    predecessor: string
    IsEd25519?: boolean
  }): Promise<UncompressedPubKeySEC1 | `Ed25519:${string}`> {
    if (args.IsEd25519) {
      return (await this.viewFunction({
        method: 'derived_public_key',
        args: {
          path: args.path,
          predecessor: args.predecessor,
          domain_id: 1,
        },
      })) as `Ed25519:${string}`
    }

    const najPubKey = (await this.viewFunction({
      method: 'derived_public_key',
      args,
    })) as NajPublicKey
    return najToUncompressedPubKeySEC1(najPubKey)
  }
}
