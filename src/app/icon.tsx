import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #16232b 0%, #0d6d7a 50%, #d96f2b 100%)",
          color: "#fff9f0",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.08em",
        }}
      >
        MT
      </div>
    ),
    size,
  );
}
