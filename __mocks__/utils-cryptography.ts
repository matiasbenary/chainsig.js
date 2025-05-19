// Mock implementation of cryptography.ts to avoid elliptic dependency

// Mock RSV signature conversion
export const toRSV = (signature: any) => {
  return {
    r: 'a'.repeat(64),
    s: 'b'.repeat(64),
    v: 27,
  }
}

// Mock public key compression
export const compressPubKey = (uncompressedPubKeySEC1: string): string => {
  return '02' + 'a'.repeat(64)
}

// Mock NAJ to SEC1 conversion
export const najToUncompressedPubKeySEC1 = (najPublicKey: string): string => {
  return '04' + 'a'.repeat(128)
}

// Mock child public key derivation
export const deriveChildPublicKey = (
  rootUncompressedPubKeySEC1: string,
  predecessorId: string,
  path: string = '',
  chainId: string
): string => {
  return '04' + 'b'.repeat(128)
}

// Mock uint8Array to hex conversion
export const uint8ArrayToHex = (uint8Array: number[]): string => {
  return Array.from(uint8Array)
    .map(() => 'aa')
    .join('')
}
