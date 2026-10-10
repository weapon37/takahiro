#!/usr/bin/env python3
"""毎日のネタ候補づくり（X検索 → 上位25件 → ネタ2つ → 裏づけ → ファイル保存）。

標準ライブラリのみ。必要な環境変数:
  X_BEARER_TOKEN     X APIのBearer Token（直近検索用）
  ANTHROPIC_API_KEY  Anthropic APIキー
任意:
  ANTHROPIC_MODEL    使うモデル（既定: claude-sonnet-5-5）
  DAILY_OUT_DIR      出力先（既定: daily）
  USED_IDEAS_FILE    使用済みネタの記録（既定: data/used-ideas.md）

出力は他人の投稿を含むため、公開リポジトリにコミットしない（.gitignore済み）。
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

QUERY = "AI副業 SNS 活用 -is:retweet lang:ja"
FETCH_COUNT = 50  # 1回に取得する件数（費用に直結）
TOP_N = 25
IDEA_MAX = 100  # 1ネタの最大文字数
TOTAL_MAX = 600  # ネタファイル全体の最大文字数
JST = timezone(timedelta(hours=9))
MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")
OUT_DIR = os.environ.get("DAILY_OUT_DIR", "daily")
USED_FILE = os.environ.get("USED_IDEAS_FILE", "data/used-ideas.md")

GOAL = "AI副業をしていて、その様子をX発信している読者からリプをもらう"
AUDIENCE = "30〜40代の会社員・副業初心者"
PAIN = "AI副業でどのようにAIを活用したらいいか"


def http_json(url, headers=None, body=None, timeout=60):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def fail(today, reason):
    """取得できなかった場合は、理由だけを書いたファイルを残して終了する。"""
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{today}.md")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {today}\n\n取得できなかった：{reason}\n")
    print(f"失敗: {reason}\n  → {path}")
    sys.exit(1)


def fetch_posts(today):
    token = os.environ.get("X_BEARER_TOKEN")
    if not token:
        fail(today, "X_BEARER_TOKEN が設定されていない")
    params = urllib.parse.urlencode({
        "query": QUERY,
        "max_results": FETCH_COUNT,
        "tweet.fields": "public_metrics,created_at",
    })
    try:
        res = http_json(
            f"https://api.x.com/2/tweets/search/recent?{params}",
            headers={"Authorization": f"Bearer {token}"},
        )
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        fail(today, f"X APIがエラーを返した（HTTP {e.code}）: {detail}")
    except Exception as e:  # noqa: BLE001
        fail(today, f"X APIに接続できなかった: {e}")
    posts = []
    for t in res.get("data", []):
        m = t.get("public_metrics")
        reactions = None
        if m is not None:
            reactions = (m.get("like_count", 0) + m.get("retweet_count", 0)
                         + m.get("reply_count", 0))
        posts.append({
            "text": t["text"],
            "reactions": reactions,
            "url": f"https://x.com/i/web/status/{t['id']}",
        })
    if not posts:
        fail(today, "検索結果が0件だった")
    posts.sort(key=lambda p: -1 if p["reactions"] is None else p["reactions"],
               reverse=True)
    return posts[:TOP_N]


def read_used():
    if not os.path.exists(USED_FILE):
        os.makedirs(os.path.dirname(USED_FILE) or ".", exist_ok=True)
        with open(USED_FILE, "w", encoding="utf-8") as f:
            f.write("# 使用済みネタ\n")
        return ""
    with open(USED_FILE, encoding="utf-8") as f:
        return f.read()


def ask_claude(today, posts, used, feedback=""):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        fail(today, "ANTHROPIC_API_KEY が設定されていない")
    listing = "\n".join(
        f"[{i + 1}] {p['text'].replace(chr(10), ' ')[:280]}"
        for i, p in enumerate(posts))
    prompt = f"""今日は{today}。読者の生の声（X投稿）から、明日の投稿に使えるネタ候補を2つ選んでください。
ゴール: {GOAL}
読者像: {AUDIENCE}
読者の悩み: {PAIN}

条件: まだ使っていない / 読者が知らなさそう / その仕事をしている人なら「あるある」と言える / 今の時期に合う
- ネタは必ず下の投稿のどれかに根拠を持たせ、source_index に番号を書く。投稿にない内容を足さない。
- 1ネタは{IDEA_MAX}字以内。投稿文そのものは書かない（ネタの要点だけ）。
- 数字や事実を推測で書かない。
- evidence_url は、そのネタの事実面を確かめられる公式ページ等のURL。確信が持てないなら空文字にする（URLを作らない）。
- evidence_keyword は、そのページ内に実在するはずの短い語句。URLが空なら空文字。

使用済みネタ（これらと重複させない）:
{used or '（なし）'}

投稿一覧:
{listing}

次のJSONのみを出力:
{{"summaries":["[1]の投稿の20字以内の要約", ... 全{len(posts)}件分、順番通り],
 "ideas":[{{"idea":"...","source_index":1,"evidence_url":"","evidence_keyword":""}}, {{...}}]}}
{feedback}"""
    try:
        res = http_json(
            "https://api.anthropic.com/v1/messages",
            headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                     "content-type": "application/json"},
            body={"model": MODEL, "max_tokens": 2000,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=120)
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:300]
        fail(today, f"Anthropic APIがエラーを返した（HTTP {e.code}）: {detail}")
    except Exception as e:  # noqa: BLE001
        fail(today, f"Anthropic APIに接続できなかった: {e}")
    text = "".join(b.get("text", "") for b in res.get("content", []))
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        fail(today, "AIの応答からJSONを読み取れなかった")
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        fail(today, "AIの応答のJSONが壊れていた")


def verify_url(url, keyword):
    """URLが開け、かつキーワードがページ内にある場合だけ「確認済み」とする。"""
    if not url or not url.startswith("https://") or not keyword:
        return False
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            if r.status != 200:
                return False
            body = r.read(2_000_000).decode("utf-8", errors="ignore")
        return keyword in body
    except Exception:  # noqa: BLE001
        return False


def render_ideas(today, ideas):
    lines = [f"# {today} ネタ候補"]
    for i, it in enumerate(ideas, 1):
        lines.append(f"\n## {i}. {it['idea']}")
        lines.append(f"- 元の声: {it['source_url']}")
        lines.append(f"- 裏づけ: {it['evidence']}")
    return "\n".join(lines) + "\n"


def main():
    today = datetime.now(JST).strftime("%Y-%m-%d")
    posts = fetch_posts(today)
    used = read_used()

    feedback = ""
    for _ in range(3):
        out = ask_claude(today, posts, used, feedback)
        ideas = out.get("ideas", [])
        if len(ideas) != 2:
            feedback = "\n前回は2つになっていませんでした。必ず2つにしてください。"
            continue
        final = []
        for it in ideas:
            idx = it.get("source_index")
            if not isinstance(idx, int) or not 1 <= idx <= len(posts):
                final = []
                break
            ok = verify_url(it.get("evidence_url", ""), it.get("evidence_keyword", ""))
            final.append({
                "idea": it["idea"].strip(),
                "source_url": posts[idx - 1]["url"],
                "evidence": it["evidence_url"] if ok else "未確認",
            })
        if len(final) != 2:
            feedback = "\n前回は source_index が不正でした。1〜{}の整数にしてください。".format(len(posts))
            continue
        body = render_ideas(today, final)
        too_long = [x for x in final if len(x["idea"]) > IDEA_MAX]
        if too_long or len(body) > TOTAL_MAX:
            feedback = (f"\n前回は長すぎました（ネタは{IDEA_MAX}字以内、"
                        f"ファイル全体は{TOTAL_MAX}字以内に収まるよう短く）。")
            continue
        break
    else:
        fail(today, f"{TOTAL_MAX}字以内に収まるネタを3回試しても作れなかった")

    os.makedirs(OUT_DIR, exist_ok=True)
    ideas_path = os.path.join(OUT_DIR, f"{today}.md")
    with open(ideas_path, "w", encoding="utf-8") as f:
        f.write(body)

    summaries = out.get("summaries", [])
    rows = ["| # | 投稿の要約 | 反応数 | URL | 取得日 |", "|---|---|---|---|---|"]
    for i, p in enumerate(posts):
        s = summaries[i] if i < len(summaries) else ""
        r = "" if p["reactions"] is None else str(p["reactions"])
        rows.append(f"| {i + 1} | {s} | {r} | {p['url']} | {today} |")
    voices_path = os.path.join(OUT_DIR, f"{today}-voices.md")
    with open(voices_path, "w", encoding="utf-8") as f:
        f.write(f"# {today} 読者の声 上位{len(posts)}件\n\n" + "\n".join(rows) + "\n")

    print(f"ネタ: {ideas_path}（{len(body)}字）\n読者の声: {voices_path}")


if __name__ == "__main__":
    main()
