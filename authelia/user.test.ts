// What user.ts would get wrong silently: a refused integration or a reworded answer leaving
// an empty forgejo_aud behind, the audience written under the wrong user, a second subject
// pinned for a user who has one (their integration rule then names a subject their tokens
// never carry), a user added twice, and users.yml replaced rather than rewritten, which the
// container's mount of that one file would never see.
//
// No Authelia, Forgejo or docker: `docker` is a stub on PATH that records its calls and
// answers with what the real containers print.
import { afterAll, beforeEach, expect, test } from "bun:test";
import { chmodSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const script = join(import.meta.dir, "user.ts");
const dir = mkdtempSync(join(tmpdir(), "authelia-user-"));
afterAll(() => rmSync(dir, { recursive: true }));
const users = join(dir, "users.yml");
const calls = join(dir, "calls");

mkdirSync(join(dir, "bin"));
writeFileSync(join(dir, "bin", "docker"), `#!/bin/sh
echo "docker $*" >>"$CALLS"
case "$*" in
*"crypto hash"*) cat >/dev/null; echo 'Digest: $argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA' ;;
*"identifiers export"*) printf '%s\\n' "$IDS" ;;
*create-authorized-integration*) printf '%s\\n' "$FJ_OUT"; exit "\${FJ_RC:-0}" ;;
esac
`);
chmodSync(join(dir, "bin", "docker"), 0o755);

beforeEach(() => writeFileSync(calls, ""));

/** Runs user.ts; ids and fj set what Authelia's identifiers and Forgejo's CLI answer. */
async function user(args: string[], { stdin = "", ids = "", fj = "", fjExit = 0 } = {}) {
	const proc = Bun.spawn(["bun", script, ...args], {
		stdin: new Response(stdin),
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env, PATH: `${join(dir, "bin")}:${process.env.PATH}`, CALLS: calls,
			USERS_FILE: users, COMPOSE_FILE: join(import.meta.dir, "compose.yml"), FORGEJO_MCP_HOST: "mcp.example",
			IDS: ids, FJ_OUT: fj, FJ_RC: String(fjExit),
		},
	});
	const code = await proc.exited;
	return { code, out: `${await new Response(proc.stdout).text()}${await new Response(proc.stderr).text()}` };
}

const parsed = () => (Bun.YAML.parse(readFileSync(users, "utf8")) as { users: Record<string, { password: string; extra: { forgejo_aud: string } }> }).users;
const idsFor = (name: string, id: string) =>
	`identifiers:\n    - service: openid\n      sector_id: ""\n      username: ${name}\n      identifier: ${id}\n`;
const created = JSON.stringify({ message: "Authorized integration was successfully created.", name: "forgejo-mcp", audience: "u:7:1111", claim_rules: [] }, null, 2);

test("login adds a user with a hash and an empty forgejo_aud", async () => {
	expect((await user(["login", "alice", "a@example.org"], { stdin: "pw\n" })).code).toBe(0);
	await user(["login", "bob", "b@example.org"], { stdin: "pw\n" });
	expect(parsed().alice.password).toStartWith("$argon2id$");
	expect(parsed().alice.extra.forgejo_aud).toBe("");
	expect(readFileSync(calls, "utf8")).toContain("docker run --rm -i ghcr.io/authelia/authelia:");
});

test("login leaves a user who is already there alone", async () => {
	const before = readFileSync(users, "utf8");
	expect((await user(["login", "alice", "a@example.org"], { stdin: "other\n" })).out).toContain("alice is in");
	expect(readFileSync(users, "utf8")).toBe(before);
});

test("login refuses an empty password", async () =>
	expect((await user(["login", "carol", "c@example.org"], { stdin: "\n" })).code).not.toBe(0));

test("integration writes the audience under that user only, in place", async () => {
	linkSync(users, join(dir, "mounted.yml")); // what the container sees: the same inode
	const r = await user(["integration", "bob"], { ids: idsFor("bob", "2222"), fj: created });
	expect(r.code).toBe(0);
	expect(parsed().bob.extra.forgejo_aud).toBe("u:7:1111");
	expect(parsed().alice.extra.forgejo_aud).toBe("");
	expect(readFileSync(join(dir, "mounted.yml"), "utf8")).toContain("u:7:1111");
});

test("integration ties the rule to the subject already pinned, and pins no second one", async () => {
	await user(["integration", "alice"], { ids: idsFor("alice", "3333"), fj: created });
	const log = readFileSync(calls, "utf8");
	expect(log).toContain("--claim-eq sub=3333");
	expect(log).not.toContain("identifiers add");
});

test("integration fails when Forgejo refuses it, and writes nothing", async () => {
	await user(["login", "dave", "d@example.org"], { stdin: "pw\n" });
	const r = await user(["integration", "dave"], { ids: idsFor("dave", "4444"), fj: "Command error: invalid issuer", fjExit: 1 });
	expect(r.code).not.toBe(0);
	expect(parsed().dave.extra.forgejo_aud).toBe("");
});

test("integration fails when the answer has no audience", async () =>
	expect((await user(["integration", "dave"], { ids: idsFor("dave", "4444"), fj: '{ "audience_v2": "x" }' })).code).not.toBe(0));
