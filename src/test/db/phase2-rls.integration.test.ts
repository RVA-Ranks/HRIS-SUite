/**
 * Phase 2 Slice A — RLS / scope integration tests (fabricated data only).
 *
 * Requires RUN_DB_INTEGRATION=1 and the same env as Phase 1 RLS tests.
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

describeDb("Phase 2 Slice A RLS integration", () => {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminAuthId = randomUUID();
  const submitterAAuthId = randomUUID();
  const submitterBAuthId = randomUUID();
  const reviewerAuthId = randomUUID();
  const readOnlyAuthId = randomUUID();
  const unrelatedAuthId = randomUUID();
  const inactiveAuthId = randomUUID();

  let orgAId = "";
  let orgBId = "";
  let adminUserId = "";
  let submitterAId = "";
  let submitterBId = "";
  let reviewerUserId = "";
  let readOnlyUserId = "";
  let unrelatedUserId = "";
  let inactiveUserId = "";
  let taskAId = "";
  let taskBId = "";
  let positionAId = "";
  let roleIds: Record<string, string> = {};

  async function asUser<T>(
    authUserId: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [
        authUserId,
      ]);
      await client.query(
        `SELECT set_config('request.jwt.claim.role', 'authenticated', true)`,
      );
      await client.query("SET LOCAL ROLE authenticated");
      const result = await fn(client);
      await client.query("ROLLBACK");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  beforeAll(async () => {
    const { data: roles, error: rolesError } = await admin
      .from("roles")
      .select("id, key")
      .in("key", [
        "administrator",
        "read_only",
        "staff_submitter",
        "hr_reviewer",
      ]);
    if (rolesError || !roles?.length) {
      throw new Error(`Failed to load roles: ${rolesError?.message}`);
    }
    roleIds = Object.fromEntries(roles.map((r) => [r.key, r.id]));

    const { data: orgA, error: orgAError } = await admin
      .from("organizations")
      .insert({ name: "Fabricated Org A" })
      .select("id")
      .single();
    if (orgAError || !orgA) throw new Error(orgAError?.message);
    orgAId = orgA.id;

    const { data: orgB, error: orgBError } = await admin
      .from("organizations")
      .insert({ name: "Fabricated Org B" })
      .select("id")
      .single();
    if (orgBError || !orgB) throw new Error(orgBError?.message);
    orgBId = orgB.id;

    const users = [
      {
        auth: adminAuthId,
        email: `p2-admin-${adminAuthId.slice(0, 8)}@example.test`,
        role: "administrator",
        set: (id: string) => {
          adminUserId = id;
        },
      },
      {
        auth: submitterAAuthId,
        email: `p2-sub-a-${submitterAAuthId.slice(0, 8)}@example.test`,
        role: "staff_submitter",
        set: (id: string) => {
          submitterAId = id;
        },
      },
      {
        auth: submitterBAuthId,
        email: `p2-sub-b-${submitterBAuthId.slice(0, 8)}@example.test`,
        role: "staff_submitter",
        set: (id: string) => {
          submitterBId = id;
        },
      },
      {
        auth: reviewerAuthId,
        email: `p2-rev-${reviewerAuthId.slice(0, 8)}@example.test`,
        role: "hr_reviewer",
        set: (id: string) => {
          reviewerUserId = id;
        },
      },
      {
        auth: readOnlyAuthId,
        email: `p2-ro-${readOnlyAuthId.slice(0, 8)}@example.test`,
        role: "read_only",
        set: (id: string) => {
          readOnlyUserId = id;
        },
      },
      {
        auth: unrelatedAuthId,
        email: `p2-unrel-${unrelatedAuthId.slice(0, 8)}@example.test`,
        role: "staff_submitter",
        set: (id: string) => {
          unrelatedUserId = id;
        },
      },
      {
        auth: inactiveAuthId,
        email: `p2-inact-${inactiveAuthId.slice(0, 8)}@example.test`,
        role: "staff_submitter",
        status: "inactive",
        set: (id: string) => {
          inactiveUserId = id;
        },
      },
    ] as const;

    for (const u of users) {
      const { data, error } = await admin
        .from("users")
        .insert({
          auth_user_id: u.auth,
          email: u.email,
          display_name: u.email,
          status: "status" in u && u.status ? u.status : "active",
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message);
      u.set(data.id);
      const { error: roleError } = await admin.from("user_roles").insert({
        user_id: data.id,
        role_id: roleIds[u.role],
      });
      if (roleError) throw new Error(roleError.message);
    }

    // Memberships: admin+submitters+reviewer in Org A; submitter B also in Org A;
    // unrelated has no membership. Reviewer gets queue triage on Org A only.
    const memberships = [
      { organization_id: orgAId, user_id: adminUserId, can_queue_triage: true },
      { organization_id: orgAId, user_id: submitterAId, can_queue_triage: false },
      { organization_id: orgAId, user_id: submitterBId, can_queue_triage: false },
      { organization_id: orgAId, user_id: reviewerUserId, can_queue_triage: true },
      { organization_id: orgBId, user_id: adminUserId, can_queue_triage: false },
    ];
    for (const m of memberships) {
      const { error } = await admin.from("organization_memberships").insert({
        ...m,
        status: "active",
      });
      if (error) throw new Error(error.message);
    }

    const { data: position, error: positionError } = await admin
      .from("positions")
      .insert({
        organization_id: orgAId,
        title: "Fabricated Position",
        owner_user_id: adminUserId,
        classification: "internal",
      })
      .select("id")
      .single();
    if (positionError || !position) throw new Error(positionError?.message);
    positionAId = position.id;

    const { error: compError } = await admin.from("position_compensation").insert({
      position_id: positionAId,
      organization_id: orgAId,
      min_amount: 100000,
      max_amount: 120000,
      pay_type: "salary",
      classification: "restricted",
    });
    if (compError) throw new Error(compError.message);

    const { data: taskA, error: taskAError } = await admin
      .from("tasks")
      .insert({
        organization_id: orgAId,
        title: "Submitter A open item",
        source_type: "staff_submission",
        task_type: "open_item",
        status: "new",
        submitted_by_user_id: submitterAId,
        created_by_user_id: submitterAId,
        classification: "internal",
        due_date: "2026-11-18",
      })
      .select("id")
      .single();
    if (taskAError || !taskA) throw new Error(taskAError?.message);
    taskAId = taskA.id;

    const { data: taskB, error: taskBError } = await admin
      .from("tasks")
      .insert({
        organization_id: orgAId,
        title: "Submitter B open item",
        source_type: "staff_submission",
        task_type: "open_item",
        status: "new",
        submitted_by_user_id: submitterBId,
        created_by_user_id: submitterBId,
        classification: "internal",
      })
      .select("id")
      .single();
    if (taskBError || !taskB) throw new Error(taskBError?.message);
    taskBId = taskB.id;

    const { error: commentError } = await admin.from("task_comments").insert([
      {
        organization_id: orgAId,
        task_id: taskAId,
        author_user_id: submitterAId,
        body: "Participant note from A",
        visibility: "participants",
      },
      {
        organization_id: orgAId,
        task_id: taskAId,
        author_user_id: reviewerUserId,
        body: "Reviewer-only note",
        visibility: "reviewers_only",
      },
    ]);
    if (commentError) throw new Error(commentError.message);

    const { data: doc, error: docError } = await admin
      .from("documents")
      .insert({
        organization_id: orgAId,
        task_id: taskAId,
        uploaded_by_user_id: submitterAId,
        storage_provider: "supabase_storage",
        object_key: "fabricated/a.pdf",
        original_filename: "a.pdf",
        verified_mime: "application/pdf",
        byte_size: 1024,
        disposition: "linked",
        classification: "internal",
      })
      .select("id")
      .single();
    if (docError || !doc) throw new Error(docError?.message);

    const { error: attachError } = await admin.from("task_attachments").insert({
      organization_id: orgAId,
      task_id: taskAId,
      document_id: doc.id,
    });
    if (attachError) throw new Error(attachError.message);

    const { error: activityError } = await admin.from("activity_events").insert({
      organization_id: orgAId,
      actor_user_id: submitterAId,
      entity_type: "task",
      entity_id: taskAId,
      action: "created",
      after_summary: "Fabricated create",
    });
    if (activityError) throw new Error(activityError.message);
  }, 120_000);

  afterAll(async () => {
    await pool.end();
  });

  it("Phase 2 tables have RLS enabled", async () => {
    const result = await pool.query(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])
         AND c.relrowsecurity = true
       ORDER BY 1`,
      [
        [
          "organizations",
          "organization_memberships",
          "tasks",
          "position_compensation",
          "task_comments",
          "documents",
          "idempotency_keys",
        ],
      ],
    );
    expect(result.rows).toHaveLength(7);
  });

  it("anonymous cannot read Phase 2 operational tables", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL ROLE anon");

      await client.query("SAVEPOINT anon_tasks");
      await expect(client.query(`SELECT * FROM public.tasks`)).rejects.toThrow(
        /permission denied/i,
      );
      await client.query("ROLLBACK TO SAVEPOINT anon_tasks");

      await client.query("SAVEPOINT anon_orgs");
      await expect(
        client.query(`SELECT * FROM public.organizations`),
      ).rejects.toThrow(/permission denied/i);
      await client.query("ROLLBACK TO SAVEPOINT anon_orgs");

      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
  });

  it("submitter A sees own task but not submitter B task", async () => {
    await asUser(submitterAAuthId, async (client) => {
      const own = await client.query(
        `SELECT id FROM public.tasks WHERE id = $1`,
        [taskAId],
      );
      expect(own.rowCount).toBe(1);
      const other = await client.query(
        `SELECT id FROM public.tasks WHERE id = $1`,
        [taskBId],
      );
      expect(other.rowCount).toBe(0);
      const listed = await client.query(`SELECT id FROM public.tasks`);
      const ids = listed.rows.map((r) => r.id);
      expect(ids).toContain(taskAId);
      expect(ids).not.toContain(taskBId);
    });
  });

  it("submitter cannot read reviewers_only comments or other docs", async () => {
    await asUser(submitterAAuthId, async (client) => {
      const comments = await client.query(
        `SELECT visibility FROM public.task_comments WHERE task_id = $1`,
        [taskAId],
      );
      expect(comments.rows.every((r) => r.visibility === "participants")).toBe(
        true,
      );
      expect(
        comments.rows.some((r) => r.visibility === "reviewers_only"),
      ).toBe(false);
    });

    await asUser(submitterBAuthId, async (client) => {
      const docs = await client.query(
        `SELECT id FROM public.documents WHERE task_id = $1`,
        [taskAId],
      );
      expect(docs.rowCount).toBe(0);
      const activity = await client.query(
        `SELECT id FROM public.activity_events WHERE entity_id = $1`,
        [taskAId],
      );
      expect(activity.rowCount).toBe(0);
    });
  });

  it("queue reviewer in Org A sees intake items; cannot see Org B without membership triage", async () => {
    await asUser(reviewerAuthId, async (client) => {
      const intake = await client.query(
        `SELECT id FROM public.tasks
         WHERE source_type = 'staff_submission' AND status = 'new'`,
      );
      const ids = intake.rows.map((r) => r.id);
      expect(ids).toEqual(expect.arrayContaining([taskAId, taskBId]));

      const reviewerNotes = await client.query(
        `SELECT visibility FROM public.task_comments WHERE task_id = $1`,
        [taskAId],
      );
      expect(
        reviewerNotes.rows.some((r) => r.visibility === "reviewers_only"),
      ).toBe(true);
    });

    // Seed Org B submission; reviewer is not a member of Org B
    const { data: orgBTask, error } = await admin
      .from("tasks")
      .insert({
        organization_id: orgBId,
        title: "Org B item",
        source_type: "staff_submission",
        task_type: "open_item",
        status: "new",
        submitted_by_user_id: adminUserId,
        created_by_user_id: adminUserId,
        classification: "internal",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    await asUser(reviewerAuthId, async (client) => {
      const crossOrg = await client.query(
        `SELECT id FROM public.tasks WHERE id = $1`,
        [orgBTask!.id],
      );
      expect(crossOrg.rowCount).toBe(0);
    });
  });

  it("staff and reviewer lack audit.read and jobs.read", async () => {
    for (const authId of [submitterAAuthId, reviewerAuthId]) {
      await asUser(authId, async (client) => {
        const audit = await client.query(
          `SELECT public.has_permission('audit.read') AS allowed`,
        );
        const jobs = await client.query(
          `SELECT public.has_permission('jobs.read') AS allowed`,
        );
        expect(audit.rows[0].allowed).toBe(false);
        expect(jobs.rows[0].allowed).toBe(false);
      });
    }
  });

  it("read_only and unrelated cannot access Phase 2 tasks or compensation", async () => {
    await asUser(readOnlyAuthId, async (client) => {
      const tasks = await client.query(`SELECT id FROM public.tasks`);
      expect(tasks.rowCount).toBe(0);
      const createOwn = await client.query(
        `SELECT public.has_permission('tasks.create_own') AS allowed`,
      );
      expect(createOwn.rows[0].allowed).toBe(false);
      const comp = await client.query(
        `SELECT position_id FROM public.position_compensation`,
      );
      expect(comp.rowCount).toBe(0);
    });

    await asUser(unrelatedAuthId, async (client) => {
      const tasks = await client.query(`SELECT id FROM public.tasks`);
      expect(tasks.rowCount).toBe(0);
      const orgs = await client.query(`SELECT id FROM public.organizations`);
      expect(orgs.rowCount).toBe(0);
    });
  });

  it("compensation is isolated from broadly readable positions", async () => {
    await asUser(reviewerAuthId, async (client) => {
      const positions = await client.query(
        `SELECT id FROM public.positions WHERE id = $1`,
        [positionAId],
      );
      expect(positions.rowCount).toBe(1);
      const comp = await client.query(
        `SELECT position_id FROM public.position_compensation WHERE position_id = $1`,
        [positionAId],
      );
      expect(comp.rowCount).toBe(0);
    });

    await asUser(adminAuthId, async (client) => {
      const comp = await client.query(
        `SELECT min_amount FROM public.position_compensation WHERE position_id = $1`,
        [positionAId],
      );
      expect(comp.rowCount).toBe(1);
    });
  });

  it("rejects invalid staff_submission status and accepts DATE due_date", async () => {
    const bad = await admin.from("tasks").insert({
      organization_id: orgAId,
      title: "Bad status",
      source_type: "staff_submission",
      status: "open",
      submitted_by_user_id: submitterAId,
      created_by_user_id: submitterAId,
    });
    expect(bad.error).not.toBeNull();

    const ordinaryBad = await admin.from("tasks").insert({
      organization_id: orgAId,
      title: "Ordinary cannot use new",
      source_type: "manual",
      status: "new",
      created_by_user_id: adminUserId,
    });
    expect(ordinaryBad.error).not.toBeNull();

    const typeCheck = await pool.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'due_date'`,
    );
    expect(typeCheck.rows[0].data_type).toBe("date");
  });

  it("authenticated cannot INSERT into Phase 2 tables; inactive identity has no access", async () => {
    await asUser(submitterAAuthId, async (client) => {
      await client.query("SAVEPOINT deny_insert");
      await expect(
        client.query(
          `INSERT INTO public.tasks (
             organization_id, title, source_type, status,
             submitted_by_user_id, created_by_user_id
           ) VALUES ($1, 'x', 'staff_submission', 'new', $2, $2)`,
          [orgAId, submitterAId],
        ),
      ).rejects.toThrow(/permission denied|policy/i);
      await client.query("ROLLBACK TO SAVEPOINT deny_insert");
    });

    await asUser(inactiveAuthId, async (client) => {
      const uid = await client.query(
        `SELECT public.current_app_user_id() AS id`,
      );
      expect(uid.rows[0].id).toBeNull();
      const tasks = await client.query(`SELECT id FROM public.tasks`);
      expect(tasks.rowCount).toBe(0);
    });
    expect(inactiveUserId).toBeTruthy();
  });

  it("DST-safe DATE storage does not shift calendar day", async () => {
    // America/New_York spring-forward 2026-03-08; store pure DATE.
    const { data, error } = await admin
      .from("tasks")
      .insert({
        organization_id: orgAId,
        title: "DST date check",
        source_type: "manual",
        status: "open",
        created_by_user_id: adminUserId,
        due_date: "2026-03-08",
      })
      .select("due_date")
      .single();
    expect(error).toBeNull();
    expect(data?.due_date).toBe("2026-03-08");
  });
});
