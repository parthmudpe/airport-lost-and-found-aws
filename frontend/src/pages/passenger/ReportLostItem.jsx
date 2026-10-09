import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../../api/client';
import { useToast } from '../../components/Toast.jsx';

const CATEGORIES = ['Electronics', 'Bags', 'Wallets', 'Clothing', 'Jewelry', 'Documents', 'Toys', 'Other'];

const initial = {
  category: '', itemName: '', description: '', brand: '', model: '', color: '',
  serialNumber: '', uniqueFeatures: '', dateLost: '', timeLost: '', airportId: '',
  terminal: '', locationArea: '', flightNumber: '', contactPhone: '', contactEmail: '',
  additionalNotes: '',
};

export default function ReportLostItem() {
  const [form, setForm] = useState(initial);
  const [airports, setAirports] = useState([]);
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => { Api.airports().then(setAirports); }, []);

  const selectedAirport = airports.find((a) => a.id === form.airportId);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      images.forEach((img) => fd.append('images', img));
      const { lostItem } = await Api.createLostItem(fd);
      toast(`Report ${lostItem.report_number} submitted.`);
      navigate('/passenger/reports');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit report. Check the form and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold mb-1">Report a lost item</h1>
      <p className="text-sm text-runway-700 mb-6">Give as much detail as you can — it helps our matching system find your item faster.</p>

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        {error && <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Category *</label>
            <select required className="input" value={form.category} onChange={(e) => update('category', e.target.value)}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Item name *</label>
            <input required className="input" value={form.itemName} onChange={(e) => update('itemName', e.target.value)} placeholder="e.g. iPhone 15 Pro" />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)}
            placeholder="Color, condition, anything distinctive..." />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div><label className="label">Brand</label><input className="input" value={form.brand} onChange={(e) => update('brand', e.target.value)} /></div>
          <div><label className="label">Model</label><input className="input" value={form.model} onChange={(e) => update('model', e.target.value)} /></div>
          <div><label className="label">Color</label><input className="input" value={form.color} onChange={(e) => update('color', e.target.value)} /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Serial number (optional)</label><input className="input" value={form.serialNumber} onChange={(e) => update('serialNumber', e.target.value)} /></div>
          <div><label className="label">Unique identifying features</label><input className="input" value={form.uniqueFeatures} onChange={(e) => update('uniqueFeatures', e.target.value)} placeholder="e.g. sticker on the case, dent" /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Date lost *</label><input type="date" required className="input" value={form.dateLost} onChange={(e) => update('dateLost', e.target.value)} /></div>
          <div><label className="label">Approximate time</label><input type="time" className="input" value={form.timeLost} onChange={(e) => update('timeLost', e.target.value)} /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Airport *</label>
            <select required className="input" value={form.airportId} onChange={(e) => update('airportId', e.target.value)}>
              <option value="">Select an airport</option>
              {airports.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Terminal</label>
            <select className="input" value={form.terminal} onChange={(e) => update('terminal', e.target.value)} disabled={!selectedAirport}>
              <option value="">Select a terminal</option>
              {(selectedAirport?.terminals || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Gate / area / location</label><input className="input" value={form.locationArea} onChange={(e) => update('locationArea', e.target.value)} placeholder="e.g. Gate B22 seating" /></div>
          <div><label className="label">Flight number (optional)</label><input className="input" value={form.flightNumber} onChange={(e) => update('flightNumber', e.target.value)} /></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Contact phone</label><input className="input" value={form.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} /></div>
          <div><label className="label">Contact email</label><input type="email" className="input" value={form.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} /></div>
        </div>

        <div>
          <label className="label">Photos</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple
            onChange={(e) => setImages(Array.from(e.target.files || []))}
            className="block w-full text-sm text-runway-700 file:mr-4 file:rounded-md file:border-0 file:bg-mist-100 file:px-3 file:py-2 file:text-sm file:font-medium" />
          <p className="text-xs text-runway-700 mt-1">JPG, PNG or WEBP, up to 8MB each.</p>
        </div>

        <div>
          <label className="label">Additional notes</label>
          <textarea className="input" rows={2} value={form.additionalNotes} onChange={(e) => update('additionalNotes', e.target.value)} />
        </div>

        <button type="submit" disabled={busy} className="btn-primary w-full">{busy ? 'Submitting…' : 'Submit report'}</button>
      </form>
    </div>
  );
}
