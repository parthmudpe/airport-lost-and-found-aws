
import { useEffect, useState } from 'react';
import { Api } from '../api/client';

export default function PhotoGallery({ images, label = 'Photos' }) {
  const imageSignature = Array.isArray(images) ? images.join('\n') : '';
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    const keys = imageSignature ? imageSignature.split('\n') : [];

    setPhotos([]);
    setError('');

    if (keys.length === 0) {
      setLoading(false);
      return undefined;
    }

    async function loadPhotos() {
      setLoading(true);

      try {
        const results = await Promise.all(
          keys.map(async (key) => {
            try {
              const result = await Api.getPhotoUrl(key);

              if (result.mode === 'signed' && result.url) {
                return { key, url: result.url, failed: false };
              }

              if (result.mode === 'proxy') {
                const blob = await Api.getPhotoBlob(key);
                const objectUrl = URL.createObjectURL(blob);
                objectUrls.push(objectUrl);
                return { key, url: objectUrl, failed: false };
              }

              throw new Error('Image URL unavailable.');
            } catch {
              return { key, url: '', failed: true };
            }
          })
        );

        if (!cancelled) {
          setPhotos(results);
          if (results.some((photo) => photo.failed)) {
            setError('Some photos could not be loaded. Try refreshing the page.');
          }
        }
      } catch {
        if (!cancelled) {
          setError('Could not load photos. Try refreshing the page.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPhotos();

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageSignature]);

  if (!imageSignature) {
    return null;
  }

  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-runway-700 mb-2">
        {label} ({photos.length || imageSignature.split('\n').length})
      </p>

      {loading && (
        <p className="text-xs text-runway-700">Loading photos...</p>
      )}

      {error && (
        <p role="status" className="text-xs text-red-600 mb-2">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={`${photo.key}-${index}`}>
            {photo.url ? (
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                title="Open photo in a new tab"
              >
                <img
                  src={photo.url}
                  alt={`${label} ${index + 1}`}
                  loading="lazy"
                  className="h-24 w-24 rounded-md border border-mist-200 object-cover hover:opacity-80"
                />
              </a>
            ) : photo.failed ? (
              <div className="h-24 w-24 rounded-md border border-mist-200 flex items-center justify-center text-xs text-runway-700 text-center p-2">
                Photo unavailable
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
