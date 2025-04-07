// import { jest } from '@jest/globals'

import { utils } from '../src'
import { Bitcoin } from '../src/chain-adapters/Bitcoin/Bitcoin'
import { Cosmos } from '../src/chain-adapters/Cosmos/Cosmos'
import { EVM } from '../src/chain-adapters/EVM/EVM'

describe('SDK exports', () => {
  it('should export utils', () => {
    expect(utils).toBeDefined()
  })

  it('should export chains', () => {
    expect(Bitcoin).toBeDefined()
    expect(EVM).toBeDefined()
    expect(Cosmos).toBeDefined()
  })
})
