# 楽スタHP・LINE BOT連携準備

このフォルダは本番実装前の雛形です。GitHub Pages の既存デザインはそのまま残し、楽スタHPから受ける新着情報と、LINE BOTへ送る画像付きメッセージの形を先に固定します。

## 戻せる地点

現デザインは次のタグへ退避済みです。

```bash
git checkout checkpoint-good-design-20260708
```

通常作業ブランチへ戻る場合:

```bash
git checkout main
```

## データの流れ

### 楽スタHP連携

1. 楽スタHPまたは中継APIが `assets/data/rakusuta-news.sample.json` と同じ形式で記事を返す
2. HP側は記事タイトル、本文、画像、リンクを新着情報に表示する
3. LINE BOT側は同じ記事を画像メッセージまたは Flex Message カードに変換する

本番では `assets/data/rakusuta-news.sample.json` を直接編集するのではなく、楽スタHP側の出力URL、または Cloudflare Worker などの中継APIを参照します。

### HP更新専用LINE BOT

既存の「勇吉屋公式」はお客様向けとして残し、HP更新専用に別チャネルを作ります。

```text
スタッフLINE
  ↓
勇吉屋HP更新管理Bot
  ↓
Cloudflare Worker
  ↓
D1: 投稿本文・状態・リンク
R2: 投稿画像
  ↓
勇吉屋専用ダッシュボード
  ↓
HP新着情報の公開フィード
```

管理画面:

```text
yuukichiya-dashboard.html
```

Worker:

```text
cloudflare/src/index.js
cloudflare/schema.sql
cloudflare/wrangler.jsonc
```

## 本番LINE BOTに必要な環境変数

秘密情報はGitへ入れません。

```text
LINE_CHANNEL_SECRET=...
LINE_CHANNEL_ACCESS_TOKEN=...
ADMIN_TOKEN=...
```

`ADMIN_TOKEN` はダッシュボードからWorker APIを操作するための管理トークンです。

## Googleカレンダー連携

HPのブラウザからGoogle Calendar APIを直接呼ばず、楽スタ／Kokotomoの公開用中継APIを参照します。

```text
Googleカレンダー
  ↓ GOOGLE_CALENDAR_API_KEY（サーバーの環境変数）
楽スタ／Kokotomo中継API
  ↓ 公開予定だけのJSON
勇吉屋HP
```

HP側の参照先:

```text
https://kokotomo-sns.bantex.jp/api/public/hp-calendar/yuukichiya/events.json
```

サーバー側に追加する環境変数:

```text
GOOGLE_CALENDAR_API_KEY=...
```

このキーは既存の `GOOGLE_API_KEY` や `GEMINI_API_KEY` と共有せず、Google CloudでGoogle Calendar APIだけに制限した専用キーを使います。HTML、JavaScript、Gitには値を書きません。

### 本番反映順序

1. Google Cloudで専用キーを作り、利用APIをGoogle Calendar APIだけに制限する
2. Renderの楽スタ／Kokotomo Dashboardサービスへ `GOOGLE_CALENDAR_API_KEY` を登録する
3. Dashboardをデプロイし、公開カレンダーAPIがHTTP 200を返すことを確認する
4. 勇吉屋HPを反映し、Googleカレンダーの追加・変更がHPへ表示されることを確認する
5. 以前HPで使っていたカレンダー用キーが残っていれば無効化する

公開API確認:

```bash
curl -fsS https://kokotomo-sns.bantex.jp/api/public/hp-calendar/yuukichiya/events.json
```

APIが未設定または一時停止している間、HPは `assets/data/calendar-events.json` の保存データへ自動的に切り替わります。

## Cloudflare設定

Cloudflareへログイン後に実行します。

```bash
npx wrangler d1 create yuukichiya-hp-news
npx wrangler r2 bucket create yuukichiya-hp-news-media
npx wrangler d1 execute yuukichiya-hp-news --file=cloudflare/schema.sql --remote
npx wrangler secret put LINE_CHANNEL_SECRET --config cloudflare/wrangler.jsonc
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN --config cloudflare/wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN --config cloudflare/wrangler.jsonc
npx wrangler deploy --config cloudflare/wrangler.jsonc
```

`d1 create` の戻り値に `database_id` が出た場合は、`cloudflare/wrangler.jsonc` の `d1_databases` に追記します。

## LINE Developers / LINE Official Account設定

2024年9月以降、Messaging APIチャネルはLINE Developers Consoleから直接新規作成できません。先にLINE公式アカウントを新規作成し、その公式アカウントでMessaging APIを有効化します。

新規公式アカウント名:

```text
勇吉屋HP更新管理Bot
```

用途:

```text
HP更新管理専用。お客様向けの「勇吉屋公式」とは分ける。
```

流れ:

```text
LINE Official Account Managerで公式アカウント作成
  ↓
Messaging APIを有効化
  ↓
Providerは勇吉屋/既存管理Providerを選択
  ↓
LINE Developers Consoleで作成されたMessaging APIチャネルを確認
```

Messaging API設定:

```text
Webhook URL: https://<worker-url>/webhook
Use webhook: ON
Auto-reply messages: OFF
Greeting messages: 任意
```

チャネルシークレットを `LINE_CHANNEL_SECRET`、Messaging APIのチャネルアクセストークンを `LINE_CHANNEL_ACCESS_TOKEN` に登録します。

## 表示確認

プレビュー:

```text
rakusuta-line-preview.html
yuukichiya-dashboard.html
```

このページでは、HP新着情報に入る形と、LINE上で画像がどう表示されるかを同時に確認できます。
