import { useRef, useState } from "react";

const SWIPE_THRESHOLD_PX = 40;

const styles = {
  stage: {
    position: "relative",
    width: "100%",
    aspectRatio: "3 / 4",
    background: "#f0eeeb",
    overflow: "hidden",
    userSelect: "none",
    touchAction: "pan-y",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ece9e4",
    gap: "12px",
  },
  placeholderIcon: {
    width: "40px",
    height: "40px",
    opacity: 0.25,
  },
  placeholderText: {
    fontSize: "11px",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    color: "#aaa",
  },
  navBtn: (side) => ({
    position: "absolute",
    top: "50%",
    [side]: "10px",
    transform: "translateY(-50%)",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "none",
    background: "rgba(255,255,255,0.88)",
    color: "#111",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    lineHeight: 1,
    padding: 0,
  }),
  thumbRow: {
    display: "flex",
    gap: "8px",
    marginTop: "12px",
    flexWrap: "wrap",
  },
  thumbBtn: (selected) => ({
    width: "56px",
    height: "70px",
    padding: 0,
    border: selected ? "1.5px solid #1a1a1a" : "1px solid #ddd",
    background: "#fff",
    cursor: "pointer",
    overflow: "hidden",
    flexShrink: 0,
  }),
  thumbImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
};

function NoImagePlaceholder() {
  return (
    <div style={styles.placeholder}>
      <svg
        style={styles.placeholderIcon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="4" y="4" width="32" height="32" rx="1" stroke="#1a1a1a" strokeWidth="1.5" />
        <circle cx="14" cy="14" r="3" stroke="#1a1a1a" strokeWidth="1.5" />
        <path d="M4 28l9-8 6 6 5-4 12 10" stroke="#1a1a1a" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <span style={styles.placeholderText}>No Image</span>
    </div>
  );
}

/**
 * Reusable product image gallery: large active image + thumbnails +
 * prev/next arrows + basic touch swipe. Pass a new `key` from the caller
 * whenever the underlying product/color selection changes so the active
 * image resets — this component intentionally has no reset effect of its
 * own, to keep "when do we reset" a single decision made by the caller.
 */
export default function ImageGallery({ images = [], altText = "Product", style, stageStyle }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const touchStartX = useRef(null);

  const safeIndex = images.length > 0 ? Math.min(activeIndex, images.length - 1) : 0;
  const activeImage = images[safeIndex] || null;
  const hasMultiple = images.length > 1;

  function goTo(index) {
    if (images.length === 0) return;
    const next = ((index % images.length) + images.length) % images.length;
    setActiveIndex(next);
    setImgError(false);
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    goTo(deltaX < 0 ? safeIndex + 1 : safeIndex - 1);
  }

  return (
    <div style={{ width: "100%", ...style }}>
      <div
        style={{ ...styles.stage, ...stageStyle }}
        onTouchStart={hasMultiple ? handleTouchStart : undefined}
        onTouchEnd={hasMultiple ? handleTouchEnd : undefined}
      >
        {activeImage && !imgError ? (
          <img
            src={activeImage.image_url}
            alt={`${altText} — photo ${safeIndex + 1} of ${images.length}`}
            style={styles.image}
            onError={() => setImgError(true)}
          />
        ) : (
          <NoImagePlaceholder />
        )}

        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => goTo(safeIndex - 1)}
              style={styles.navBtn("left")}
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => goTo(safeIndex + 1)}
              style={styles.navBtn("right")}
            >
              ›
            </button>
          </>
        )}
      </div>

      {hasMultiple && (
        <div style={styles.thumbRow}>
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              aria-label={`View photo ${index + 1} of ${images.length}`}
              onClick={() => goTo(index)}
              style={styles.thumbBtn(index === safeIndex)}
            >
              <img src={image.image_url} alt="" style={styles.thumbImg} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
