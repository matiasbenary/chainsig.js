declare module "secp256k1" {
  export function recover(
    messageHash: Uint8Array | Buffer,
    signature: Uint8Array | Buffer,
    recoveryId: number,
    compressed?: boolean
  ): Uint8Array;
}
