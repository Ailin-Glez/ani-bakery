import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

// Firebase always tries to cache its internal installations/heartbeat data in
// IndexedDB on init, regardless of our Auth persistence config. On browser
// profiles with a corrupted local IndexedDB store this throws an unhandled
// "IO error ... Unable to create writable file" with no functional impact —
// reads/writes to Auth and Firestore still go over the network fine. Silence
// only this known-benign, Firebase-internal error; let everything else through.
window.addEventListener('unhandledrejection', event => {
  const message = event.reason instanceof Error ? event.reason.message : String(event.reason)
  if (/IO error.*Unable to create writable file/i.test(message)) {
    console.warn('Firebase internal storage (installations/heartbeat) unavailable on this browser profile — ignoring, no functional impact.')
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
