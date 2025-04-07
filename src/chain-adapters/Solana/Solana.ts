import type { Connection } from '@solana/web3.js'
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js'
import type BN from 'bn.js'

import type { BaseChainSignatureContract } from '@contracts/ChainSignatureContract'
import type { KeyDerivationPath, HashToSign, RSVSignature } from '@types'

import { ChainAdapter } from '../ChainAdapter'

import type {
  SolanaTransactionRequest,
  SolanaUnsignedTransaction,
} from './types'

const toBigInt = (value: bigint | BN): bigint => {
  if (typeof value === 'bigint') return value
  return BigInt(value.toString())
}

export class Solana extends ChainAdapter<
  SolanaTransactionRequest,
  SolanaUnsignedTransaction
> {
  private readonly connection: Connection
  private readonly contract: BaseChainSignatureContract

  constructor(args: {
    connection: Connection
    contract: BaseChainSignatureContract
  }) {
    super()
    this.connection = args.connection
    this.contract = args.contract
  }

  async getBalance(
    address: string
  ): Promise<{ balance: bigint; decimals: number }> {
    const pubkey = new PublicKey(address)
    const balance = await this.connection.getBalance(pubkey)
    return {
      balance: BigInt(balance),
      decimals: 9, // Solana uses 9 decimals (LAMPORTS_PER_SOL)
    }
  }

  async deriveAddressAndPublicKey(
    predecessor: string,
    path: KeyDerivationPath
  ): Promise<{ address: string; publicKey: string }> {
    const pubKey = await this.contract.getDerivedPublicKey({
      path,
      predecessor,
    })
    // Convert the public key to Solana format (base58)
    // Note: Need to implement conversion from contract's public key format to Solana's
    const solanaPublicKey = new PublicKey(pubKey)

    return {
      address: solanaPublicKey.toBase58(),
      publicKey: pubKey,
    }
  }

  serializeTransaction(transaction: SolanaUnsignedTransaction): string {
    return Buffer.from(
      transaction.transaction.serialize({
        requireAllSignatures: false,
      })
    ).toString('base64')
  }

  deserializeTransaction(serialized: string): SolanaUnsignedTransaction {
    const buffer = Buffer.from(serialized, 'base64')
    const transaction = Transaction.from(buffer)

    return {
      transaction,
      feePayer: transaction.feePayer!,
      recentBlockhash: transaction.recentBlockhash!,
    }
  }

  async prepareTransactionForSigning(
    request: SolanaTransactionRequest
  ): Promise<{
    transaction: SolanaUnsignedTransaction
    hashesToSign: HashToSign[]
  }> {
    const transaction = new Transaction()

    // Add transfer instruction if amount is specified
    const amount = toBigInt(request.amount)
    if (amount > 0n) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(request.from),
          toPubkey: new PublicKey(request.to),
          lamports: Number(amount),
        })
      )
    }

    // Add any additional instructions
    if (request.instructions) {
      transaction.add(...request.instructions)
    }

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash

    // Set fee payer
    transaction.feePayer = request.feePayer || new PublicKey(request.from)

    const messageBytes = transaction.compileMessage().serialize()

    return {
      transaction: {
        transaction,
        feePayer: transaction.feePayer,
        recentBlockhash: blockhash,
      },
      hashesToSign: [Array.from(messageBytes)],
    }
  }

  finalizeTransactionSigning(params: {
    transaction: SolanaUnsignedTransaction
    rsvSignatures: RSVSignature[]
  }): string {
    const { transaction, rsvSignatures } = params

    // Convert RSV signature to Solana signature format
    // Note: Need to implement conversion from RSV to Solana's 64-byte signature
    const signature = this.convertRSVToSolanaSignature(rsvSignatures[0])

    // Add signature to transaction
    transaction.transaction.addSignature(
      transaction.feePayer,
      Buffer.from(signature)
    )

    return this.serializeTransaction(transaction)
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const transaction = this.deserializeTransaction(txSerialized)

    const signature = await this.connection.sendRawTransaction(
      transaction.transaction.serialize()
    )

    return { hash: signature }
  }

  private convertRSVToSolanaSignature(rsvSignature: RSVSignature): Uint8Array {
    // Implementation needed: Convert RSV signature to Solana's 64-byte format
    // This will depend on your RSV signature format and Solana's requirements
    throw new Error('Not implemented')
  }
}
