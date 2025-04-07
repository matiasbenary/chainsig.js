// Handle ESM modules
import { jest } from '@jest/globals'

// Add BigInt serialization support
if (!('toJSON' in BigInt.prototype)) {
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    value: function () {
      return this.toString()
    },
  })
}

// Mock bn.js
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
        // Handle hex strings
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

  // Add ethers.js BigNumber compatibility
  static from(value: any): BN {
    return new BN(value)
  }

  toHexString(): string {
    return '0x' + this.value.toString(16)
  }
}

// Mock bn.js
jest.mock('bn.js', () => BN)

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => {
  class MockPublicKey {
    private _value: string

    constructor(value: string) {
      this._value = value
    }

    toBase58(): string {
      return this._value
    }

    toString(): string {
      return this._value
    }

    equals(other: any): boolean {
      return this._value === other.toString()
    }
  }

  class MockTransaction {
    public instructions: any[] = []
    public feePayer: any
    public recentBlockhash: string

    constructor() {
      this.feePayer = new MockPublicKey('mockFeePayer')
      this.recentBlockhash = 'mockBlockhash'
    }

    static from(buffer: Buffer): MockTransaction {
      const tx = new MockTransaction()
      return tx
    }

    add(...instructions: any[]) {
      this.instructions.push(...instructions)
      return this
    }

    serialize(options?: { requireAllSignatures?: boolean }): Buffer {
      return Buffer.from('mockSerializedTransaction')
    }

    compileMessage() {
      return {
        serialize: () => Buffer.from('mockMessage'),
      }
    }

    addSignature(publicKey: any, signature: Buffer): void {
      // Mock implementation
    }
  }

  const MockSystemProgram = {
    transfer: ({ fromPubkey, toPubkey, lamports }: any) => ({
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

// Mock @ethersproject/bignumber
jest.mock('@ethersproject/bignumber', () => ({
  BigNumber: {
    from: (value: any) => new BN(value),
  },
}))

// Mock other ESM modules as needed
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
