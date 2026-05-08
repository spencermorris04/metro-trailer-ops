import { getOrbcommAccessToken } from "./orbcomm-client";

async function main() {
  const token = await getOrbcommAccessToken();
  console.log(JSON.stringify({ ok: true, tokenPreview: `${token.slice(0, 12)}...`, tokenLength: token.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});

