import { utils, Bitcoin, EVM, Cosmos } from '../src';

describe('SDK exports', () => {
  it('should export utils', () => {
    expect(utils).toBeDefined();
  });

  it('should export chains', () => {
    expect(Bitcoin).toBeDefined();
    expect(EVM).toBeDefined();
    expect(Cosmos).toBeDefined();
  });
});
