/* Waitlist signup → Firestore `waitlist` collection in the game's Firebase project.
   Each signup is keyed by a SHA-256 of the normalised email, so signing up twice
   updates one record instead of creating duplicates. Rules: firestore.waitlist.rules */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA_UqWBggl4ihGhXIGV0dL9erqwABZu50o',
  authDomain: 'alchemons-auth.firebaseapp.com',
  projectId: 'alchemons-auth',
  storageBucket: 'alchemons-auth.firebasestorage.app',
  messagingSenderId: '78179819122',
  appId: '1:78179819122:web:037473ba59772e667caceb',
};

const form = document.getElementById('signup');
const status = document.getElementById('signup-status');
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
let db;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function say(msg, kind) {
  status.textContent = msg;
  status.className = 'signup-status' + (kind ? ' ' + kind : '');
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  if (data.get('company')) return; // honeypot
  const email = String(data.get('email') || '').trim().toLowerCase();
  const platform = String(data.get('platform') || 'both');
  if (!EMAIL.test(email) || email.length > 254) {
    say('That email doesn’t look right.', 'err');
    form.email.focus();
    return;
  }

  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  say('Adding you…');
  try {
    db ??= getFirestore(initializeApp(firebaseConfig));
    await setDoc(doc(db, 'waitlist', await sha256(email)), {
      email, platform, source: 'site', createdAt: serverTimestamp(),
    });
    form.classList.add('is-done');
    say('You’re on the list. We’ll write once, when the valley opens.', 'ok');
  } catch (err) {
    console.error('waitlist', err);
    button.disabled = false;
    say('Something went wrong. Please try again in a moment.', 'err');
  }
});
