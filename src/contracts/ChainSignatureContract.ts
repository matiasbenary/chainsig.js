import type BN from 'bn.js'

import type {
  RSVSignature,
  UncompressedPubKeySEC1,
  Ed25519PubKey,
  DerivedPublicKeyArgs,
} from '../types'

export interface ArgsEd25519 extends DerivedPublicKeyArgs {
  IsEd25519: boolean
}

export type Payload = number[]

export interface SignArgs {
  /** The payload to sign as an array of 32 bytes */
  payload: number[]
  /** The derivation path for key generation */
  path: string
  /** Version of the key to use */
  key_version: number
}

export interface SignArgsBitcoin {
  /** The payload to sign as an array of 32 bytes */
  payload: number[][]
  /** The derivation path for key generation */
  path: string
  /** Version of the key to use */
  key_version: number
}
export interface PayloadV2Args {
  payload_v2: { Eddsa: string }
  path: string
  domain_id: number
}
/**
 * Base contract interface required for compatibility with ChainAdapter instances like EVM and Bitcoin.
 *
 * See {@link EVM} and {@link Bitcoin} for example implementations.
 */
export abstract class BaseChainSignatureContract {
  /**
   * Gets the current signature deposit required by the contract.
   * This deposit amount helps manage network congestion.
   *
   * @returns Promise resolving to the required deposit amount as a BigNumber
   */
  abstract getCurrentSignatureDeposit(): Promise<BN>

  /**
   * Gets the derived public key for a given path and predecessor.
   *
   * @param args - Arguments for key derivation
   * @param args.path - The path to use derive the key
   * @param args.predecessor - The id/address of the account requesting signature
   * @param args.IsEd25519 - Flag indicating if the key is Ed25519
   * @returns Promise resolving to the derived SEC1 uncompressed public key
   */
  // abstract getDerivedPublicKey(args: ArgsEd25519): Promise<Ed25519PubKey>
  abstract getDerivedPublicKey(
    args: DerivedPublicKeyArgs | ArgsEd25519
  ): Promise<UncompressedPubKeySEC1 | Ed25519PubKey>
}

/**
 * Full contract interface that extends BaseChainSignatureContract to provide all Sig Network Smart Contract capabilities.
 */
export abstract class ChainSignatureContract extends BaseChainSignatureContract {
  /**
   * Signs a payload using Sig Network MPC.
   *
   * @param payloads - The payload to sign as an array of 32 bytes
   * @param keyType - The type of key to use for signing, either 'secp256k1' or 'ed25519'
   * @returns Promise resolving to the signature
   */
  abstract sign(
    payloads: Payload[],
    path: string,
    keyType: 'secp256k1' | 'ed25519',
    signerAccount: {
      signAndSendTransactions: (transactions: any) => Promise<any>
    }
  ): Promise<RSVSignature>

  /**
   * Gets the public key associated with this contract instance.
   *
   * @returns Promise resolving to the SEC1 uncompressed public key
   */
  abstract getPublicKey(): Promise<UncompressedPubKeySEC1>
}
