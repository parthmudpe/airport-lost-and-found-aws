import { useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function Users() {
  const [users, setUsers] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const toast = useToast();

  async function refresh() { setUsers(await Api.adminUsers()); }
  useEffect(() => { refresh(); }, []);

  if (!users) return <Loading />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Users</h1>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>Add staff / admin</button>
      </div>

      <div className="card divide-y divide-mist-200">
        {users.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{u.fullName}</p>
              <p className="text-xs text-runway-700">{u.email} · {u.role}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge-${u.isActive ? 'success' : 'danger'}`}>{u.isActive ? 'Active' : 'Deactivated'}</span>
              <button className="btn-ghost text-xs" onClick={async () => {
                await Api.setUserActive(u.id, !u.isActive);
                toast(`${u.fullName} ${u.isActive ? 'deactivated' : 'activated'}.`);
                refresh();
              }}>
                {u.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} toast={toast} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated, toast }) {
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'STAFF' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await Api.adminCreateUser(form);
      toast('Account created.');
      setForm({ email: '', password: '', fullName: '', role: 'STAFF' });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add staff or admin account"
      footer={<>
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Creating…' : 'Create account'}</button>
      </>}>
      {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-3">{error}</p>}
      <div className="space-y-3">
        <div><label className="label">Full name</label><input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
        <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label">Temporary password</label><input type="text" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
