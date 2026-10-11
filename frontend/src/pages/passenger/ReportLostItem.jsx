import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../../api/client';
import { useToast } from '../../components/Toast.jsx';

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const CATEGORIES = [
  'Electronics', 'Bags', 'Wallets', 'Clothing',
  'Jewelry', 'Documents', 'Toys', 'Other',
];

const initial = {
  category: '', itemName: '', description: '', brand: '', model: '', color: '',
  serialNumber: '', uniqueFeatures: '', dateLost: '', timeLost: '', airportId: '',
  terminal: '', locationArea: '', flightNumber: '', contactPhone: '', contactEmail: '',
  additionalNotes: '',
};

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function ReportLostItem() {
  const [form, setForm] = useState({ ...initial });
  const [airports, setAirports] = useState([]);
  const [airportsLoading, setAirportsLoading] = useState(true);
  const [airportError, setAirportError] = useState('');
  const [airportRetry, setAirportRetry] = useState(0);
  const [images, setImages] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const toast = useToast();

  const loadAirports = useCallback(async () => {
    setAirportsLoading(true);
    setAirportError('');

    try {
      const data = await Api.airports();
      if (!Array.isArray(data)) {
        throw new Error('Unexpected response while loading airports.');
      }
      setAirports(data);
      if (data.length === 0) {
        setAirportError('No airports are available right now. Please retry later.');
      }
    } catch (err) {
      setAirportError(errorMessage(err, 'Could not load airports. Please try again.'));
    } finally {
      setAirportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAirports();
  }, [loadAirports, airportRetry]);

  const selectedAirport = airports.find((airport) => airport.id === form.airportId);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleImageChange(event) {
    const selected = Array.from(event.target.files || []);
    setPhotoError('');

    if (selected.length > MAX_IMAGES) {
      setImages([]);
      event.target.value = '';
      setPhotoError(`Select no more than ${MAX_IMAGES} photos.`);
      return;
    }

    if (selected.some((file) => !ALLOWED_IMAGE_TYPES.includes(file.type))) {
      setImages([]);
      event.target.value = '';
      setPhotoError('Only JPG, PNG, and WEBP images are accepted.');
      return;
    }

    if (selected.some((file) => file.size > MAX_IMAGE_BYTES)) {
      setImages([]);
      event.target.value = '';
      setPhotoError('Each image must be 8 MB or smaller.');
      return;
    }

    setImages(selected);
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError('');

    if (airportsLoading) {
      setError('Please wait until the airport list finishes loading.');
      return;
    }

    if (airportError || airports.length === 0) {
      setError('Load the airport list successfully before submitting your report.');
      return;
    }

    if (!airports.some((airport) => airport.id === form.airportId)) {
      setError('Please select a valid airport.');
      return;
    }

    if (photoError) {
      setError(photoError);
      return;
    }

    if (
      images.length > MAX_IMAGES ||
      images.some((file) => file.size > MAX_IMAGE_BYTES)
    ) {
      setError('Choose up to 5 images, with each image no larger than 8 MB.');
      return;
    }

    setBusy(true);

    try {
      const fd = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (value) fd.append(key, value);
      });

      images.forEach((image) => fd.append('images', image));

      const { lostItem } = await Api.createLostItem(fd);
      toast(`Report ${lostItem.report_number} submitted.`);
      navigate('/passenger/reports');
    } catch (err) {
      setError(errorMessage(err, 'Could not submit report. Check the form and try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold mb-1">Report a lost item</h1>
      <p className="text-sm text-runway-700 mb-6">
        Give as much detail as you can — it helps our matching system find your item faster.
      </p>

      {airportError && (
        <div className="card p-4 mb-4">
          <p role="alert" className="text-sm text-red-600 mb-3">{airportError}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setAirportRetry((key) => key + 1)}
            disabled={airportsLoading}
          >
            {airportsLoading ? 'Loading airports...' : 'Retry airport list'}
          </button>
        </div>
      )}

      <form onSubmit={onSubmit} className="card p-6 space-y-5">
        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-category">Category *</label>
            <select
              id="lost-category"
              required
              className="input"
              value={form.category}
              onChange={(event) => update('category', event.target.value)}
            >
              <option value="">Select a category</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lost-name">Item name *</label>
            <input
              id="lost-name"
              required
              className="input"
              value={form.itemName}
              onChange={(event) => update('itemName', event.target.value)}
              placeholder="e.g. iPhone 15 Pro"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="lost-description">Description</label>
          <textarea
            id="lost-description"
            className="input"
            rows={3}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Color, condition, anything distinctive..."
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="lost-brand">Brand</label>
            <input id="lost-brand" className="input" value={form.brand}
              onChange={(event) => update('brand', event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="lost-model">Model</label>
            <input id="lost-model" className="input" value={form.model}
              onChange={(event) => update('model', event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="lost-color">Color</label>
            <input id="lost-color" className="input" value={form.color}
              onChange={(event) => update('color', event.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-serial">Serial number (optional)</label>
            <input id="lost-serial" className="input" value={form.serialNumber}
              onChange={(event) => update('serialNumber', event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="lost-features">Unique identifying features</label>
            <input id="lost-features" className="input" value={form.uniqueFeatures}
              onChange={(event) => update('uniqueFeatures', event.target.value)}
              placeholder="e.g. sticker on the case, dent" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-date">Date lost *</label>
            <input id="lost-date" type="date" required className="input" value={form.dateLost}
              onChange={(event) => update('dateLost', event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="lost-time">Approximate time</label>
            <input id="lost-time" type="time" className="input" value={form.timeLost}
              onChange={(event) => update('timeLost', event.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-airport">Airport *</label>
            <select
              id="lost-airport"
              required
              className="input"
              value={form.airportId}
              disabled={airportsLoading || airports.length === 0}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  airportId: event.target.value,
                  terminal: '',
                }));
              }}
            >
              <option value="">
                {airportsLoading ? 'Loading airports...' : 'Select an airport'}
              </option>
              {airports.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {airport.code} — {airport.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="lost-terminal">Terminal</label>
            <select
              id="lost-terminal"
              className="input"
              value={form.terminal}
              disabled={!selectedAirport}
              onChange={(event) => update('terminal', event.target.value)}
            >
              <option value="">Select a terminal</option>
              {(selectedAirport?.terminals || []).map((terminal) => (
                <option key={terminal} value={terminal}>{terminal}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-location">Gate / area / location</label>
            <input id="lost-location" className="input" value={form.locationArea}
              onChange={(event) => update('locationArea', event.target.value)}
              placeholder="e.g. Gate B22 seating" />
          </div>
          <div>
            <label className="label" htmlFor="lost-flight">Flight number (optional)</label>
            <input id="lost-flight" className="input" value={form.flightNumber}
              onChange={(event) => update('flightNumber', event.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="lost-phone">Contact phone</label>
            <input id="lost-phone" className="input" value={form.contactPhone}
              onChange={(event) => update('contactPhone', event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="lost-email">Contact email</label>
            <input id="lost-email" type="email" className="input" value={form.contactEmail}
              onChange={(event) => update('contactEmail', event.target.value)} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="lost-photos">Photos</label>
          <input
            id="lost-photos"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleImageChange}
            className="block w-full text-sm text-runway-700 file:mr-4 file:rounded-md file:border-0 file:bg-mist-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          <p className="text-xs text-runway-700 mt-1">
            JPG, PNG or WEBP. Maximum 5 photos, 8 MB each.
          </p>
          {photoError && <p role="alert" className="text-xs text-red-600 mt-1">{photoError}</p>}
          {images.length > 0 && (
            <p className="text-xs text-runway-700 mt-1">
              {images.length} photo{images.length === 1 ? '' : 's'} selected.
            </p>
          )}
        </div>

        <div>
          <label className="label" htmlFor="lost-notes">Additional notes</label>
          <textarea id="lost-notes" className="input" rows={2}
            value={form.additionalNotes}
            onChange={(event) => update('additionalNotes', event.target.value)} />
        </div>

        <button
          type="submit"
          disabled={busy || airportsLoading || airports.length === 0}
          className="btn-primary w-full"
        >
          {busy ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  );
}