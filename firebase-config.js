/**
 * Firebase Configuration
 * Replace these values with your Firebase project config
 */

// Firebase configuration for compatibility libraries
const firebaseConfig = {
  apiKey: "AIzaSyDHlUcbwTNzApvbTkxNEw4brkE3CJ6rBoM",
  authDomain: "prompt-enhancer-ai.firebaseapp.com",
  projectId: "prompt-enhancer-ai",
  storageBucket: "prompt-enhancer-ai.firebasestorage.app",
  messagingSenderId: "1097186279139",
  appId: "1:1097186279139:web:4578ddc11ca5c5283f4fd6"
};

// Will be set after Firebase loads
let app, auth, provider;

// Initialize Firebase when scripts are loaded
function initializeFirebase() {
  if (typeof firebase !== 'undefined' && firebase.initializeApp && firebase.auth) {
    try {
      // Use existing app if already initialized (e.g. hot reload or duplicate script)
      try {
        app = firebase.app();
      } catch (e) {
        app = firebase.initializeApp(firebaseConfig);
      }
      auth = firebase.auth();

      provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      // Set persistence to LOCAL so users stay signed in across popup closes and browser restarts.
      // Must complete before exposing auth so sign-in is persisted.
      function exposeAuth() {
        window.auth = auth;
        window.provider = provider;
        window.signInWithPopup = auth.signInWithPopup.bind(auth);
        window.signOut = auth.signOut.bind(auth);
        window.onAuthStateChanged = auth.onAuthStateChanged.bind(auth);
        window.dispatchEvent(new Event('firebase-auth-ready'));
      }
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(function () {
          exposeAuth();
        })
        .catch(function (err) {
          // Fallback: still expose auth so sign-in works; session may not persist in some environments
          if (typeof console !== 'undefined' && console.warn) {
            console.warn('Firebase persistence could not be set:', err.code || err.message);
          }
          exposeAuth();
        });
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('Firebase initialization error:', error);
      }
    }
  } else if (typeof console !== 'undefined' && console.error) {
    console.error('Firebase SDK not loaded');
  }
}

// Initialize when DOM is ready and scripts are loaded
function checkFirebaseAndInitialize() {
  if (typeof firebase !== 'undefined' && firebase.initializeApp && firebase.auth) {
    initializeFirebase();
  } else {
    // Wait a bit more for scripts to load
    setTimeout(checkFirebaseAndInitialize, 50);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkFirebaseAndInitialize);
} else {
  checkFirebaseAndInitialize();
}