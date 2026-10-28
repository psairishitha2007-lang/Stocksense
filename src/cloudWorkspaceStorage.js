export async function loadCloudWorkspace(client, userId) {
  const { data, error } = await client
    .from('business_workspaces')
    .select('application_data, revision')
    .eq('owner_id', userId)
    .maybeSingle()

  if (error) throw new Error(`Could not load your business workspace: ${error.message}`)
  return data
}

export async function saveCloudWorkspace(client, applicationData, expectedRevision) {
  const { data, error } = await client.rpc('save_my_business_workspace', {
    p_application_data: applicationData,
    p_expected_revision: expectedRevision,
  })

  if (error) throw new Error(`Could not save your business workspace: ${error.message}`)
  if (!Array.isArray(data) || data.length !== 1 || !Number.isInteger(data[0].revision)) {
    throw new Error('Your workspace changed in another session. Reload it before continuing to avoid overwriting newer changes.')
  }
  return data[0].revision
}
