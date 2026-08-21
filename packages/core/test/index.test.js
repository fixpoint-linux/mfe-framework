// Placeholder test for @mfe/core
// P0 scaffold - empty test to verify wiring
import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('@mfe/core', () => {
  it('should be importable', async () => {
    const core = await import('../dist/index.js')
    assert.ok(core !== null)
  })
})
