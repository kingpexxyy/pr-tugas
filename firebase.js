/**
 * Firebase Integration (Opsional)
 *
 * File ini adalah placeholder. App ini sudah berjalan penuh dengan localStorage.
 * Kalau mau pakai Firebase Firestore sebagai backend real-time:
 *
 * 1. Buat project di https://console.firebase.google.com
 * 2. Aktifkan Firestore Database
 * 3. Copy config dari Project Settings → Your apps → Web app
 * 4. Ganti nilai di bawah dengan config kamu
 * 5. Uncomment semua kode di bawah
 *
 * Tanpa Firebase, semua data tersimpan di localStorage browser
 * dan tidak akan hilang selama tidak clear browser data.
 */

// const firebaseConfig = {
//   apiKey: "GANTI_API_KEY",
//   authDomain: "GANTI_PROJECT_ID.firebaseapp.com",
//   projectId: "GANTI_PROJECT_ID",
//   storageBucket: "GANTI_PROJECT_ID.appspot.com",
//   messagingSenderId: "GANTI_SENDER_ID",
//   appId: "GANTI_APP_ID"
// };

// import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
// import { getFirestore, doc, setDoc, deleteDoc, collection, query, orderBy, where, onSnapshot, addDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// const app = initializeApp(firebaseConfig);
// const db = getFirestore(app);
// const auth = getAuth(app);

// Firebase tidak digunakan — app berjalan dengan localStorage
console.log('TugasKu: Menggunakan localStorage sebagai penyimpanan data.');
