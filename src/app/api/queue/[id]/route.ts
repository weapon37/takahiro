import { NextResponse } from "next/server";
import { query, isDatabaseConfigured } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_STATUSES = new Set(["draft", "approved", "skipped"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "不正なIDです。" }, { status: 400 });
  }

  let body: { content?: unknown; status?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストの形式が不正です。" },
      { status: 400 },
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (typeof body.content === "string" && body.content.trim().length > 0) {
    values.push(body.content.trim());
    updates.push(`content = $${values.length}`);
  }

  if (typeof body.status === "string") {
    if (!EDITABLE_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: "指定できないステータスです。" },
        { status: 400 },
      );
    }
    values.push(body.status);
    updates.push(`status = $${values.length}`);
  }

  if (updates.length === 0) {
    return NextResponse.json(
      { error: "content または status を指定してください。" },
      { status: 400 },
    );
  }

  updates.push(`updated_at = now()`);
  values.push(idNum);

  try {
    const rows = await query(
      `UPDATE post_queue SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING id`,
      values,
    );
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "投稿が見つかりません。" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "更新に失敗しました。" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL が設定されていません。" },
      { status: 400 },
    );
  }

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum)) {
    return NextResponse.json({ error: "不正なIDです。" }, { status: 400 });
  }

  try {
    await query(`DELETE FROM post_queue WHERE id = $1`, [idNum]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "削除に失敗しました。" },
      { status: 500 },
    );
  }
}
