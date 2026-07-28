import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

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
