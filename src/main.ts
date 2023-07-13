import {
  Status
} from "$http";
import {
  APIInteraction
} from "discord_api_types";
import {
  Event,
  Manifest
} from "./types.ts";

import manifest from "./manifest.ts";
import nacl from "https://esm.sh/tweetnacl@1.0.3";

const server = Deno.listen({ port: 80 });

for await (const conn of server) {
  serveHttp(conn, manifest);
}

async function serveHttp(conn: Deno.Conn, manifest: Manifest): Promise<void> {
  const httpConn = Deno.serveHttp(conn);

  for await (const requestEvent of httpConn) {
    const body = await requestEvent.request.text();
    const timestamp = await requestEvent.request.headers.get("X-Signature-Timestamp")!;
    const signature = await requestEvent.request.headers.get("X-Signature-Ed25519")!;
    const publicKey = Deno.env.get("DISCORD_PUBLIC_KEY")!;

    const valid = nacl.sign.detached.verify(
      new TextEncoder().encode(timestamp + body),
      hexEncode(signature),
      hexEncode(publicKey)
    );

    if (!valid) {
      requestEvent.respondWith(
        new Response("Invalid Request.", { status: Status.Unauthorized })
      )
    } else {
      const interaction = JSON.parse(body) as APIInteraction;
      const event: Event = manifest.events.find(ctx => ctx.type == interaction.type)!;
      if (event) await event.execute({ requestEvent, interaction });
    }
  }
}

function hexEncode(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/.{1,2}/g)!.map(ctx => parseInt(ctx, 16))
  )
}
