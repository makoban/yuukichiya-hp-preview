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

1. 楽スタHPまたは中継APIが `assets/data/rakusuta-news.sample.json` と同じ形式で記事を返す
2. HP側は記事タイトル、本文、画像、リンクを新着情報に表示する
3. LINE BOT側は同じ記事を画像メッセージまたは Flex Message カードに変換する

本番では `assets/data/rakusuta-news.sample.json` を直接編集するのではなく、楽スタHP側の出力URL、または Cloudflare Worker などの中継APIを参照します。

## 本番LINE BOTに必要な環境変数

秘密情報はGitへ入れません。

```text
LINE_WEBHOOK_SIGNING_VALUE=...
LINE_REPLY_VALUE=...
RAKUSUTA_FEED_URL=https://.../rakusuta-news.json
SITE_BASE_URL=https://makoban.github.io/yuukichiya-hp-preview/
```

## 表示確認

プレビュー:

```text
rakusuta-line-preview.html
```

このページでは、HP新着情報に入る形と、LINE上で画像がどう表示されるかを同時に確認できます。
