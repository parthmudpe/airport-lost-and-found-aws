import { useCallback, useEffect, useState } from 'react';
import { Api } from '../../api/client';
import Loading from '../../components/Loading.jsx';
import Modal from '../../components/Modal.jsx';
import { useToast } from '../../components/Toast.jsx';

function getErrorMessage(err, fallback) {
  return (
    err?.response?.data?.error ||
    err?.message ||
    fallback
  );
}

export default function Users() {
  const [users, setUsers] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [busyUserId, setBusyUserId] = useState(null);

  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await Api.adminUsers();
      setUsers(result);
    } catch (err) {
      setError(
        getErrorMessage(err, 'Unable to load users. Please try again.')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleUser(user) {
    if (busyUserId !== null || loading) return;

    setBusyUserId(user.id);
    setError('');

    try {
      await Api.setUserActive(user.id, !user.isActive);

      toast(
        `${user.fullName} ${user.isActive ? 'deactivated' : 'activated'}.`
      );

      await refresh();
    } catch (err) {
      toast(
        getErrorMessage(err, 'Could not update this user.'),
        'error'
      );
    } finally {
      setBusyUserId(null);
    }
  }

  if (loading && users === null) {
    return <Loading />;
  }

  if (users === null) {
    return (
      <div className="card p-6">
        <h1 className="font-display text-xl font-bold mb-2">
          Unable to load users
        </h1>

        <p role="alert" className="text-sm text-red-600 mb-4">
          {error || 'Something went wrong while loading users.'}
        </p>

        <button
          type="button"
          className="btn-primary"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? 'Retrying...' : 'Try again'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">
          Users
        </h1>

        <div className="flex gap-3">
          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={loading || busyUserId !== null}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreateOpen(true)}
          >
            Add staff / admin
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 mb-4">
          <p role="alert" className="text-sm text-red-600 mb-3">
            {error}
          </p>

          <button
            type="button"
            className="btn-secondary"
            onClick={refresh}
            disabled={loading || busyUserId !== null}
          >
            Try again
          </button>
        </div>
      )}

      {users.length === 0 ? (
        <div className="card p-6 text-sm text-runway-700">
          No users found.
        </div>
      ) : (
        <div className="card divide-y divide-mist-200">
          {users.map((user) => (
            <div
              key={user.id}
              className="px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="font-medium text-sm">
                  {user.fullName}
                </p>

                <p className="text-xs text-runway-700">
                  {user.email} · {user.role}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`badge-${
                    user.isActive ? 'success' : 'danger'
                  }`}
                >
                  {user.isActive ? 'Active' : 'Deactivated'}
                </span>

                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => toggleUser(user)}
                  disabled={busyUserId !== null || loading}
                >
                  {busyUserId === user.id
                    ? 'Updating...'
                    : user.isActive
                      ? 'Deactivate'
                      : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateUserModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refresh}
        toast={toast}
      />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated, toast }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'STAFF',
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    if (busy) return;
    setError('');
    onClose();
  }

  async function submit() {
    if (busy) return;

    setBusy(true);
    setError('');

    try {
      await Api.adminCreateUser({
        ...form,
        email: form.email.trim(),
        fullName: form.fullName.trim(),
      });

      toast('Account created.');

      setForm({
        email: '',
        password: '',
        fullName: '',
        role: 'STAFF',
      });

      onClose();
      await onCreated();
    } catch (err) {
      setError(
        getErrorMessage(err, 'Could not create the account.')
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add staff or admin account"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn-primary"
            disabled={
              busy ||
              !form.fullName.trim() ||
              !form.email.trim() ||
              !form.password
            }
            onClick={submit}
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </>
      }
    >
      {error && (
        <p
          role="alert"
          className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-3"
        >
          {error}
        </p>
      )}

      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="user-full-name">
            Full name
          </label>

          <input
            id="user-full-name"
            className="input"
            value={form.fullName}
            onChange={(event) =>
              setForm({ ...form, fullName: event.target.value })
            }
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="user-email">
            Email
          </label>

          <input
            id="user-email"
            type="email"
            className="input"
            value={form.email}
            onChange={(event) =>
              setForm({ ...form, email: event.target.value })
            }
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="user-password">
            Temporary password
          </label>

          <input
            id="user-password"
            type="password"
            className="input"
            value={form.password}
            onChange={(event) =>
              setForm({ ...form, password: event.target.value })
            }
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="user-role">
            Role
          </label>

          <select
            id="user-role"
            className="input"
            value={form.role}
            onChange={(event) =>
              setForm({ ...form, role: event.target.value })
            }
          >
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}