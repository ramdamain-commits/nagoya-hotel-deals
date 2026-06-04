# Repo Rules

- 親 `C:\Users\ramda\projects\CLAUDE.md` を先に適用する
- 現行仕様の正本は `README.md` + `CHANGELOG.md`
- 設計書: `../docs/superpowers/specs/2026-04-11-nagoya-hotel-deals-design.md`
- GAS コードは clasp push でデプロイ。コミット後は `clasp push` もセットで実行する
  - clasp はグローバル導入済み（v3.3.0, 2026-06-04 確認）。PATH から直接 `clasp push --force` が使える。新規シェルで未認識のときは新しいターミナルを開く。最終手段として `healthcare/node_modules/.bin/clasp.cmd` をフルパス呼び出しでも可（cwd の `.clasp.json` を見る）
- 文字コードは UTF-8

## 楽天トラベル API

- 新ドメイン: `openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426`
- 認証: `applicationId`（クエリパラメータ）+ `accessKey`（クエリパラメータ）+ `Referer`/`Origin` ヘッダー（Config の `APP_URL`）
- GAS の UrlFetchApp は Referer/Origin ヘッダーを送信可能（2026-04-12 確認済み）
- Referer/Origin には楽天コンソール登録サイト（`script.google.com`）を設定する。`rakuten.co.jp` は単発では通るが連続リクエストで `HTTP_REFERRER_NOT_ALLOWED` になる
- `clasp push` 後に GAS エディタの表示が更新されないことがある。`--force` フラグで強制 push、エディタはリロードで反映
- リクエスト間に1秒のディレイを入れる
- 429 レスポンス時はログに記録してスキップする
- GAS 6分制限: 28日×1秒=最低28秒。ホテル数増加時はチェックポイント方式を検討

## ダッシュボード検証

- Preview ツールは外部API（GAS WebApp）への fetch でタイムアウトする → Chrome MCP を使う
- Chrome MCP のスクリーンショットはこのページで安定しない → JS実行（`javascript_tool`）でDOM状態・CSS値・chartInstance.data を直接検証する方が確実
- ローカル検証時は `python3 -m http.server 8090 --directory pages` で起動し Chrome MCP でアクセス

## スプレッドシート構成

- Hotels: お気に入りホテルのマスタ
- PriceLog: 日次取得の価格履歴（ホテル×日付ごとの最安プランのみ）
- NotifyLog: 通知履歴（クールダウン管理用）
- Config: API キー・通知設定等
