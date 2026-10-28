import assert from 'node:assert/strict'
import test from 'node:test'
import { loadCloudWorkspace, saveCloudWorkspace } from './cloudWorkspaceStorage.js'

test('workspace lookup is constrained to the signed-in owner', async () => {
  const expected = { application_data: { version: 1 }, revision: 2 }
  const calls = []
  const client = {
    from(table) {
      calls.push(['from', table])
      return {
        select(columns) {
          calls.push(['select', columns])
          return this
        },
        eq(column, value) {
          calls.push(['eq', column, value])
          return this
        },
        async maybeSingle() {
          return { data: expected, error: null }
        },
      }
    },
  }

  assert.equal(await loadCloudWorkspace(client, 'owner-1'), expected)
  assert.deepEqual(calls, [
    ['from', 'business_workspaces'],
    ['select', 'application_data, revision'],
    ['eq', 'owner_id', 'owner-1'],
  ])
})

test('cloud saves require the expected revision and return the next revision', async () => {
  let rpcCall
  const client = {
    async rpc(name, parameters) {
      rpcCall = { name, parameters }
      return { data: [{ revision: 4 }], error: null }
    },
  }

  const revision = await saveCloudWorkspace(client, { version: 1 }, 3)
  assert.equal(revision, 4)
  assert.deepEqual(rpcCall, {
    name: 'save_my_business_workspace',
    parameters: { p_application_data: { version: 1 }, p_expected_revision: 3 },
  })
})

test('a stale cloud revision is reported rather than treated as a successful save', async () => {
  const client = { async rpc() { return { data: [], error: null } } }
  await assert.rejects(
    saveCloudWorkspace(client, { version: 1 }, 2),
    /changed in another session/,
  )
})

test('cloud access errors are surfaced to the caller', async () => {
  const client = { async rpc() { return { data: null, error: { message: 'permission denied' } } } }
  await assert.rejects(
    saveCloudWorkspace(client, { version: 1 }, 0),
    /permission denied/,
  )
})
