import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = Math.min(512, Math.max(16, Number(searchParams.get("size") ?? "192")));
  const radius = Math.round(size * 0.22);
  const fontSize = Math.round(size * 0.5);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: "#17352e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize,
            fontWeight: 700,
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          K
        </span>
      </div>
    ),
    { width: size, height: size },
  );
}
