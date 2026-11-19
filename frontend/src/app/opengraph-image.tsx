import { ImageResponse } from "next/og";

/**
 * Social share image (Phase 10), generated at build time: the
 * LinkLens wordmark, promise line, and the three verdict chips on
 * the app's deep-navy background. Plain shapes/text only — the image
 * renderer has no icon fonts.
 */
export const alt = "LinkLens — check a link before you click";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px",
          backgroundColor: "#ffffff",
          color: "#171717",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 42,
              border: "5px solid #171717",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: "#171717",
                display: "flex",
              }}
            />
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -1 }}>
            <div style={{ display: "flex" }}>Link</div>
            <div style={{ display: "flex" }}>Lens</div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
          }}
        >
          Is this link safe to click?
        </div>
        <div style={{ display: "flex", marginTop: 18, fontSize: 28, color: "#5c5c5c" }}>
          Machine-learning phishing detection with explainable verdicts.
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 44 }}>
          {[
            { label: "SAFE", color: "#1c7c43" },
            { label: "SUSPICIOUS", color: "#9a6a00" },
            { label: "PHISHING", color: "#c62f3b" },
          ].map((chip) => (
            <div
              key={chip.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: `2px solid ${chip.color}`,
                color: chip.color,
                borderRadius: 999,
                padding: "10px 22px",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  backgroundColor: chip.color,
                }}
              />
              <div style={{ display: "flex" }}>{chip.label}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
