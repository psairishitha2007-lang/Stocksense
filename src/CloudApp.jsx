import { useEffect, useState } from 'react'
import { createDemoWorkspaces } from './categoryInventoryData.js'
import { loadApplicationDataSnapshot } from './applicationStorage.js'
import CloudAccountAccess from './CloudAccountAccess.jsx'
import { loadCloudWorkspace, saveCloudWorkspace } from './cloudWorkspaceStorage.js'

function createInitialApplication() {
  return {
    version: 1,
    workspaces: createDemoWorkspaces(),
    businessCategory: 'home-foods',
    organization: null,
    workspaceEntered: false,
  }
}

function CloudLoading({ message }) {
  return <main className="entry-page form-entry cloud-entry"><section className="entry-card cloud-entry-card"><p role="status">{message}</p></section></main>
}

export default function CloudApp({ client, AppContent }) {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [workspaceState, setWorkspaceState] = useState({ userId: null, workspace: null, error: '' })
  const [useDemo, setUseDemo] = useState(false)

  useEffect(() => {
    let active = true
    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setAuthError('')
      setAuthNotice('')
      setSession(nextSession)
    })

    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError(`Could not restore your sign-in session: ${error.message}`)
      setSession(data.session)
      setAuthLoading(false)
    }).catch((error) => {
      if (!active) return
      setAuthError(`Could not restore your sign-in session: ${error.message}`)
      setAuthLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [client])

  useEffect(() => {
    if (!session?.user?.id) return
    let active = true
    const userId = session.user.id

    async function loadOrCreateWorkspace() {
      try {
        let remoteWorkspace = await loadCloudWorkspace(client, userId)
        if (!remoteWorkspace) {
          const application = createInitialApplication()
          let revision
          try {
            revision = await saveCloudWorkspace(client, application, 0)
          } catch (error) {
            remoteWorkspace = await loadCloudWorkspace(client, userId)
            if (!remoteWorkspace) throw error
          }
          if (!remoteWorkspace) remoteWorkspace = { application_data: application, revision }
        }
        loadApplicationDataSnapshot(remoteWorkspace.application_data, createDemoWorkspaces())
        if (active) setWorkspaceState({ userId, workspace: remoteWorkspace, error: '' })
      } catch (error) {
        if (active) setWorkspaceState({ userId, workspace: null, error: error.message })
      }
    }

    loadOrCreateWorkspace()
    return () => { active = false }
  }, [client, session?.user?.id])

  const workspace = workspaceState.userId === session?.user?.id ? workspaceState.workspace : null
  const workspaceError = workspaceState.userId === session?.user?.id ? workspaceState.error : ''
  const workspaceLoading = Boolean(session?.user?.id) && workspaceState.userId !== session.user.id

  async function submitAuth({ mode, email, password }) {
    setAuthError('')
    setAuthNotice('')
    const result = mode === 'signup'
      ? await client.auth.signUp({ email, password })
      : await client.auth.signInWithPassword({ email, password })
    if (result.error) throw new Error(result.error.message)
    if (mode === 'signup' && !result.data.session) {
      setAuthNotice('Check your email for the confirmation link, then sign in here.')
      return
    }
    if (result.data.session) setSession(result.data.session)
  }

  async function signOut() {
    const { error } = await client.auth.signOut()
    if (error) throw new Error(`Could not sign out: ${error.message}`)
    setSession(null)
  }

  if (useDemo) return <AppContent />
  if (authLoading) return <CloudLoading message="Checking your sign-in session…" />
  if (!session) {
    return (
      <CloudAccountAccess
        onSubmit={submitAuth}
        onUseDemo={() => setUseDemo(true)}
        notice={authNotice}
        error={authError}
        loading={authLoading}
      />
    )
  }
  if (workspaceError) {
    return (
      <CloudAccountAccess
        onSubmit={submitAuth}
        onSignOut={signOut}
        canSignOut
        onUseDemo={() => setUseDemo(true)}
        notice=""
        error={`${workspaceError} Sign out and try again, or set up the Supabase migration before using account mode.`}
        loading={workspaceLoading}
      />
    )
  }
  if (workspaceLoading || !workspace) return <CloudLoading message="Loading your private business workspace…" />

  return (
    <AppContent
      cloudWorkspace={workspace}
      cloudSession={session}
      cloudClient={client}
      onCloudSignOut={signOut}
    />
  )
}
