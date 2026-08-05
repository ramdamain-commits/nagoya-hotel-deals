# Repo Rules

- 親 `C:\Users\ramda\projects\CLAUDE.md` を先に適用する
- 現行仕様の正本は `README.md` + `CHANGELOG.md`
- エントリポイント: `gas/WebApp.gs`（`doGet` = ダッシュボード用API）/ `gas/PriceChecker.gs`（`checkAllPrices` = 日次トリガー本体）/ `gas/Setup.gs`・`gas/Menu.gs`（初期セットアップ・スプレッドシートメニュー）/ `gas/Cleanup.gs`（単発データ移行）/ `pages/app.js`（ダッシュボード描画）
- 設計書: `../docs/superpowers/specs/2026-04-11-nagoya-hotel-deals-design.md`（初期設計）+ `../docs/superpowers/specs/2026-06-06-nagoya-hotel-deals-saturday-only-design.md`（土曜泊限定化。現行アーキテクチャはこちらが正）
- GAS コードは clasp push でデプロイ。コミット後は `clasp push` もセットで実行する
  - clasp はグローバル導入済み（v3.3.0, 2026-06-04 確認）。PATH から直接 `clasp push --force` が使える。新規シェルで未認識のときは新しいターミナルを開く。最終手段として `healthcare/node_modules/.bin/clasp.cmd` をフルパス呼び出しでも可（cwd の `.clasp.json` を見る。ただし無関係な別 repo の node_modules に依存する暫定策。本 repo に自己完結した代替は未整備）
- 文字コードは UTF-8

## 楽天トラベル API

- 新ドメイン: `openapi.rakuten.co.jp/engine/api/Travel/VacantHotelSearch/20170426`
- 認証: `applicationId`（クエリパラメータ）+ `accessKey`（クエリパラメータ）+ `Referer`/`Origin` ヘッダー（Config の `APP_URL`、GAS の UrlFetchApp から送信可能・2026-04-12 確認済み）
- Referer/Origin には楽天コンソール登録サイト（`script.google.com`）を設定する。`rakuten.co.jp` は単発では通るが連続リクエストで `HTTP_REFERRER_NOT_ALLOWED` になる
- `clasp push` 後に GAS エディタの表示が更新されないことがある。`--force` フラグで強制 push、エディタはリロードで反映
- リクエスト間に1秒のディレイを入れる
- 429 レスポンス時はログに記録してスキップする
- GAS 6分制限: 28日ループは回すが、API呼び出し+ディレイが発生するのは土曜（weeksAhead日、既定4件）のみ（Saturday-only最適化, commit 7a333c2, v0.4.1）。最低 weeksAhead×delayMs（既定4秒）+ ホテル数15件超過時のバッチ間ディレイ。ホテル数・weeksAhead増加時はチェックポイント方式を検討

## ダッシュボード検証

- **ローカル実描画検証は `pages/app.js` の `API_URL` を一時的に `''` にして mock-data.json フォールバックで行う**（`var url = API_URL || 'mock-data.json'`）。GAS WebApp 直叩きは preview がタイムアウトするため。検証後は必ず実 URL に戻す（コミット前に `grep "var API_URL"` で空でないこと確認）。mock-data.json は平日・土曜混在なので土曜フィルタの検証に使える
- **`preview_screenshot` はこのダッシュボードで30秒タイムアウトする**（既知）。`preview_eval` で DOM（セクションid・テーブル行・getComputedStyle）を直接検証する方が確実
- Preview ツールは外部API（GAS WebApp）への fetch でタイムアウトする → Chrome MCP を使う
- Chrome MCP のスクリーンショットはこのページで安定しない → JS実行（`javascript_tool`）でDOM状態・CSS値・chartInstance.data を直接検証する方が確実
- ローカル検証時は `python3 -m http.server 8090 --directory pages` で起動し Chrome MCP でアクセス

## スプレッドシート構成

- Hotels: お気に入りホテルのマスタ
- PriceLog: 日次取得の価格履歴（ホテル×土曜泊ごとの最安プランのみ）
- NotifyLog: 旧通知履歴のアーカイブ（v0.5.0 で Gmail 通知を廃止。書き込み停止・残置のみ）
- Config: API キー・取得設定等
