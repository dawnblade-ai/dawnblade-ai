// SKETCH ONLY — never run, never built, not loaded by the page or by any test, no secrets.
// It shows where `handle` (server/referee.js) plugs in. EVERY Supabase API detail below is
// UNVERIFIED: supabase.com is unreachable from the build sandbox. Check each against the live docs.
import referee from "./referee.js";                      // CommonJS; Deno reads it with CJS detection

// `deal(spec)`: load data/pool.js once per instance (it is 1.4 MB), build the card maps, then
// engine/build + judge.newMatch exactly as test/helpers/isolate.js's TABLE_OBJECT does.
declare const deal: (spec: unknown) => { state: unknown; catalog: unknown };

Deno.serve(async (req: Request) => {
  const request = await req.json();            // UNVERIFIED: authenticate the caller's JWT here if the project wants accounts
  const deps = {
    store: {
      // UNVERIFIED: a service-role-only Postgres table  tables(id text pk, version int, row jsonb)
      async get(id: string) { /* select version, row from tables where id = $1  ->  {version, row} | null */ },
      async put(id: string, row: unknown, expected: number) {
        /* expected = 0: insert, conflict -> {ok:false}.  else: update tables set row = $2, version = version + 1
           where id = $1 and version = $3 returning version  (no row -> {ok:false}) */
      },
    },
    async broadcast(topic: string, payload: unknown) {
      // UNVERIFIED: Realtime Broadcast over REST, a PRIVATE channel per seat ("table:<id>:seat0|1"),
      // with an RLS rule so only that seat's holder may subscribe. Payload size limits unchecked.
      /* POST `${SUPABASE_URL}/realtime/v1/api/broadcast` { messages: [{ topic, event: "frame", payload, private: true }] } */
    },
    deal, build: "<APP_VER/DATA_VER string>", now: () => Date.now(),   // rand omitted: the hub falls back to crypto
  };
  return Response.json(await referee.handle(request, deps));
});
