# 勇吉屋HP さくら移行パッケージ

## フォルダの意味

- `www/`: さくらのサーバーの `www` フォルダへアップロードする公開ファイル
- `server-private/`: 公開してはいけない設定ファイルのひな形
- `MANIFEST.json`: ファイル欠落を確認するための一覧とSHA-256

## GitHubとさくらの役割

- GitHub: 制作データ、変更履歴、復旧用バックアップ
- さくら: お客様が実際に見るHPと、勇吉屋専用ダッシュボードの公開先

GitHubは移行後も削除しません。更新した内容をGitHubで管理し、確認後にさくらへ反映します。

## アップロード前

1. お客様名義のさくら会員IDとスタンダードプランを用意する
2. サーバーコントロールパネルで、仮URLとFTP/SFTP情報を確認する
3. `server-private/yuukichiya-contact.example.php` を複製して `yuukichiya-contact.php` にする
4. `allowed_hosts` に、さくらの仮URLのホスト名を一時的に追加する
5. `yuukichiya-contact.php` は `www` の1つ上に置く
6. `www/` の中身を、さくら側の `www` へアップロードする

## ダッシュボード

- 商品一覧編集: `https://yuukichiya-web.sakura.ne.jp/product-dashboard.html`
- 新着情報編集: `https://yuukichiya-web.sakura.ne.jp/yuukichiya-dashboard.html`

ダッシュボードのHTML・CSS・JavaScriptはさくらへ配置します。LINE受信、投稿公開、商品画像保存などの処理はCloudflare Worker / D1 / R2を継続利用します。ダッシュボードは検索対象外ですが、URLを非公開にするだけでは認証にならないため、管理API側の認証は維持します。

仮URL運用中は、Cloudflare Workerの `PUBLIC_SITE_BASE_URL` と `DASHBOARD_URL` も上記さくらURLへ向けます。LINE/LIFFデモの仮公開先は `https://yuukichiya-web.sakura.ne.jp/line-demo/` です。

## 仮URLで必ず確認するもの

- トップ、スポーツ用品、商品、サービス、取扱校、店舗、問い合わせ、新着、リニューアルLP
- スマホ表示とメニュー
- BASEのリンク
- Googleカレンダーの営業日・イベント
- 新着情報の最新3件と一覧
- お問い合わせフォームの実送信と受信
- 404ページ

## ドメイン移管後

1. さくらのドメイン設定へ `yuukichi-ya.com` と `www.yuukichi-ya.com` を追加する
2. 無料SSLを申し込み、HTTPSで全ページが開くことを確認する
3. `https-redirect.htaccess.snippet` の内容を `.htaccess` 末尾へ追加する
4. `yuukichiya-contact.php` の仮URLホスト名を削除する
5. Cloudflare Workerの `PUBLIC_SITE_BASE_URL` と `DASHBOARD_URL` を `https://www.yuukichi-ya.com/` 配下へ変更して再デプロイする
6. LINE DevelopersのLIFF Endpoint URLを `https://www.yuukichi-ya.com/line-demo/` に変更する
7. HP、LINE投稿、Googleカレンダー、問い合わせ、BASEリンクを実機確認する
8. すべて成功してからJimdo解約を確定する

## 移行しないもの

次の機能は現在の外部サービスを継続利用するため、さくらへコピーしません。

- LINE受信・投稿管理: Cloudflare Worker / D1 / R2
- 商品一覧編集・商品画像管理: Cloudflare Worker / D1 / R2
- 新着情報公開API: Kokotomo / Render
- Googleカレンダー公開API: Kokotomo / Render
- EC: BASE

HP内にAPIキーやLINEトークンは入っていません。秘密情報は各サービスの環境変数のまま維持します。
