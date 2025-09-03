import { state, safeFirebaseCall, validateInput } from '../firebase/init.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

let profiles = [];

async function loadProfiles() {
  try {
    const snap = await safeFirebaseCall('loadProfiles', () =>
      getDocs(collection(state.db, 'players'))
    );
    profiles = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.players = profiles;
    renderProfileList();
    populateSelect();
  } catch (err) {
    console.error('Failed to load profiles', err);
    alert('Failed to load profiles');
  }
}

async function createProfile(name, nickname) {
  await safeFirebaseCall('createProfile', () =>
    addDoc(collection(state.db, 'players'), { name, nickname })
  );
  await loadProfiles();
}

async function updateProfileData(id, data) {
  await safeFirebaseCall('updateProfile', () =>
    updateDoc(doc(state.db, 'players', id), data)
  );
  await loadProfiles();
}

async function deleteProfileData(id) {
  await safeFirebaseCall('deleteProfile', () =>
    deleteDoc(doc(state.db, 'players', id))
  );
  await loadProfiles();
}

function renderProfileList() {
  const list = document.getElementById('profile-list');
  if (!list) return;
  list.innerHTML = '';
  profiles.forEach(p => {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center p-2 border border-gray-300 rounded-xl';
    const span = document.createElement('span');
    span.textContent = p.nickname ? `${p.name} (${p.nickname})` : p.name;
    li.appendChild(span);
    const btns = document.createElement('div');
    btns.className = 'space-x-2';
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'text-sm text-blue-600';
    editBtn.addEventListener('click', () => openModal(p.id));
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.className = 'text-sm text-red-600';
    delBtn.addEventListener('click', async () => {
      if (confirm('Delete this profile?')) {
        try {
          await deleteProfileData(p.id);
        } catch (err) {
          alert(err.message);
        }
      }
    });
    btns.append(editBtn, delBtn);
    li.appendChild(btns);
    list.appendChild(li);
  });
}

function populateSelect() {
  const select = document.getElementById('profile-player-select');
  if (!select) return;
  select.innerHTML = '';
  const baseOpt = document.createElement('option');
  baseOpt.value = '';
  baseOpt.textContent = 'Choose a player...';
  select.appendChild(baseOpt);
  const newOpt = document.createElement('option');
  newOpt.value = 'new';
  newOpt.textContent = '+ New Player';
  select.appendChild(newOpt);
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nickname ? `${p.name} (${p.nickname})` : p.name;
    select.appendChild(opt);
  });
}

function openModal(id = '') {
  const modal = document.getElementById('profile-management-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  populateSelect();
  const select = document.getElementById('profile-player-select');
  select.value = id || 'new';
  handleSelectChange();
}

function closeModal() {
  const modal = document.getElementById('profile-management-modal');
  if (modal) modal.classList.add('hidden');
}

function handleSelectChange() {
  const select = document.getElementById('profile-player-select');
  const section = document.getElementById('profile-edit-section');
  const nameInput = document.getElementById('profile-edit-name');
  const nickInput = document.getElementById('profile-edit-nickname');
  const saveBtn = document.getElementById('profile-edit-save');
  const deleteBtn = ensureDeleteButton();

  if (!select || !section) return;

  const id = select.value;
  if (!id) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  if (id === 'new') {
    nameInput.value = '';
    nickInput.value = '';
    saveBtn.textContent = 'Create Profile';
    deleteBtn.classList.add('hidden');
  } else {
    const p = profiles.find(pr => pr.id === id) || {};
    nameInput.value = p.name || '';
    nickInput.value = p.nickname || '';
    saveBtn.textContent = 'Save Changes';
    deleteBtn.classList.remove('hidden');
  }
}

function setupUI() {
  const container = document.getElementById('tab-content-my-profile');
  if (!container) return;
  container.innerHTML = `
    <div class="space-y-4">
      <button id="manage-profiles-btn" class="bg-emerald-600 text-white py-2 px-4 rounded-xl">Manage Player Profiles</button>
      <ul id="profile-list" class="space-y-2"></ul>
    </div>
  `;
}

function ensureDeleteButton() {
  let btn = document.getElementById('profile-edit-delete');
  if (!btn) {
    const row = document.querySelector('#profile-edit-section .flex');
    if (!row) return document.createElement('span');
    btn = document.createElement('button');
    btn.id = 'profile-edit-delete';
    btn.className = 'bg-red-600 text-white py-2 px-4 rounded-xl';
    btn.textContent = 'Delete';
    row.prepend(btn);
  }
  return btn;
}

function bindEventListeners() {
  const manageBtn = document.getElementById('manage-profiles-btn');
  manageBtn?.addEventListener('click', () => openModal());

  const closeBtn = document.getElementById('profile-management-close');
  closeBtn?.addEventListener('click', closeModal);

  const cancelBtn = document.getElementById('profile-edit-cancel');
  cancelBtn?.addEventListener('click', () => {
    closeModal();
  });

  const select = document.getElementById('profile-player-select');
  select?.addEventListener('change', handleSelectChange);

  const saveBtn = document.getElementById('profile-edit-save');
  saveBtn?.addEventListener('click', async () => {
    const id = select?.value;
    let name = document.getElementById('profile-edit-name').value;
    let nickname = document.getElementById('profile-edit-nickname').value;
    try {
      name = validateInput(name, 50);
      nickname = validateInput(nickname, 50);
    } catch (err) {
      alert(err.message);
      return;
    }
    if (!name) {
      alert('Name is required');
      return;
    }
    try {
      if (id === 'new') {
        await createProfile(name, nickname);
      } else {
        await updateProfileData(id, { name, nickname });
      }
      closeModal();
    } catch (err) {
      alert(err.message);
    }
  });

  const deleteBtn = ensureDeleteButton();
  deleteBtn?.addEventListener('click', async () => {
    const id = select?.value;
    if (id && id !== 'new' && confirm('Delete this profile?')) {
      try {
        await deleteProfileData(id);
        closeModal();
      } catch (err) {
        alert(err.message);
      }
    }
  });
}

export async function initPlayerProfiles() {
  setupUI();
  bindEventListeners();
  await loadProfiles();
}

