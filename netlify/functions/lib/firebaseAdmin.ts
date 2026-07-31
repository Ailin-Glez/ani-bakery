import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

function getAdminApp() {
  const existing = getApps()[0]
  if (existing) return existing

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (!serviceAccountKey) {
    throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_KEY')
  }
  return initializeApp({ credential: cert(JSON.parse(serviceAccountKey)) })
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}

// Verifies the Firebase ID token sent by the admin panel (Authorization: Bearer <token>),
// so admin-only functions can't be invoked by an unauthenticated caller directly.
export async function requireAdmin(authHeader: string | undefined) {
  const token = authHeader?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return false
  try {
    await getAuth(getAdminApp()).verifyIdToken(token)
    return true
  } catch {
    return false
  }
}
