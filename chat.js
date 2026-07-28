// Volta Records — Shared Chat Module (Messenger-style)
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

const ROLE_LABELS = { artist: 'Artists', manager: 'Managers', admin: 'Admin', promoter: 'Promoters' };

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

let stylesInjected = false;
function injectStyles(){
  if(stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .vlt-msg-fab{
      position:fixed;bottom:22px;right:22px;width:58px;height:58px;border-radius:50%;
      background:linear-gradient(135deg,#7c5cff,#e8b84b);border:none;cursor:pointer;
      display:flex;align-items:center;justify-content:center;font-size:1.5em;
      box-shadow:0 8px 20px rgba(124,92,255,0.4);z-index:900;
    }
    .vlt-chat-overlay{
      position:fixed;inset:0;background:#0b0b0f;z-index:950;display:none;flex-direction:column;
      font-family:'Inter',sans-serif;
    }
    .vlt-chat-overlay.open{display:flex;}
    .vlt-chat-top{
      display:flex;align-items:center;gap:12px;padding:14px 16px;
      border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;
    }
    .vlt-back{background:none;border:none;color:#f4f0e8;font-size:1.3em;cursor:pointer;padding:4px 8px;}
    .vlt-chat-title{font-weight:800;color:#f4f0e8;font-size:1.05em;flex:1;}
    .vlt-close{background:none;border:none;color:#9a97a6;font-size:1.4em;cursor:pointer;padding:4px 8px;}
    .vlt-list-view{flex:1;overflow-y:auto;padding:8px 0;}
    .vlt-category{padding:14px 18px 6px;color:#9a97a6;font-size:0.72em;text-transform:uppercase;letter-spacing:1px;font-weight:700;}
    .vlt-contact-row{
      display:flex;align-items:center;gap:12px;padding:12px 18px;cursor:pointer;
    }
    .vlt-contact-row:active{background:rgba(255,255,255,0.04);}
    .vlt-avatar{
      width:44px;height:44px;border-radius:50%;flex-shrink:0;
      background:linear-gradient(135deg,#7c5cff,#e8b84b);color:#0b0b0f;
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.95em;
    }
    .vlt-contact-info b{display:block;color:#f4f0e8;font-size:0.95em;}
    .vlt-contact-info span{color:#9a97a6;font-size:0.78em;}
    .vlt-thread-view{flex:1;display:none;flex-direction:column;min-height:0;}
    .vlt-thread-view.active{display:flex;}
    .vlt-list-view.hidden{display:none;}
    .vlt-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;}
    .vlt-bubble{max-width:75%;padding:9px 13px;border-radius:16px;font-size:0.9em;color:#fff;line-height:1.35;}
    .vlt-bubble.mine{align-self:flex-end;background:#7c5cff;}
    .vlt-bubble.theirs{align-self:flex-start;background:#1c1a24;}
    .vlt-composer{
      display:flex;gap:8px;padding:10px 12px;border-top:1px solid rgba(255,255,255,0.08);
      flex-wrap:wrap;flex-shrink:0;align-items:center;
    }
    .vlt-composer input[type=text]{
      flex:1;min-width:100px;padding:11px 14px;background:#141319;border:1px solid rgba(255,255,255,0.15);
      color:#f4f0e8;border-radius:22px;font-size:0.9em;
    }
    .vlt-icon-btn{
      width:42px;height:42px;border-radius:50%;border:none;background:#1c1a24;color:#e8b84b;
      font-size:1.1em;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;
    }
    .vlt-send-btn{
      padding:11px 18px;background:#7c5cff;color:#fff;border:none;border-radius:22px;
      font-size:0.88em;font-weight:700;cursor:pointer;flex-shrink:0;
    }
    .vlt-empty{color:#9a97a6;font-size:0.9em;text-align:center;padding:40px 20px;}
  `;
  document.head.appendChild(style);
}

export function mountChat(container, currentUid, currentRole, currentName){
  injectStyles();

  container.innerHTML = `<button class="vlt-msg-fab" id="vltFab" title="Messages">💬</button>
    <div class="vlt-chat-overlay" id="vltOverlay">
      <div class="vlt-chat-top">
        <button class="vlt-back" id="vltBack" style="display:none;">←</button>
        <div class="vlt-chat-title" id="vltTitle">Messages</div>
        <button class="vlt-close" id="vltClose">✕</button>
      </div>
      <div class="vlt-list-view" id="vltListView"></div>
      <div class="vlt-thread-view" id="vltThreadView">
        <div class="vlt-messages" id="vltMessages"></div>
        <div class="vlt-composer">
          <button class="vlt-icon-btn" id="vltImgBtn" title="Send photo">📷</button>
          <input type="file" id="vltImgInput" accept="image/*" style="display:none;">
          <button class="vlt-icon-btn" id="vltVoiceBtn" title="Voice note">🎙️</button>
          <input type="text" id="vltTextInput" placeholder="Message...">
          <button class="vlt-send-btn" id="vltSendBtn">Send</button>
        </div>
      </div>
    </div>`;

  const fab = container.querySelector('#vltFab');
  const overlay = container.querySelector('#vltOverlay');
  const backBtn = container.querySelector('#vltBack');
  const closeBtn = container.querySelector('#vltClose');
  const titleEl = container.querySelector('#vltTitle');
  const listView = container.querySelector('#vltListView');
  const threadView = container.querySelector('#vltThreadView');
  const messagesEl = container.querySelector('#vltMessages');
  const textInput = container.querySelector('#vltTextInput');
  const sendBtn = container.querySelector('#vltSendBtn');
  const imgBtn = container.querySelector('#vltImgBtn');
  const imgInput = container.querySelector('#vltImgInput');
  const voiceBtn = container.querySelector('#vltVoiceBtn');

  let activeContact = null;
  let unsubscribe = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let isRecording = false;

  fab.addEventListener('click', () => {
    overlay.classList.add('open');
    showList();
  });
  closeBtn.addEventListener('click', () => overlay.classList.remove('open'));
  backBtn.addEventListener('click', () => showList());

  function showList(){
    titleEl.textContent = 'Messages';
    backBtn.style.display = 'none';
    listView.classList.remove('hidden');
    threadView.classList.remove('active');
    if(unsubscribe){ unsubscribe(); unsubscribe = null; }
    loadContacts();
  }

  async function loadContacts(){
    const contacts = await getEligibleContacts(currentUid, currentRole);
    if(contacts.length === 0){
      listView.innerHTML = '<div class="vlt-empty">No contacts available yet.</div>';
      return;
    }
    const grouped = {};
    contacts.forEach(c => {
      const key = c.role || 'other';
      if(!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    listView.innerHTML = '';
    Object.keys(grouped).forEach(role => {
      const label = document.createElement('div');
      label.className = 'vlt-category';
      label.textContent = ROLE_LABELS[role] || role;
      listView.appendChild(label);

      grouped[role].forEach(c => {
        const row = document.createElement('div');
        row.className = 'vlt-contact-row';
        const avatarHTML = c.photoURL
          ? `<div class="vlt-avatar" style="overflow:hidden;"><img src="${c.photoURL}" style="width:100%;height:100%;object-fit:cover;"></div>`
          : `<div class="vlt-avatar">${initials(c.name)}</div>`;
        row.innerHTML = `
          ${avatarHTML}
          <div class="vlt-contact-info"><b>${c.name || c.email}</b><span>${c.email || ''}</span></div>
        `;
        row.addEventListener('click', () => openThread(c));
        listView.appendChild(row);
      });
    });
  }

  function openThread(contact){
    activeContact = contact;
    titleEl.textContent = contact.name || contact.email;
    backBtn.style.display = 'inline-block';
    listView.classList.add('hidden');
    threadView.classList.add('active');

    if(unsubscribe) unsubscribe();
    const id = chatId(currentUid, contact.id);
    setDoc(doc(db, "chats", id), { participants: [currentUid, contact.id] }, { merge: true });

    const q = query(collection(db, "chats", id, "messages"), orderBy("createdAt", "asc"));
    unsubscribe = onSnapshot(q, (snap) => {
      messagesEl.innerHTML = '';
      snap.forEach(d => {
        const m = d.data();
        const mine = m.senderId === currentUid;
        const bubble = document.createElement('div');
        bubble.className = 'vlt-bubble ' + (mine ? 'mine' : 'theirs');
        if(m.type === 'image'){
          bubble.innerHTML = `<img src="${m.url}" style="max-width:100%;border-radius:10px;display:block;">`;
        } else if(m.type === 'audio'){
          bubble.innerHTML = `<audio src="${m.url}" controls style="max-width:220px;"></audio>`;
        } else {
          bubble.textContent = m.text;
        }
        messagesEl.appendChild(bubble);
      });
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  async function sendMessage(payload){
    if(!activeContact) return;
    const id = chatId(currentUid, activeContact.id);
    await addDoc(collection(db, "chats", id, "messages"), {
      senderId: currentUid, senderName: currentName, createdAt: serverTimestamp(), ...payload
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
}
