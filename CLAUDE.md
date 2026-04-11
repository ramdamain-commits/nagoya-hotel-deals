# Repo Rules

- 親 `C:\Users\ramda\projects\CLAUDE.md` を先に適用する
- 現行仕様の正本は `README.md` + `CHANGELOG.md`
- 設計書: `../docs/superpowers/specs/2026-04-11-nagoya-hotel-deals-design.md`
- GAS コードは clasp push でデプロイ。コミット後は `clasp push` もセットで実行する
- 文字コードは UTF-8

## 楽天トラベル API

- エンドポイント: VacantHotelSearch/20170426
- applicationId はスプレッドシートの Config シートに保存。コードにハードコードしない
- リクエスト間に1秒のディレイを入れる
- 429 レスポンス時はログに記録してスキップする

## スプレッドシート構成

- Hotels: お気に入りホテルのマスタ
- PriceLog: 日次取得の価格履歴（ホテル×日付ごとの最安プランのみ）
- NotifyLog: 通知履歴（クールダウン管理用）
- Config: API キー・通知設定等
