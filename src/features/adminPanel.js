import { state, safeFirebaseCall } from '../firebase/init.js';
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const ROLE_OPTIONS = ['viewer', 'scorer', 'member', 'admin'];

async function loadUsers() {
  const usersRef = collection(state.db, 'users');
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function setUserRole(userId, role) {
  if (state.userRole !== 'admin') throw new Error('Not authorized');
  const userRef = doc(state.db, 'users', userId);
  await safeFirebaseCall('setUserRole', () => updateDoc(userRef, { role }));
}

async function removeUser(userId) {
  if (state.userRole !== 'admin') throw new Error('Not authorized');
  const userRef = doc(state.db, 'users', userId);
  await safeFirebaseCall('deleteUser', () => deleteDoc(userRef));
}

async function clearAuditLogs() {
  if (state.userRole !== 'admin') throw new Error('Not authorized');
  const logsRef = collection(state.db, 'audit_logs');
  const snapshot = await getDocs(logsRef);
  const deletions = snapshot.docs.map(d => deleteDoc(d.ref));
  await safeFirebaseCall('clearAuditLogs', () => Promise.all(deletions));
}

function renderAdminUI(users) {
  const container = document.getElementById('admin-content-area');
  if (!container) return;

  container.innerHTML = '';

  const userSection = document.createElement('div');
  userSection.innerHTML = '<h3 class="font-semibold mb-2">User Management</h3>';
  const table = document.createElement('table');
  table.className = 'w-full text-sm mb-4';
  const header = document.createElement('tr');
  header.innerHTML = '<th class="text-left">Name</th><th class="text-left">Email</th><th class="text-left">Role</th><th></th>';
  table.appendChild(header);

  users.forEach(u => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${u.name || ''}</td>
      <td>${u.email || ''}</td>
      <td>
        <select data-user-id="${u.id}" class="role-select border rounded p-1">
          ${ROLE_OPTIONS.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </td>
      <td><button data-delete-user-id="${u.id}" class="delete-user text-red-600">Delete</button></td>
    `;
    table.appendChild(row);
  });
  userSection.appendChild(table);
  container.appendChild(userSection);

  const maintenance = document.createElement('div');
  maintenance.innerHTML = `
    <h3 class="font-semibold mb-2">Database Maintenance</h3>
    <button id="clear-logs" class="bg-red-500 text-white px-3 py-1 rounded">Clear Audit Logs</button>
  `;
  container.appendChild(maintenance);
}

function registerEvents() {
  const container = document.getElementById('admin-content-area');
  if (!container) return;

  container.addEventListener('change', async (e) => {
    const select = e.target.closest('select.role-select');
    if (select) {
      const userId = select.dataset.userId;
      const newRole = select.value;
      try {
        await setUserRole(userId, newRole);
        console.log('Role updated');
      } catch (err) {
        console.error('Failed to update role', err);
      }
    }
  });

  container.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('button.delete-user');
    if (deleteBtn) {
      const userId = deleteBtn.dataset.deleteUserId;
      if (confirm('Delete user?')) {
        try {
          await removeUser(userId);
          await loadAndRenderUsers();
          console.log('User deleted');
        } catch (err) {
          console.error('Failed to delete user', err);
        }
      }
    }

    if (e.target.id === 'clear-logs') {
      if (confirm('Clear all audit logs?')) {
        try {
          await clearAuditLogs();
          console.log('Audit logs cleared');
        } catch (err) {
          console.error('Failed to clear logs', err);
        }
      }
    }
  });
}

async function loadAndRenderUsers() {
  if (state.userRole !== 'admin') return;
  const users = await loadUsers();
  renderAdminUI(users);
}

export async function initAdminPanel() {
  if (state.userRole !== 'admin') {
    const container = document.getElementById('admin-content-area');
    if (container) {
      container.innerHTML = '<p class="text-red-600">Admin access required.</p>';
    }
    return;
  }

  await loadAndRenderUsers();
  registerEvents();
}

