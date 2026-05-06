/**
 * db.js — Firebase Realtime Database sync
 * Data tasks, submissions, feedbacks sync otomatis ke semua device.
 * localStorage tetap dipakai sebagai cache offline.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, push, remove, onValue, update, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-Y0tDvkRx2AErra1obZ6IG9PoLfrRVUA",
  authDomain: "tugas-68ece.firebaseapp.com",
  databaseURL: "https://tugas-68ece-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tugas-68ece",
  storageBucket: "tugas-68ece.firebasestorage.app",
  messagingSenderId: "984169338910",
  appId: "1:984169338910:web:1d068db6eefda034a0360f"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ─── TASKS ───────────────────────────────────────────────────────────────────

export function listenTasks(callback) {
  onValue(ref(db, 'tasks'), snap => {
    const data = snap.val() || {};
    const arr  = Object.values(data).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
    localStorage.setItem('tasks', JSON.stringify(arr));
    callback(arr);
  });
}

export async function saveTask(task) {
  await set(ref(db, `tasks/${task.id}`), task);
  // localStorage updated by listener
}

export async function deleteTask(id) {
  await remove(ref(db, `tasks/${id}`));
  // also remove related submissions
  const snap = await get(ref(db, 'submissions'));
  const subs = snap.val() || {};
  const deletes = Object.entries(subs)
    .filter(([,s]) => s.taskId === id)
    .map(([k]) => remove(ref(db, `submissions/${k}`)));
  await Promise.all(deletes);
}

// ─── SUBMISSIONS ─────────────────────────────────────────────────────────────

export function listenSubmissions(callback) {
  onValue(ref(db, 'submissions'), snap => {
    const data = snap.val() || {};
    const arr  = Object.values(data).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    localStorage.setItem('submissions', JSON.stringify(arr));
    callback(arr);
  });
}

export async function saveSubmission(submission) {
  await set(ref(db, `submissions/${submission.id}`), submission);
}

// ─── FEEDBACKS ───────────────────────────────────────────────────────────────

export function listenFeedbacks(callback) {
  onValue(ref(db, 'feedbacks'), snap => {
    const data = snap.val() || {};
    const arr  = Object.values(data);
    localStorage.setItem('feedbacks', JSON.stringify(arr));
    callback(arr);
  });
}

export async function saveFeedback(fb) {
  await set(ref(db, `feedbacks/${fb.subId}`), fb);
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

export function listenActivityLog(callback) {
  onValue(ref(db, 'activityLog'), snap => {
    const data = snap.val() || {};
    const arr  = Object.values(data).sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0,20);
    localStorage.setItem('activityLog', JSON.stringify(arr));
    callback(arr);
  });
}

export async function addActivityLog(entry) {
  await push(ref(db, 'activityLog'), entry);
}

// ─── PERSONAL TASKS (per user, tetap localStorage) ───────────────────────────
// Personal tasks tidak perlu sync antar device karena sifatnya pribadi per siswa.
// Tetap pakai localStorage.

export const DB = { listenTasks, saveTask, deleteTask, listenSubmissions, saveSubmission, listenFeedbacks, saveFeedback, listenActivityLog, addActivityLog };
