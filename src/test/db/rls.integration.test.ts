/**
 * Supabase RLS integration tests.
 *
 * Skips unless RUN_DB_INTEGRATION=1 and connection env is present.
 * Migrations are applied externally (e.g. `supabase db reset` in CI).
 *
 * Env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 * - DATABASE_URL (postgres connection for JWT claim / role simulation)
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const databaseUrl = process.env.DATABASE_URL ?? "";

const envReady =
  Boolean(supabaseUrl) &&
  Boolean(anonKey) &&
  Boolean(serviceRoleKey) &&
  Boolean(databaseUrl);

const describeDb = runIntegration && envReady ? describe : describe.skip;

describeDb("Phase 1 RLS integration", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  const adminAuthId = randomUUID();
  const readOnlyAuthId = randomUUID();
  const inactiveAuthId = randomUUID();

  let adminUserId = "";
  let readOnlyUserId = "";
  let inactiveUserId = "";
  let adminRoleId = "";
  let readOnlyRoleId = "";

  beforeAll(async () => {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: roles, error: rolesError } = await admin
      .from("roles")
      .select("id, key")
      .in("key", ["administrator", "read_only"]);

    if (rolesError || !roles?.length) {
      throw new Error(`Failed to load roles: ${rolesError?.message}`);
    }

    adminRoleId = roles.find((r) => r.key === "administrator")?.id ?? "";
    readOnlyRoleId = roles.find((r) => r.key === "read_only")?.id ?? "";
    if (!adminRoleId || !readOnlyRoleId) {
      throw new Error("Seed roles administrator/read_only missing");
    }

    const seedUsers = [
      {
        auth_user_id: adminAuthId,
        email: `admin-${adminAuthId.slice(0, 8)}@example.test`,
        display_name: "Fabricated Admin",
        status: "active",
      },
      {
        auth_user_id: readOnlyAuthId,
        email: `readonly-${readOnlyAuthId.slice(0, 8)}@example.test`,
        display_name: "Fabricated Read Only",
        status: "active",
      },
      {
        auth_user_id: inactiveAuthId,
        email: `inactive-${inactiveAuthId.slice(0, 8)}@example.test`,
        display_name: "Fabricated Inactive",
        status: "inactive",
      },
    ];

    for (const row of seedUsers) {
      const { data, error } = await admin
        .from("users")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        throw new Error(`Seed user failed: ${error?.message}`);
      }
      if (row.auth_user_id === adminAuthId) adminUserId = data.id;
      if (row.auth_user_id === readOnlyAuthId) readOnlyUserId = data.id;
      if (row.auth_user_id === inactiveAuthId) inactiveUserId = data.id;
    }

    const { error: roleAssignError } = await admin.from("user_roles").insert([
      { user_id: adminUserId, role_id: adminRoleId },
      { user_id: readOnlyUserId, role_id: readOnlyRoleId },
    ]);
    if (roleAssignError) {
      throw new Error(`Seed user_roles failed: ${roleAssignError.message}`);
    }

    const { error: auditError } = await admin.from("audit_events").insert({
      actor_user_id: adminUserId,
      actor_type: "user",
      action_type: "login",
      entity_type: "user",
      entity_id: adminUserId,
      after_summary: "Fabricated seed login audit",
      source: "test",
    });
    if (auditError) {
      throw new Error(`Seed audit_events failed: ${auditError.message}`);
    }

    const { error: jobError } = await admin.from("job_runs").insert({
      job_key: "fabricated.seed",
      idempotency_key: `seed-${randomUUID()}`,
      state: "succeeded",
    });
    if (jobError) {
      throw new Error(`Seed job_runs failed: ${jobError.message}`);
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  it("anon cannot read operational tables (empty under RLS) and cannot insert", async () => {
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const users = await anon.from("users").select("id");
    expect(users.error).toBeNull();
    expect(users.data ?? []).toHaveLength(0);

    const audit = await anon.from("audit_events").select("id");
    expect(audit.error).toBeNull();
    expect(audit.data ?? []).toHaveLength(0);

    const jobs = await anon.from("job_runs").select("id");
    expect(jobs.error).toBeNull();
    expect(jobs.data ?? []).toHaveLength(0);

    const insert = await anon.from("users").insert({
      email: `anon-insert-${randomUUID()}@example.test`,
      status: "active",
    });
    expect(insert.error).not.toBeNull();
  });

  it("service role can read seeded users", async () => {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await admin
      .from("users")
      .select("id, status")
      .in("id", [adminUserId, readOnlyUserId, inactiveUserId]);

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
  });

  it("authenticated admin can select audit_events; inactive auth.uid resolves to no app user", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        adminAuthId,
      ]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await client.query("SET LOCAL ROLE authenticated");

      const audit = await client.query(`SELECT count(*)::int AS n FROM public.audit_events`);
      expect(audit.rows[0].n).toBeGreaterThan(0);

      const jobs = await client.query(`SELECT count(*)::int AS n FROM public.job_runs`);
      expect(jobs.rows[0].n).toBeGreaterThan(0);

      const self = await client.query(
        `SELECT id FROM public.users WHERE id = $1`,
        [adminUserId],
      );
      expect(self.rowCount).toBe(1);

      await client.query("ROLLBACK");

      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        inactiveAuthId,
      ]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await client.query("SET LOCAL ROLE authenticated");

      const appUser = await client.query(`SELECT public.current_app_user_id() AS id`);
      expect(appUser.rows[0].id).toBeNull();

      const auditAsInactive = await client.query(
        `SELECT count(*)::int AS n FROM public.audit_events`,
      );
      expect(auditAsInactive.rows[0].n).toBe(0);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("authenticated read_only can read audit but not other users via settings.write path", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        readOnlyAuthId,
      ]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await client.query("SET LOCAL ROLE authenticated");

      const audit = await client.query(`SELECT count(*)::int AS n FROM public.audit_events`);
      expect(audit.rows[0].n).toBeGreaterThan(0);

      const own = await client.query(`SELECT id FROM public.users WHERE id = $1`, [
        readOnlyUserId,
      ]);
      expect(own.rowCount).toBe(1);

      const other = await client.query(`SELECT id FROM public.users WHERE id = $1`, [
        adminUserId,
      ]);
      expect(other.rowCount).toBe(0);

      const hasSettingsWrite = await client.query(
        `SELECT public.has_permission('settings.write') AS allowed`,
      );
      expect(hasSettingsWrite.rows[0].allowed).toBe(false);

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("bootstrap_oauth_user is callable as service_role and assigns mutually exclusive roles", async () => {
    const newAuthId = randomUUID();
    const email = `bootstrap-${newAuthId.slice(0, 8)}@example.test`;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: firstId, error: firstError } = await admin.rpc(
      "bootstrap_oauth_user",
      {
        p_auth_user_id: newAuthId,
        p_email: email,
        p_display_name: "Bootstrap User",
        p_role_key: "read_only",
      },
    );
    expect(firstError).toBeNull();
    expect(firstId).toBeTruthy();

    const { data: secondId, error: secondError } = await admin.rpc(
      "bootstrap_oauth_user",
      {
        p_auth_user_id: newAuthId,
        p_email: email,
        p_display_name: "Bootstrap User",
        p_role_key: "administrator",
      },
    );
    expect(secondError).toBeNull();
    expect(secondId).toBe(firstId);

    const { data: roleRows, error: roleError } = await admin
      .from("user_roles")
      .select("roles(key)")
      .eq("user_id", firstId);

    expect(roleError).toBeNull();
    const keys = (roleRows ?? []).flatMap((row) => {
      const nested = row.roles as { key: string } | { key: string }[] | null;
      if (!nested) return [];
      return Array.isArray(nested) ? nested.map((r) => r.key) : [nested.key];
    });
    expect(keys).toEqual(["administrator"]);
  });

  it("authenticated and anon cannot execute bootstrap_oauth_user", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        adminAuthId,
      ]);
      await client.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', true)`);
      await client.query("SET LOCAL ROLE authenticated");

      await expect(
        client.query(
          `SELECT public.bootstrap_oauth_user($1::uuid, $2, $3, $4)`,
          [randomUUID(), "x@example.test", "X", "read_only"],
        ),
      ).rejects.toThrow(/permission denied|must be owner/i);

      await client.query("ROLLBACK");

      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE anon");
      await expect(
        client.query(
          `SELECT public.bootstrap_oauth_user($1::uuid, $2, $3, $4)`,
          [randomUUID(), "y@example.test", "Y", "read_only"],
        ),
      ).rejects.toThrow(/permission denied|must be owner/i);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    // PostgREST surface: anon JWT must not invoke the RPC successfully.
    const anon = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.rpc("bootstrap_oauth_user", {
      p_auth_user_id: randomUUID(),
      p_email: "z@example.test",
      p_display_name: "Z",
      p_role_key: "read_only",
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("unknown authenticated identity receives no operational data", async () => {
    const unknownAuthId = randomUUID();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        unknownAuthId,
      ]);
      await client.query(
        `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`,
      );
      await client.query("SET LOCAL ROLE authenticated");

      const appUser = await client.query(
        `SELECT public.current_app_user_id() AS id`,
      );
      expect(appUser.rows[0].id).toBeNull();

      const hasAccess = await client.query(
        `SELECT public.has_permission('app.access') AS allowed`,
      );
      expect(hasAccess.rows[0].allowed).toBe(false);

      for (const table of [
        "users",
        "audit_events",
        "job_runs",
        "app_settings",
        "integration_connections",
      ] as const) {
        const result = await client.query(
          `SELECT count(*)::int AS n FROM public.${table}`,
        );
        expect(result.rows[0].n).toBe(0);
      }

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  async function asAuthenticated(
    authId: string,
    run: (client: pg.PoolClient) => Promise<void>,
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        authId,
      ]);
      await client.query(
        `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`,
      );
      await client.query("SET LOCAL ROLE authenticated");
      await run(client);
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  }

  async function expectMutationDenied(
    client: pg.PoolClient,
    sql: string,
    params: unknown[] = [],
  ) {
    // Use a savepoint so one denied statement does not abort the outer txn (25P02).
    await client.query("SAVEPOINT mut_attempt");
    try {
      await client.query(sql, params);
      await client.query("ROLLBACK TO SAVEPOINT mut_attempt");
      throw new Error(`expected mutation to be denied: ${sql}`);
    } catch (error) {
      await client.query("ROLLBACK TO SAVEPOINT mut_attempt");
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith("expected mutation to be denied:")) {
        throw error;
      }
      expect(message).toMatch(
        /permission denied|policy|row-level security|violates row-level security/i,
      );
    }
  }

  it("read_only cannot INSERT, UPDATE, or DELETE protected tables", async () => {
    await asAuthenticated(readOnlyAuthId, async (client) => {
      await expectMutationDenied(
        client,
        `INSERT INTO public.users (email, status) VALUES ($1, 'active')`,
        [`ro-insert-${randomUUID()}@example.test`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.users SET display_name = 'hacked' WHERE id = $1`,
        [readOnlyUserId],
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.users WHERE id = $1`,
        [readOnlyUserId],
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.audit_events (action_type, entity_type, source)
         VALUES ('test', 'user', 'test')`,
      );

      await expectMutationDenied(
        client,
        `UPDATE public.audit_events SET after_summary = 'x' WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.audit_events WHERE true`,
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.job_runs (job_key, idempotency_key, state)
         VALUES ('x', $1, 'pending')`,
        [`ro-${randomUUID()}`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.job_runs SET state = 'failed' WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.job_runs WHERE true`,
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.app_settings (key, value) VALUES ($1, '{}'::jsonb)`,
        [`ro-setting-${randomUUID()}`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.app_settings SET value = '{"x":1}'::jsonb WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.app_settings WHERE true`,
      );
    });
  });

  it("administrator browser client cannot directly mutate protected tables", async () => {
    // Even administrators must use privileged server paths for writes;
    // RLS provides no INSERT/UPDATE/DELETE policies for authenticated.
    await asAuthenticated(adminAuthId, async (client) => {
      await expectMutationDenied(
        client,
        `INSERT INTO public.users (email, status) VALUES ($1, 'active')`,
        [`admin-insert-${randomUUID()}@example.test`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.users SET display_name = 'browser-write' WHERE id = $1`,
        [adminUserId],
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.users WHERE id = $1`,
        [readOnlyUserId],
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.audit_events (action_type, entity_type, source)
         VALUES ('browser', 'user', 'test')`,
      );

      await expectMutationDenied(
        client,
        `UPDATE public.audit_events SET after_summary = 'browser' WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.audit_events WHERE true`,
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.job_runs (job_key, idempotency_key, state)
         VALUES ('browser', $1, 'pending')`,
        [`admin-${randomUUID()}`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.job_runs SET state = 'cancelled' WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.job_runs WHERE true`,
      );

      await expectMutationDenied(
        client,
        `INSERT INTO public.app_settings (key, value) VALUES ($1, '{}'::jsonb)`,
        [`admin-setting-${randomUUID()}`],
      );

      await expectMutationDenied(
        client,
        `UPDATE public.app_settings SET value = '{"browser":true}'::jsonb WHERE true`,
      );

      await expectMutationDenied(
        client,
        `DELETE FROM public.app_settings WHERE true`,
      );
    });
  });
});

describe("Phase 1 RLS integration gate", () => {
  it("documents required env when skipped", () => {
    if (!runIntegration || !envReady) {
      expect(runIntegration && envReady).toBe(false);
    } else {
      expect(envReady).toBe(true);
    }
  });
});
