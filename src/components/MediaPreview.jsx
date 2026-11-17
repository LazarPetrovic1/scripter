
import { useEffect, useState } from 'react';
import { getFileType } from '../utils/filetypes';

export default function MediaPreview({ path }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');
  const type = getFileType(path);

  useEffect(() => {
    let disposed = false;
    setSrc(null);
    setError('');
    window.desktop.getMediaUrl(path)
      .then((url) => { if (!disposed) setSrc(url); })
      .catch((err) => { if (!disposed) setError(err.message || 'Could not load media.'); });
    return () => { disposed = true; };
  }, [path]);

  if (error) return <div className="media-error">{error}</div>;
  if (!src) return <div className="media-loading">Loading preview...</div>;

  return (
    <div className={`media-preview media-${type}`}>
      {type === 'image' && <img src={src} alt={path.split(/[\\/]/).pop()} />}
      {type === 'audio' && (
        <audio controls preload="metadata" src={src}>
          Your browser does not support audio playback.
        </audio>
      )}

      {type === 'video' && (
        <video controls preload="metadata" src={src}>
          Your browser does not support video playback.
        </video>
      )}
    </div>
  );
}
