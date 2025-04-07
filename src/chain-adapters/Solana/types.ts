import type {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import type BN from 'bn.js'

export interface SolanaTransactionRequest {
  from: string
  to: string
  amount: bigint | BN
  // Optional parameters
  instructions?: TransactionInstruction[]
  feePayer?: PublicKey
}

export interface SolanaUnsignedTransaction {
  transaction: Transaction
  feePayer: PublicKey
  recentBlockhash: string
}
