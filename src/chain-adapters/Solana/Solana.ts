import { fromHex } from '@cosmjs/encoding'
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
      feePayer:
        transaction.feePayer ||
        new PublicKey('11111111111111111111111111111111'),
      recentBlockhash: transaction.recentBlockhash || '',
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

  finalizeTransactionSigning({ transaction, rsvSignatures }: { transaction: SolanaUnsignedTransaction; rsvSignatures: { r: string; s: string; v: number }[] }): string {
    throw new Error('Not implemented');
  }

  async broadcastTx(txSerialized: string): Promise<{ hash: string }> {
    const transaction = this.deserializeTransaction(txSerialized)

    const signature = await this.connection.sendRawTransaction(
      transaction.transaction.serialize()
    )

    return { hash: signature }
  }

  private convertRSVToSolanaSignature(rsvSignature: RSVSignature): Uint8Array {
    const r = fromHex(rsvSignature.r)
    const s = fromHex(rsvSignature.s)

    const solanaSignature = new Uint8Array(64)
    solanaSignature.set(r, 0)
    solanaSignature.set(s, 32)

    return solanaSignature
  }
}
