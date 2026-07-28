// Volta Records — Shared Chat Module
// Used by artist.html, manager.html, and admin.html

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, addDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC0Y51ipqSxtP8lgZhhdM_vUrqTIkm2VQo",
  authDomain: "volta-records-7647c.firebaseapp.com",
  projectId: "volta-records-7647c",
  storageBucket: "volta-records-7647c.firebasestorage.app",
  messagingSenderId: "965622035230",
  appId: "1:965622035230:web:59184ef3b9b42504978f0f"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export function chatId(uidA, uidB){
  return [uidA, uidB].sort().join('_');
}

// Who each role is allowed to see/chat with
export async function getEligibleContacts(currentUid, currentRole){
  const snap = await getDocs(collection(db, "users"));
  const contacts = [];
  snap.forEach(d => {
    if(d.id === currentUid) return;
    const u = d.data();
    const role = u.role;
    let allowed = false;
    if(currentRole === 'admin') allowed = true;
    else if(currentRole === 'artist') allowed = ['manager','admin','artist'].includes(role);
    else if(currentRole === 'manager') allowed = ['artist','admin','promoter'].includes(role);
    else if(currentRole === 'promoter') allowed = ['manager','admin'].includes(role);
    if(allowed) contacts.push({ id: d.id, ...u });
  });
  return contacts;
}

function initials(name){
  if(!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0]||'') + (parts[1]?.[0]||'')).toUpperCase() || name[0].toUpperCase();
}

function formatTime(ts){
  if(!ts || !ts.toDate) return '';
  return ts.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}

export function mountChat(container, currentUid, currentRole, currentName){
  container.innerHTML = `
    <div id="chatRoot" style="display:flex;height:520px;max-height:70vh;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;background:#141319;">
      <div id="contactList" style="width:120px;flex-shrink:0;border-right:1px solid rgba(255,255,255,0.08);overflow-y:auto;"></div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0;">
        <div id="chatHeader" style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);font-weight:700;font-size:0.9em;color:#9a97a6;">Select a contact</div>
        <div id="messagesArea" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;"></div>
        <div id="composerArea" style="display:none;padding:10px;border-top:1px solid rgba(255,255,255,0.08);gap:8px;flex-wrap:wrap;">
          <input type="text" id="chatTextInput" placeholder="Type a message..." style="flex:1;min-width:120px;padding:10px 12px;background:#0b0b0f;border:1px solid rgba(255,255,255,0.15);color:#f4f0e8;border-radius:20px;font-size:0.88em;">
          <button id="chatSendBtn" style="padding:10px 14px;background:#7c5cff;color:#fff;border:none;border-radius:20px;font-size:0.85em;cursor:pointer;">Send</button>
          <button id="chatImgBtn" title="Send photo" style="padding:10px 12px;background:#1c1a24;color:#e8b84b;border:none;border-radius:20px;cursor:pointer;">📷</button>
          <input type="file" id="chatImgInput" accept="image/*" style="display:none;">
          <button id="chatVoiceBtn" title="Record voice note" style="padding:10px 12px;background:#1c1a24;color:#e8b84b;border:none;border-radius:20px;cursor:pointer;">🎙️</button>
        </div>
      </div>
    </div>
  `;

  const contactListEl = container.querySelector('#contactList');
  const chatHeaderEl = container.querySelector('#chatHeader');
  const messagesAreaEl = container.querySelector('#messagesArea');
  const composerAreaEl = container.querySelector('#composerArea');
  const textInput = container.querySelector('#chatTextInput');
  const sendBtn = container.querySelector('#chatSendBtn');
  const imgBtn = container.querySelector('#chatImgBtn');
  const imgInput = container.querySelector('#chatImgInput');
  const voiceBtn = container.querySelector('#chatVoiceBtn');

  let activeContact = null;
  let unsubscribe = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  async function loadContacts(){
    const contacts = await getEligibleContacts(currentUid, currentRole);
    contactListEl.innerHTML = '';
    if(contacts.length === 0){
      contactListEl.innerHTML = '<div style="padding:14px;color:#9a97a6;font-size:0.75em;">No contacts yet.</div>';
      return;
    }
    contacts.forEach(c => {
      const btn = document.createElement('div');
      btn.style.cssText = 'padding:12px 8px;text-align:center;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);';
      btn.innerHTML = `
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#7c5cff,#e8b84b);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;color:#0b0b0f;margin:0 auto 6px;">${initials(c.name)}</div>
        <div style="font-size:0.68em;color:#f4f0e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name || c.email}</div>
        <div style="font-size:0.6em;color:#9a97a6;text-transform:uppercase;">${c.role}</div>
      `;
      btn.addEventListener('click', () => openThread(c));
      contactListEl.appendChild(btn);
    });
  }

  function openThread(contact){
    activeContact = contact;
    chatHeaderEl.textContent = contact.name || contact.email;
    composerAreaEl.style.display = 'flex';
    if(unsubscribe) unsubscribe();

    const id = chatId(currentUid, contact.id);
    setDoc(doc(db, "chats", id), { participants: [currentUid, contact.id] }, { merge: true });

    const q = query(collection(db, "chats", id, "messages"), orderBy("createdAt", "asc"));
    unsubscribe = onSnapshot(q, (snap) => {
      messagesAreaEl.innerHTML = '';
      snap.forEach(d => {
        const m = d.data();
        const mine = m.senderId === currentUid;
        const bubble = document.createElement('div');
        bubble.style.cssText = `max-width:75%;align-self:${mine?'flex-end':'flex-start'};background:${mine?'#7c5cff':'#1c1a24'};color:#fff;padding:8px 12px;border-radius:14px;font-size:0.85em;`;
        if(m.type === 'image'){
          bubble.innerHTML = `<img src="${m.url}" style="max-width:100%;border-radius:8px;display:block;">`;
        } else if(m.type === 'audio'){
          bubble.innerHTML = `<audio src="${m.url}" controls style="max-width:200px;"></audio>`;
        } else {
          bubble.textContent = m.text;
        }
        messagesAreaEl.appendChild(bubble);
      });
      messagesAreaEl.scrollTop = messagesAreaEl.scrollHeight;
    });
  }

  async function sendMessage(payload){
    if(!activeContact) return;
    const id = chatId(currentUid, activeContact.id);
    await addDoc(collection(db, "chats", id, "messages"), {
      senderId: currentUid,
      senderName: currentName,
      createdAt: serverTimestamp(),
      ...payload
    });
  }

  sendBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if(!text) return;
    sendMessage({ type: 'text', text });
    textInput.value = '';
  });
  textInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendBtn.click(); });

  imgBtn.addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', async () => {
    const file = imgInput.files[0];
    if(!file || !activeContact) return;
    const id = chatId(currentUid, activeContact.id);
    const path = `chat_media/${id}/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    sendMessage({ type: 'image', url });
    imgInput.value = '';
  });

  voiceBtn.addEventListener('click', async () => {
    if(!isRecording){
      try{
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordedChunks, { type: 'audio/webm' });
          const id = chatId(currentUid, activeContact.id);
          const path = `chat_media/${id}/${Date.now()}_voice.webm`;
          const fileRef = ref(storage, path);
          await uploadBytes(fileRef, blob);
          const url = await getDownloadURL(fileRef);
          sendMessage({ type: 'audio', url });
          stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.textContent = '⏹️';
        voiceBtn.style.background = '#ff5c7a';
      }catch(e){
        alert('Microphone access denied or unavailable.');
      }
    } else {
      mediaRecorder.stop();
      isRecording = false;
      voiceBtn.textContent = '🎙️';
      voiceBtn.style.background = '#1c1a24';
    }
  });

  loadContacts();
  }
