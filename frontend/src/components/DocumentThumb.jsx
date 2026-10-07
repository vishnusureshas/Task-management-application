import { imageUrl } from '../api/client.js';

const SIZES = {
  sm: 'h-14 w-14',
  md: 'h-40 w-full',
};

// Plan §9.2 / §6 rule 4: spinner while PENDING/PROCESSING, thumbnail on
// document:completed (merged live), original on click, FAILED badge.
export default function DocumentThumb({ document, size = 'md' }) {
  const box = `flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 ${SIZES[size] ?? SIZES.md}`;

  if (document.status === 'FAILED') {
    return (
      <span className={`${box} bg-red-100 text-xs font-bold text-red-800`} title={document.originalFilename}>
        Failed
      </span>
    );
  }

  const src = imageUrl(document.thumbnailUrl);
  if (!src) {
    return (
      <span className={box} title="Processing image…">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </span>
    );
  }

  return (
    <a
      className={box}
      href={imageUrl(document.originalUrl) ?? src}
      target="_blank"
      rel="noreferrer"
      title={document.originalFilename}
    >
      <img
        src={src}
        alt={document.originalFilename ?? 'task image'}
        loading="lazy"
        className={size === 'sm' ? 'h-full w-full object-cover' : 'h-full w-full object-cover'}
      />
    </a>
  );
}
