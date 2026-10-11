import { useCallback, useEffect, useState } from 'react';
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
  serialNumber: '', uniqueFeatures: '', dateFound: '', timeFound: '', airportId: '',
  terminal: '', locationArea: '', storageLocation: '',
};

function errorMessage(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

export default function RegisterFoundItem() {
  const [form, setForm] = useState({ ...initial });
  const [airports, setAirports] = useState([]);
  const [airportsLoading, setAirportsLoading] = useState(true);
  const [airportError, setAirportError] = useState('');
  const [airportRetry, setAirportRetry] = useState(0);
  const [images, setImages] = useState([]);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

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
      setAirportError(
        errorMessage(err, 'Could not load airports. Please try again.')
      );
    } finally {
      setAirportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAirports();
  }, [loadAirports, airportRetry]);

  const selectedAirport = airports.find(
    (airport) => airport.id === form.airportId
  );

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
    setResult(null);

    if (airportsLoading) {
      setError('Please wait until the airport list finishes loading.');
      return;
    }

    if (airportError || airports.length === 0) {
      setError('Load the airport list successfully before registering an item.');
      return;
    }

    if (!airports.some((airport) => airport.id === form.airportId)) {
      setError('Please select a valid airport.');
      return;
    }

    if (
      photoError ||
      images.length > MAX_IMAGES ||
      images.some((file) => file.size > MAX_IMAGE_BYTES)
    ) {
      setError(
        photoError ||
        'Choose up to 5 images, with each image no larger than 8 MB.'
      );
      return;
    }

    setBusy(true);

    try {
      const formData = new FormData();

      Object.entries(form).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      images.forEach((image) => formData.append('images', image));

      const { foundItem } = await Api.createFoundItem(formData);

      toast(`Found item ${foundItem.found_number} registered.`);
      setResult(foundItem);
      setForm({ ...initial });
      setImages([]);

      const fileInput = document.getElementById('found-item-photos');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(
        errorMessage(
          err,
          'Could not register item. Check the form and try again.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold mb-1">
        Register a found item
      </h1>

      <p className="text-sm text-runway-700 mb-6">
        This automatically checks it against open lost-item reports and flags
        any possible matches for review.
      </p>

      {result && (
        <div
          className="card p-4 mb-4 bg-signal-500/5 border-signal-500/30"
          role="status"
        >
          <p className="text-sm font-medium">
            {result.found_number} registered — status:{' '}
            {result.status.replaceAll('_', ' ')}.
          </p>

          {result.status === 'POSSIBLE_MATCH' && (
            <p className="text-xs text-runway-700 mt-1">
              A possible match was found. Check Match review.
            </p>
          )}
        </div>
      )}

      {airportError && (
        <div className="card p-4 mb-4">
          <p role="alert" className="text-sm text-red-600 mb-3">
            {airportError}
          </p>

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
          <p
            role="alert"
            className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="found-category">Category *</label>
            <select
              id="found-category"
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
            <label className="label" htmlFor="found-name">Item name *</label>
            <input
              id="found-name"
              required
              className="input"
              value={form.itemName}
              onChange={(event) => update('itemName', event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="found-description">Description</label>
          <textarea
            id="found-description"
            className="input"
            rows={3}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
          />
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="found-brand">Brand</label>
            <input id="found-brand" className="input" value={form.brand}
              onChange={(event) => update('brand', event.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="found-model">Model</label>
            <input id="found-model" className="input" value={form.model}
              onChange={(event) => update('model', event.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="found-color">Color</label>
            <input id="found-color" className="input" value={form.color}
              onChange={(event) => update('color', event.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="found-serial">Serial number</label>
            <input id="found-serial" className="input" value={form.serialNumber}
              onChange={(event) => update('serialNumber', event.target.value)} />
          </div>

          <div>
            <label className="label" htmlFor="found-features">
              Unique identifying features
            </label>
            <input id="found-features" className="input" value={form.uniqueFeatures}
              onChange={(event) => update('uniqueFeatures', event.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="found-date">Date found *</label>
            <input
              id="found-date"
              type="date"
              required
              className="input"
              value={form.dateFound}
              onChange={(event) => update('dateFound', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="found-time">Time found</label>
            <input
              id="found-time"
              type="time"
              className="input"
              value={form.timeFound}
              onChange={(event) => update('timeFound', event.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="found-airport">Airport *</label>
            <select
              id="found-airport"
              required
              className="input"
              value={form.airportId}
              disabled={airportsLoading || airports.length === 0}
              onChange={(event) => setForm((current) => ({
                ...current,
                airportId: event.target.value,
                terminal: '',
              }))}
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
            <label className="label" htmlFor="found-terminal">Terminal</label>
            <select
              id="found-terminal"
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
            <label className="label" htmlFor="found-location">
              Gate / area / location found
            </label>
            <input
              id="found-location"
              className="input"
              value={form.locationArea}
              onChange={(event) => update('locationArea', event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="found-storage">
              Storage location *
            </label>
            <input
              id="found-storage"
              required
              className="input"
              placeholder="e.g. T4 Lost & Found Locker A-12"
              value={form.storageLocation}
              onChange={(event) => update('storageLocation', event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="found-item-photos">Photos</label>
          <input
            id="found-item-photos"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleImageChange}
            className="block w-full text-sm text-runway-700 file:mr-4 file:rounded-md file:border-0 file:bg-mist-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />

          <p className="text-xs text-runway-700 mt-1">
            JPG, PNG or WEBP. Maximum 5 photos, 8 MB each.
          </p>

          {photoError && (
            <p role="alert" className="text-xs text-red-600 mt-1">{photoError}</p>
          )}

          {images.length > 0 && (
            <p className="text-xs text-runway-700 mt-1">
              {images.length} photo{images.length === 1 ? '' : 's'} selected.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || airportsLoading || airports.length === 0}
          className="btn-primary w-full"
        >
          {busy ? 'Registering...' : 'Register found item'}
        </button>
      </form>
    </div>
  );
}