# nagoya-hotel-deals

名古屋エリアのホテル宿泊プランの価格（**土曜泊のみ**）を日次トラッキングし、GitHub Pages ダッシュボードで可視化するツール。

## 機能

- 楽天トラベル API でお気に入りホテルの土曜泊価格を日次取得
- GitHub Pages ダッシュボードで土曜ベスト早見表・価格推移・ヒートマップを表示
- バッチ実行エラー時のみ管理者へ Gmail でアラート（お得プランのメール通知は廃止）

## 技術スタック

- Google Apps Script（データ取得・通知・API）
- Google スプレッドシート（データストア）
- GitHub Pages（ダッシュボード）
- 楽天トラベル空室検索 API

## セットアップ

1. Google スプレッドシートを作成し、Hotels / PriceLog / NotifyLog / Config シートを用意する
2. [楽天ウェブサービス](https://webservice.rakuten.co.jp/) で applicationId を取得
3. Config シートに API_KEY 等を設定
4. `clasp push` で GAS コードをデプロイ
5. GAS トリガーで `checkAllPrices` を日次実行に設定（土曜泊のみ取得）
6. GAS WebApp をデプロイし、`pages/app.js` の `API_URL` を更新
7. GitHub Pages を有効化

## ダッシュボード画面構成（土曜泊フォーカス）

| セクション | 内容 |
|---|---|
| 土曜ベスト早見表 | 直近〜4週先の各土曜で最も安いホテルと価格を、安い土曜順に表示 |
| 価格推移 | ホテル別の土曜価格推移を Chart.js で折れ線グラフ表示 |
| ヒートマップ | 土曜×ホテルの最安値を色分け表示 |
| ホテル一覧 | 登録ホテルのカード表示（土曜の直近最安値付き） |

サマリーバナーは「追跡中ホテル数 / 土曜最安 / 次の土曜」を表示する。

公開 URL: https://ramdamain-commits.github.io/nagoya-hotel-deals/

## スプレッドシート構成

| シート | 用途 |
|---|---|
| Hotels | お気に入りホテルのマスタ（hotelNo・ホテル名・目標価格） |
| PriceLog | 日次取得の価格履歴（ホテル×土曜泊ごとの最安プランのみ） |
| NotifyLog | 旧通知履歴のアーカイブ（書き込みは停止。残置のみ） |
| Config | API キー・取得設定等 |

## Config シート設定項目

| キー | 説明 |
|---|---|
| API_KEY | 楽天ウェブサービスの applicationId |
| ADULT_NUM | 検索時の大人人数（デフォルト: 2） |
| WEEKS_AHEAD | 何週間先まで取得するか（デフォルト: 4） |
| NOTIFY_EMAIL | バッチ実行エラー時のアラート先メールアドレス |
| REQUEST_DELAY_MS | API リクエスト間のディレイ（ミリ秒、デフォルト: 1000） |

> お得プランのメール通知を廃止したため、`COOLDOWN_HOURS` / `HOTEL_COOLDOWN_HOURS` / `MAX_DEALS_PER_HOTEL` / `DISCOUNT_THRESHOLD_PCT` は未使用（設定が残っていても無視される）。
