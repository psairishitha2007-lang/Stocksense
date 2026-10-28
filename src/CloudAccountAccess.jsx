import { useState } from 'react'

export default function CloudAccountAccess({ onSubmit, onUseDemo, onSignOut, canSignOut = false, notice, error, loading }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [signOutError, setSignOutError] = useState('')

  async function signOut() {
    setSignOutError('')
    try {
      await onSignOut()
    } catch (signOutFailure) {
      setSignOutError(signOutFailure.message)
    }
  }

  async function submit(event) {
    event.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      await onSubmit({ mode, email: email.trim(), password })
      setPassword('')
    } catch (submitError) {
      setFormError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="entry-page form-entry cloud-entry">
      <section className="entry-card cloud-entry-card">
        <div className="entry-card-heading">
          <span className="entry-eyebrow">PRIVATE BUSINESS WORKSPACE</span>
          <h1>{mode === 'signup' ? 'Create your Kosthagara account' : 'Welcome back'}</h1>
          <p>Your account keeps this business workspace separate from other users.</p>
        </div>
        {(error || formError || signOutError) && <p className="field-error cloud-message" role="alert">{error || formError || signOutError}</p>}
        {notice && <p className="cloud-message" role="status">{notice}</p>}
        <form className="management-form entry-form" onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field form-field-full">
              <span>Email address *</span>
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="form-field form-field-full">
              <span>Password *</span>
              <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          </div>
          <div className="form-actions entry-form-actions">
            <button className="primary-button" type="submit" disabled={submitting || loading}>
              {submitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </form>
        <div className="cloud-entry-links">
          {canSignOut && <button className="entry-inline-button" type="button" onClick={signOut}>Sign out and try again</button>}
          <button className="entry-inline-button" type="button" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setFormError('') }}>
            {mode === 'signup' ? 'Already have an account? Sign in' : 'New to Kosthagara? Create an account'}
          </button>
          <button className="entry-return-link" type="button" onClick={onUseDemo}>Continue with the browser-only demo</button>
        </div>
        <p className="entry-demo-note">Cloud accounts are enabled for this installation. Use the demo if you have not configured the database yet.</p>
      </section>
    </main>
  )
}
