// Global BigInt serialization fix - must be at the very top
if (typeof BigInt !== 'undefined') {
  // Add toJSON method to BigInt prototype
  ;(BigInt.prototype as any).toJSON = function () {
    return this.toString()
  }

  // Override JSON.stringify globally with comprehensive error handling
  const originalStringify = JSON.stringify
  JSON.stringify = function (
    value: any,
    replacer?: any,
    space?: string | number
  ): string {
    try {
      return originalStringify(
        value,
        (key: string, val: any) => {
          if (typeof val === 'bigint') {
            return val.toString()
          }
          return replacer ? replacer(key, val) : val
        },
        space
      )
    } catch (error) {
      // Fallback for edge cases
      return originalStringify(
        value,
        (key: string, val: any) => {
          if (typeof val === 'bigint') {
            return val.toString()
          }
          if (typeof val === 'object' && val !== null) {
            try {
              return JSON.parse(JSON.stringify(val))
            } catch {
              return '[Non-serializable Object]'
            }
          }
          return replacer ? replacer(key, val) : val
        },
        space
      )
    }
  }
}

// Handle ESM modules
import { jest } from '@jest/globals'

// Declare BigInt interface for TypeScript
declare global {
  interface BigInt {
    toJSON: () => string
  }
}

export {}

// Mock bn.js with proper TypeScript types
class BN {
  value: bigint

  constructor(value: string | number | bigint | BN | undefined | null) {
    if (value === undefined || value === null) {
      this.value = BigInt(0)
    } else if (value instanceof BN) {
      this.value = value.value
    } else if (typeof value === 'bigint') {
      this.value = value
    } else if (typeof value === 'string') {
      try {
        if (value.startsWith('0x')) {
          this.value = BigInt(value)
        } else {
          this.value = BigInt(value)
        }
      } catch (e) {
        this.value = BigInt(0)
      }
    } else if (typeof value === 'number') {
      this.value = BigInt(value)
    } else {
      this.value = BigInt(0)
    }
  }

  toString(base?: number): string {
    return this.value.toString(base)
  }

  toNumber(): number {
    return Number(this.value)
  }

  toBigInt(): bigint {
    return this.value
  }

  add(other: BN | string | number): BN {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return new BN(this.value + otherBN)
  }

  sub(other: BN | string | number): BN {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return new BN(this.value - otherBN)
  }

  mul(other: BN | string | number): BN {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return new BN(this.value * otherBN)
  }

  div(other: BN | string | number): BN {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return new BN(this.value / otherBN)
  }

  mod(other: BN | string | number): BN {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return new BN(this.value % otherBN)
  }

  eq(other: BN | string | number): boolean {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return this.value === otherBN
  }

  lt(other: BN | string | number): boolean {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return this.value < otherBN
  }

  lte(other: BN | string | number): boolean {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return this.value <= otherBN
  }

  gt(other: BN | string | number): boolean {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return this.value > otherBN
  }

  gte(other: BN | string | number): boolean {
    const otherBN = other instanceof BN ? other.value : BigInt(other)
    return this.value >= otherBN
  }

  isZero(): boolean {
    return this.value === BigInt(0)
  }

  isNeg(): boolean {
    return this.value < BigInt(0)
  }

  abs(): BN {
    return new BN(this.value < BigInt(0) ? -this.value : this.value)
  }

  neg(): BN {
    return new BN(-this.value)
  }

  fromTwos(width: number): BN {
    if (this.value >= BigInt(0)) return this
    return new BN(this.value + (BigInt(1) << BigInt(width)))
  }

  toTwos(width: number): BN {
    if (this.value >= BigInt(0)) return this
    return new BN(this.value - (BigInt(1) << BigInt(width)))
  }

  static fromTwos(value: BN | string | number, width: number): BN {
    const bn = new BN(value)
    return bn.fromTwos(width)
  }

  static toTwos(value: BN | string | number, width: number): BN {
    const bn = new BN(value)
    return bn.toTwos(width)
  }

  static from(value: string | number | bigint | BN): BN {
    return new BN(value)
  }

  toHexString(): string {
    return '0x' + this.value.toString(16)
  }
}

// Mock bn.js
jest.mock('bn.js', () => BN)

// Mock @solana/web3.js with proper types
jest.mock('@solana/web3.js', () => {
  class MockPublicKey {
    private readonly _value: string

    constructor(value: string) {
      this._value = value
    }

    toBase58(): string {
      return this._value
    }

    toString(): string {
      return this._value
    }

    equals(other: unknown): boolean {
      return this._value === String(other)
    }
  }

  interface MockInstruction {
    keys?: Array<{
      pubkey: MockPublicKey
      isSigner: boolean
      isWritable: boolean
    }>
    programId?: MockPublicKey
    data?: Buffer
  }

  class MockTransaction {
    public instructions: MockInstruction[] = []
    public feePayer: MockPublicKey
    public recentBlockhash: string

    constructor() {
      this.feePayer = new MockPublicKey('mockFeePayer')
      this.recentBlockhash = 'mockBlockhash'
    }

    static from(buffer: Buffer): MockTransaction {
      return new MockTransaction()
    }

    add(...instructions: MockInstruction[]): this {
      this.instructions.push(...instructions)
      return this
    }

    serialize(options?: { requireAllSignatures?: boolean }): Buffer {
      return Buffer.from('mockSerializedTransaction')
    }

    compileMessage: () => { serialize: () => Buffer } = () => {
      return {
        serialize: () => Buffer.from('mockMessage'),
      }
    }

    addSignature(publicKey: MockPublicKey, signature: Buffer): void {
      // Mock implementation
    }
  }

  const MockSystemProgram = {
    transfer: ({
      fromPubkey,
      toPubkey,
      lamports,
    }: {
      fromPubkey: MockPublicKey
      toPubkey: MockPublicKey
      lamports: number
    }) => ({
      fromPubkey,
      toPubkey,
      lamports,
    }),
  }

  return {
    Connection: jest.fn(),
    PublicKey: MockPublicKey,
    SystemProgram: MockSystemProgram,
    Transaction: MockTransaction,
  }
})

// Mock @ethersproject/bignumber with proper types
jest.mock('@ethersproject/bignumber', () => ({
  BigNumber: {
    from: (value: string | number | bigint | BN): BN => new BN(value),
  },
}))

// Mock other ESM modules
jest.mock('@noble/curves/secp256k1', () => ({
  secp256k1: {
    getPublicKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
  },
}))

jest.mock('@account-kit/smart-contracts', () => ({
  createLightAccountAlchemyClient: jest.fn(),
}))
