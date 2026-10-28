import { useState } from 'react'
import { CategoryIllustration, CategoryLogo } from './CategoryBranding.jsx'
import { BUSINESS_CATEGORIES, COUNTRIES, CURRENCIES, getSuggestedCurrency, getSuggestedLocale } from './businessData.js'
import { beginEmailVerification, isDemoVerificationInputValid } from './authProvider.js'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'English (United States)' },
  { code: 'en-GB', label: 'English (United Kingdom)' },
  { code: 'hi-IN', label: 'Hindi (India)' },
  { code: 'bn-BD', label: 'Bengali (Bangladesh)' },
  { code: 'fr-FR', label: 'French (France)' },
  { code: 'es-ES', label: 'Spanish (Spain)' },
  { code: 'ja-JP', label: 'Japanese (Japan)' },
  { code: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
]

function findCountry(value) {
  const normalized = value.trim().toLowerCase()
  return COUNTRIES.find((country) => normalized === country.name.toLowerCase()
    || normalized === country.iso2.toLowerCase()
    || normalized === country.code.toLowerCase()
    || normalized === `${country.name} (${country.iso2})`.toLowerCase())
}

function CountryInput({ id, label, value, onChange, error }) {
  const listId = `${id}-country-options`
  return (
    <label className="form-field">
      <span>{label} *</span>
      <input
        id={id}
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search countries..."
        autoComplete="country-name"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      <datalist id={listId}>
        {COUNTRIES.map((country) => <option key={country.code} value={`${country.name} (${country.iso2})`} />)}
      </datalist>
      {error && <small className="field-error" id={`${id}-error`} role="alert">{error}</small>}
    </label>
  )
}

function EntryHeader({ onHome, action, actionLabel }) {
  return (
    <header className="entry-header">
      <button className="entry-logo" type="button" onClick={onHome} aria-label="Kosthagara welcome">
        <img src="/kosthagara-logo.png" alt="Kosthagara" />
      </button>
      {action && <button className="entry-text-button" type="button" onClick={action}>{actionLabel}</button>}
    </header>
  )
}

function Welcome({ onSignUp, onSignIn, onContinue }) {
  return (
    <main className="entry-page welcome-entry">
      <EntryHeader />
      <section className="welcome-hero">
        <div className="welcome-copy">
          <span className="entry-eyebrow">A LITTLE MORE ORDER, A LOT MORE GROWTH</span>
          <h1>Make room for<br /><em>your next big thing.</em></h1>
          <p>Kosthagara helps small and home-based businesses keep inventory, orders, recipes, and purchasing in one thoughtful workspace.</p>
          <div className="welcome-actions">
            <button className="primary-button" type="button" onClick={onSignUp}>Create a demo account</button>
            <button className="secondary-button" type="button" onClick={onSignIn}>Sign in</button>
          </div>
          <button className="entry-return-link" type="button" onClick={onContinue}>Return to the existing demo workspace</button>
        </div>
        <div className="welcome-art">
          <div className="welcome-art-orbit orbit-a" />
          <div className="welcome-art-orbit orbit-b" />
          <div className="welcome-art-sun">✳</div>
          <div className="welcome-illustration-card">
            <CategoryIllustration category="all-businesses" />
            <span>All your little things,<br />in one happy place.</span>
          </div>
          <span className="welcome-art-chip chip-one">✦ Inventory</span>
          <span className="welcome-art-chip chip-two">✦ Orders</span>
          <span className="welcome-art-chip chip-three">✦ Ideas</span>
        </div>
      </section>
      <p className="entry-demo-note">Demo experience only · No secure accounts or backend. Workspace data may be saved in this browser, but is not secure or synced.</p>
    </main>
  )
}

function SignUp({ onSubmit, onSignIn, onBack }) {
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    phone: '',
    countryText: '',
    location: '',
    password: '',
    confirmPassword: '',
    consent: false,
  })
  const [errors, setErrors] = useState({})
  const selectedCountry = findCountry(values.countryText)

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }

  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!values.fullName.trim()) nextErrors.fullName = 'Enter your full name.'
    if (!values.email.trim()) nextErrors.email = 'Enter your email address.'
    else if (!EMAIL_PATTERN.test(values.email.trim())) nextErrors.email = 'Enter an email address in a valid format.'
    if (!values.phone.trim() || values.phone.replace(/\D/g, '').length < 6) nextErrors.phone = 'Enter a valid phone number.'
    if (!selectedCountry) nextErrors.countryText = 'Choose a country from the list.'
    if (!values.location.trim()) nextErrors.location = 'Enter your city, town, or location.'
    if (values.password.length < 8) nextErrors.password = 'Use at least 8 characters for this demo form.'
    if (!values.confirmPassword) nextErrors.confirmPassword = 'Confirm your password.'
    else if (values.password !== values.confirmPassword) nextErrors.confirmPassword = 'The passwords do not match.'
    if (!values.consent) nextErrors.consent = 'Accept the demo terms and privacy notice to continue.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    onSubmit({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: `${selectedCountry.callingCode || ''} ${values.phone.trim()}`.trim(),
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      location: values.location.trim(),
    })
    setValues((current) => ({ ...current, password: '', confirmPassword: '' }))
  }

  return (
    <main className="entry-page form-entry">
      <EntryHeader onHome={onBack} action={onSignIn} actionLabel="Already have an account? Sign in" />
      <section className="entry-card">
        <div className="entry-card-heading">
          <span className="entry-eyebrow">LET&apos;S GET TO KNOW YOU</span>
          <h1>Create your account</h1>
          <p>This is a local demonstration form. Details are not sent to a server.</p>
        </div>
        <div className="entry-security-note" role="note"><strong>Demo only</strong><span>No account authentication is configured. Your password is used only for this form check and is discarded before continuing.</span></div>
        <form className="management-form entry-form" onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="form-field"><span>Full name *</span><input autoFocus autoComplete="name" value={values.fullName} onChange={(event) => update('fullName', event.target.value)} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <small className="field-error" role="alert">{errors.fullName}</small>}</label>
            <label className="form-field"><span>Email address *</span><input type="email" autoComplete="email" value={values.email} onChange={(event) => update('email', event.target.value)} aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error" role="alert">{errors.email}</small>}</label>
            <label className="form-field"><span>Phone number *</span><div className="entry-phone-field"><span>{selectedCountry?.callingCode || '+—'}</span><input type="tel" autoComplete="tel-national" value={values.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Phone number" aria-invalid={Boolean(errors.phone)} /></div>{errors.phone && <small className="field-error" role="alert">{errors.phone}</small>}</label>
            <CountryInput id="signup-country" label="Country" value={values.countryText} onChange={(value) => update('countryText', value)} error={errors.countryText} />
            <label className="form-field form-field-full"><span>City or location *</span><input autoComplete="address-level2" value={values.location} onChange={(event) => update('location', event.target.value)} placeholder="City, town, or area" aria-invalid={Boolean(errors.location)} />{errors.location && <small className="field-error" role="alert">{errors.location}</small>}</label>
            <label className="form-field"><span>Password *</span><input type="password" autoComplete="new-password" value={values.password} onChange={(event) => update('password', event.target.value)} aria-invalid={Boolean(errors.password)} />{errors.password && <small className="field-error" role="alert">{errors.password}</small>}</label>
            <label className="form-field"><span>Confirm password *</span><input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(event) => update('confirmPassword', event.target.value)} aria-invalid={Boolean(errors.confirmPassword)} />{errors.confirmPassword && <small className="field-error" role="alert">{errors.confirmPassword}</small>}</label>
          </div>
          <details className="entry-policy"><summary>Read demo terms and privacy notice</summary><p>This demonstration does not create a secure account, transmit a verification message, or save your details to a server. Do not enter a password you use elsewhere. Profile details remain only in this browser session.</p></details>
          <label className="entry-consent"><input type="checkbox" checked={values.consent} onChange={(event) => update('consent', event.target.checked)} /><span>I have read and accept the demo terms and privacy notice. *</span></label>
          {errors.consent && <small className="field-error" role="alert">{errors.consent}</small>}
          <button className="primary-button entry-submit" type="submit">Continue to demo verification</button>
        </form>
        <p className="entry-footer">Already using Kosthagara? <button type="button" className="entry-inline-button" onClick={onSignIn}>Sign in</button></p>
      </section>
      <button className="entry-return-link" type="button" onClick={onBack}>Back to welcome</button>
    </main>
  )
}

function SignIn({ onBack, onContinue, onSignUp }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  function submit(event) {
    event.preventDefault()
    if (!EMAIL_PATTERN.test(email.trim()) || !password) {
      setMessage('Enter an email address in a valid format and a password to continue.')
      return
    }
    setPassword('')
    setMessage('There is no authentication provider connected, so no sign-in was performed.')
  }
  return (
    <main className="entry-page form-entry">
      <EntryHeader onHome={onBack} />
      <section className="entry-card sign-in-card">
        <div className="entry-card-heading">
          <span className="entry-eyebrow">WELCOME BACK</span>
          <h1>Sign in</h1>
          <p>Account sign-in is not connected in this demo.</p>
        </div>
        <div className="entry-security-note" role="note"><strong>No authentication provider</strong><span>Submitting credentials does not authenticate you. Password input is cleared and never stored.</span></div>
        <form className="management-form entry-form" onSubmit={submit} noValidate>
          <label className="form-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="form-field"><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {message && <p className="form-error-message" role="status">{message}</p>}
          <button className="primary-button entry-submit" type="submit">Continue</button>
        </form>
        <button className="secondary-button entry-submit" type="button" onClick={onContinue}>Open existing demo workspace</button>
        <p className="entry-footer">New to Kosthagara? <button type="button" className="entry-inline-button" onClick={onSignUp}>Create a demo account</button></p>
      </section>
      <button className="entry-return-link" type="button" onClick={onBack}>Back to welcome</button>
    </main>
  )
}

function Verification({ email, onBack, onContinue }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(beginEmailVerification().message)

  function resend() {
    setNotice(beginEmailVerification().message)
  }
  function submit(event) {
    event.preventDefault()
    if (!isDemoVerificationInputValid(code)) {
      setError('Enter six digits to continue through this demo step.')
      return
    }
    setError('')
    onContinue()
  }
  return (
    <main className="entry-page form-entry">
      <EntryHeader onHome={onBack} />
      <section className="entry-card sign-in-card">
        <div className="verification-mark" aria-hidden="true">✉</div>
        <div className="entry-card-heading">
          <span className="entry-eyebrow">DEMONSTRATION STEP</span>
          <h1>Verification screen</h1>
          <p>We have not sent a code to <strong>{email}</strong>. No email or SMS provider is configured.</p>
        </div>
        <div className="entry-security-note" role="note"><strong>Not real verification</strong><span>This screen checks only that six digits were entered. It does not verify your identity or a one-time password.</span></div>
        <form className="management-form entry-form" onSubmit={submit} noValidate>
          <label className="form-field"><span>Six-digit demo input</span><input className="otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength="6" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder="· · · · · ·" aria-invalid={Boolean(error)} /></label>
          {error && <p className="form-error-message" role="alert">{error}</p>}
          <button className="primary-button entry-submit" type="submit">Continue demo onboarding</button>
        </form>
        <p className="entry-resend">{notice} <button type="button" className="entry-inline-button" onClick={resend}>Resend OTP (demo)</button></p>
        <button className="entry-return-link" type="button" onClick={onBack}>Back to sign-up details</button>
      </section>
    </main>
  )
}

function Onboarding({ initialCountryCode, onBack, onComplete, cloudManaged = false }) {
  const initialCountry = COUNTRIES.find((country) => country.code === initialCountryCode)
  const [values, setValues] = useState({
    organizationName: '',
    countryText: initialCountry ? `${initialCountry.name} (${initialCountry.iso2})` : '',
    region: '',
    city: '',
    category: 'all-businesses',
    startDate: new Date().toISOString().slice(0, 10),
    language: getSuggestedLocale(initialCountryCode || 'USA'),
    currency: getSuggestedCurrency(initialCountryCode || 'USA') ?? 'USD',
  })
  const [errors, setErrors] = useState({})
  const selectedCountry = findCountry(values.countryText)

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: '' }))
  }
  function updateCountry(value) {
    const country = findCountry(value)
    setValues((current) => ({
      ...current,
      countryText: value,
      ...(country ? {
        currency: getSuggestedCurrency(country.code) ?? current.currency,
        language: getSuggestedLocale(country.code),
      } : {}),
    }))
    setErrors((current) => ({ ...current, countryText: '' }))
  }
  function submit(event) {
    event.preventDefault()
    const nextErrors = {}
    if (!values.organizationName.trim()) nextErrors.organizationName = 'Enter an organisation or business name.'
    if (!selectedCountry) nextErrors.countryText = 'Choose a business country from the list.'
    if (!values.region.trim()) nextErrors.region = 'Enter a state or region.'
    if (!values.city.trim()) nextErrors.city = 'Enter a city or business location.'
    if (!BUSINESS_CATEGORIES.some((category) => category.id === values.category)) nextErrors.category = 'Choose a business category.'
    if (!values.startDate) nextErrors.startDate = 'Choose an inventory start date.'
    try {
      new Intl.Locale(values.language)
    } catch {
      nextErrors.language = 'Enter a valid language/locale such as en-GB or hi-IN.'
    }
    if (!CURRENCIES.some((currency) => currency.code === values.currency)) nextErrors.currency = 'Choose a valid currency.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    onComplete({
      organizationName: values.organizationName.trim(),
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      region: values.region.trim(),
      city: values.city.trim(),
      category: values.category,
      startDate: values.startDate,
      language: new Intl.Locale(values.language).toString(),
      currency: values.currency,
    })
  }
  return (
    <main className="entry-page form-entry">
      <EntryHeader onHome={cloudManaged ? undefined : onBack} />
      <section className="entry-card onboarding-card">
        <div className="entry-card-heading">
          <span className="entry-eyebrow">YOUR WORKSPACE, YOUR WAY</span>
          <h1>Set up your organisation</h1>
          <p>{cloudManaged ? 'Choose the category and regional display settings for your account workspace.' : 'Choose the category and regional display settings for this demo workspace.'}</p>
        </div>
        <div className="entry-security-note" role="note"><strong>{cloudManaged ? 'Private account workspace' : 'One shared demo workspace'}</strong><span>{cloudManaged ? 'This workspace is stored under your signed-in account and protected by database access policies.' : 'Organisation isolation and permanent saving are not available. This setup selects an existing category workspace for this session.'}</span></div>
        <form className="management-form entry-form" onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="form-field form-field-full"><span>Organisation or business name *</span><input autoFocus value={values.organizationName} onChange={(event) => update('organizationName', event.target.value)} aria-invalid={Boolean(errors.organizationName)} />{errors.organizationName && <small className="field-error" role="alert">{errors.organizationName}</small>}</label>
            <CountryInput id="business-country" label="Business country" value={values.countryText} onChange={updateCountry} error={errors.countryText} />
            <label className="form-field"><span>State or region *</span><input value={values.region} onChange={(event) => update('region', event.target.value)} aria-invalid={Boolean(errors.region)} />{errors.region && <small className="field-error" role="alert">{errors.region}</small>}</label>
            <label className="form-field"><span>City or business location *</span><input value={values.city} onChange={(event) => update('city', event.target.value)} aria-invalid={Boolean(errors.city)} />{errors.city && <small className="field-error" role="alert">{errors.city}</small>}</label>
            <label className="form-field"><span>Inventory start date *</span><input type="date" value={values.startDate} onChange={(event) => update('startDate', event.target.value)} aria-invalid={Boolean(errors.startDate)} />{errors.startDate && <small className="field-error" role="alert">{errors.startDate}</small>}</label>
            <label className="form-field form-field-full"><span>Business industry/category *</span><select value={values.category} onChange={(event) => update('category', event.target.value)}>{BUSINESS_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{errors.category && <small className="field-error" role="alert">{errors.category}</small>}</label>
            <label className="form-field"><span>Preferred language *</span><select value={values.language} onChange={(event) => update('language', event.target.value)}>{LANGUAGE_OPTIONS.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}{!LANGUAGE_OPTIONS.some((language) => language.code === values.language) && <option value={values.language}>{values.language}</option>}</select>{errors.language && <small className="field-error" role="alert">{errors.language}</small>}</label>
            <label className="form-field"><span>Default currency *</span><select value={values.currency} onChange={(event) => update('currency', event.target.value)}>{CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name}</option>)}</select>{errors.currency && <small className="field-error" role="alert">{errors.currency}</small>}</label>
          </div>
          <div className="onboarding-brand-preview"><CategoryLogo category={values.category} /><span>{BUSINESS_CATEGORIES.find((category) => category.id === values.category)?.name ?? 'Business category'}</span></div>
          <div className="form-actions entry-form-actions">{!cloudManaged && <button className="secondary-button" type="button" onClick={onBack}>Back</button>}<button className="primary-button" type="submit">{cloudManaged ? 'Create private workspace' : 'Create demo organisation'}</button></div>
        </form>
      </section>
      {!cloudManaged && <p className="entry-demo-note">Demo setup only · No organisation or account is saved to a server.</p>}
    </main>
  )
}

function Success({ organization, onContinue, onBack, cloudManaged = false }) {
  const category = BUSINESS_CATEGORIES.find((entry) => entry.id === organization.category)
  return (
    <main className="entry-page success-entry">
      <EntryHeader onHome={cloudManaged ? undefined : onBack} />
      <section className="entry-card success-card">
        <div className="success-mark">✓</div>
        <span className="entry-eyebrow">{cloudManaged ? 'YOUR PRIVATE WORKSPACE IS READY' : 'YOUR DEMO WORKSPACE IS READY'}</span>
        <h1>Lovely to have you,<br /><em>{organization.organizationName}.</em></h1>
        <p>Your session is set up for {category?.name ?? 'your business'} in {organization.city}, {organization.countryName}.</p>
        <div className="entry-security-note" role="note"><strong>{cloudManaged ? 'Account-protected data' : 'Session-only demonstration'}</strong><span>{cloudManaged ? 'Your workspace is saved to your account. Sample inventory is included as a starting point and can be edited or removed.' : 'No account or organisation was created on a server. The chosen category opens its existing sample inventory; separate organisation data is not isolated yet.'}</span></div>
        <button className="primary-button entry-submit" type="button" onClick={onContinue}>Continue to Dashboard</button>
        {!cloudManaged && <button className="entry-return-link" type="button" onClick={onBack}>Return to welcome</button>}
      </section>
      <CategoryIllustration category={category} className="success-illustration" />
    </main>
  )
}

export default function AuthFlow({ onEnterWorkspace, onOrganizationReady, cloudManaged = false }) {
  const [screen, setScreen] = useState(cloudManaged ? 'onboarding' : 'welcome')
  const [profile, setProfile] = useState(null)
  const [organization, setOrganization] = useState(null)

  function finishOnboarding(nextOrganization) {
    const organizationWithOwner = { ...nextOrganization, ownerName: profile?.fullName ?? '' }
    setOrganization(organizationWithOwner)
    onOrganizationReady(organizationWithOwner)
    setScreen('success')
  }

  if (screen === 'signup') return <SignUp onSubmit={(details) => { setProfile(details); setScreen('verification') }} onSignIn={() => setScreen('signin')} onBack={() => setScreen('welcome')} />
  if (screen === 'signin') return <SignIn onBack={() => setScreen('welcome')} onContinue={onEnterWorkspace} onSignUp={() => setScreen('signup')} />
  if (screen === 'verification') return <Verification email={profile?.email ?? ''} onBack={() => setScreen('signup')} onContinue={() => setScreen('onboarding')} />
  if (screen === 'onboarding') return <Onboarding initialCountryCode={profile?.countryCode} onBack={cloudManaged ? undefined : () => setScreen('verification')} onComplete={finishOnboarding} cloudManaged={cloudManaged} />
  if (screen === 'success') return <Success organization={organization} onContinue={onEnterWorkspace} onBack={cloudManaged ? undefined : () => setScreen('welcome')} cloudManaged={cloudManaged} />
  return <Welcome onSignUp={() => setScreen('signup')} onSignIn={() => setScreen('signin')} onContinue={onEnterWorkspace} />
}
