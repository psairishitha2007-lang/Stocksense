export function beginEmailVerification() {
  return {
    providerConfigured: false,
    message: 'No email or SMS provider is connected. No verification message was sent.',
  }
}

export function isDemoVerificationInputValid(code) {
  return /^\d{6}$/.test(code)
}
