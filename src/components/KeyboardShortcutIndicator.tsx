import React, { useState, useEffect, useRef } from "react";
import { CornerDownLeft, Wind } from "lucide-react";

interface KeyboardShortcutIndicatorProps {
  hasSelection: boolean;
  selectedPreview?: string;
  onFeed?: () => void;
  swallowedCount?: number;
  onSneeze?: () => void;
}

/**
 * Floating Keyboard Shortcut Indicator.
 * Unobtrusive glassmorphic pill that:
 * 1. Shows ⌘C / Ctrl+C to copy selection to notch when text is highlighted.
 * 2. Teaches ⌘V / Ctrl+V to sneeze words back immediately after a swallow!
 */
export const KeyboardShortcutIndicator: React.FC<KeyboardShortcutIndicatorProps> = ({
  hasSelection,
  selectedPreview = "",
  onFeed,
  swallowedCount = 0,
  onSneeze,
}) => {
  // ── Teach Command + V / Ctrl + V after a swallow ──
  const [showSneezeHUD, setShowSneezeHUD] = useState(false);
  const prevCountRef = useRef(swallowedCount);
  const sneezeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (swallowedCount > prevCountRef.current) {
      // Snippet was just swallowed! Teach ⌘V for 6 seconds
      setShowSneezeHUD(true);
      if (sneezeTimerRef.current) clearTimeout(sneezeTimerRef.current);
      sneezeTimerRef.current = setTimeout(() => {
        setShowSneezeHUD(false);
      }, 6000);
    } else if (swallowedCount === 0) {
      setShowSneezeHUD(false);
      if (sneezeTimerRef.current) clearTimeout(sneezeTimerRef.current);
    }
    prevCountRef.current = swallowedCount;

    return () => {
      if (sneezeTimerRef.current) clearTimeout(sneezeTimerRef.current);
    };
  }, [swallowedCount]);

  const isVisible = hasSelection || (showSneezeHUD && swallowedCount > 0);

  return (
    <aside
      className={`floating-shortcut-hud ${isVisible ? "visible" : "hidden-hud"}`}
      aria-live="polite"
      aria-label="Keyboard shortcut hint"
    >
      <div className="shortcut-hud-pill">
        {hasSelection ? (
          /* ── 1. Text Selected: Teach Command + C / Ctrl + C Copy to Notch ── */
          <>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <kbd className="hud-keycap">Command + C</kbd>
                <span className="hud-key-divider">/</span>
                <kbd className="hud-keycap">Ctrl + C</kbd>
              </div>

              <div className="hud-feed-label">
                <span>
                  Copy{" "}
                  {selectedPreview ? (
                    <span className="hud-preview-text">
                      “{selectedPreview.trim().replace(/^[“"']+|[”"']+$/g, "").slice(0, 20)}
                      {selectedPreview.trim().length > 20 ? "…" : ""}”
                    </span>
                  ) : (
                    "selection"
                  )}{" "}
                  to notch
                </span>
              </div>
            </div>

            {/* Instant Click Action Button */}
            {onFeed && (
              <button
                type="button"
                className="hud-action-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onFeed}
                title="Click or press Command + C / Ctrl + C to copy to notch"
              >
                <CornerDownLeft className="w-3 h-3" />
                <span>Copy</span>
              </button>
            )}

            {/* Stash & Sneeze Reminder if Items are Held */}
            {swallowedCount > 0 && (
              <div className="hud-sneeze-pill">
                <div className="flex items-center gap-0.5">
                  <kbd className="hud-keycap-sm">Command + V</kbd>
                  <span className="hud-key-divider-sm">/</span>
                  <kbd className="hud-keycap-sm">Ctrl + V</kbd>
                </div>
                {onSneeze ? (
                  <button
                    type="button"
                    className="hover:text-emerald-200 transition-colors flex items-center gap-1 underline decoration-emerald-500/40 text-emerald-300"
                    onClick={onSneeze}
                    title="Click or press Command + V / Ctrl + V to return stored text"
                  >
                    <Wind className="w-3 h-3" />
                    <span>sneeze ({swallowedCount})</span>
                  </button>
                ) : (
                  <span>sneeze ({swallowedCount})</span>
                )}
              </div>
            )}
          </>
        ) : (
          /* ── 2. After Swallow: Teach Command + V / Ctrl + V Sneeze Back ── */
          <>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <kbd className="hud-keycap-emerald">Command + V</kbd>
                <span className="hud-key-divider-emerald">/</span>
                <kbd className="hud-keycap-emerald">Ctrl + V</kbd>
              </div>

              <div className="hud-feed-label">
                <span>Press to sneeze words back</span>
              </div>
            </div>

            {onSneeze && (
              <button
                type="button"
                className="hud-action-btn hud-action-btn-sneeze"
                onClick={() => {
                  setShowSneezeHUD(false);
                  onSneeze();
                }}
                title="Click or press Command + V / Ctrl + V to sneeze text back"
              >
                <Wind className="w-3 h-3 text-emerald-100" />
                <span>Sneeze ({swallowedCount})</span>
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
