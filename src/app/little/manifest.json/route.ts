import manifest from "../../../../little/manifest.json";

export function GET() {
  return Response.json(manifest, { headers: { "Access-Control-Allow-Origin": "*" } });
}
