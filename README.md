# nagoya-hotel-deals

名古屋エリアのホテル宿泊プランの価格を日次トラッキングし、お得なタイミングでメール通知するツール。

## 機能

- 楽天トラベル API でお気に入りホテルの価格を日次取得
- 目標価格または30日平均比で割安なプランを Gmail 通知
- GitHub Pages ダッシュボードで価格推移・ヒートマップ・おすすめ検索を表示

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
5. GAS トリガーで `checkAllPrices` を日次実行に設定
6. GAS WebApp をデプロイし、`pages/app.js` の `API_URL` を更新
7. GitHub Pages を有効化

## ダッシュボード画面構成

| タブ / セクション | 内容 |
|---|---|
| デート日おすすめ検索 | 日付範囲を指定してコスパスコア順にランキング表示 |
| お得アラート | 割安率・目標価格を下回っているプランの一覧 |
| ヒートマップ | 日付×ホテルの最安値を色分け表示 |
| 価格推移 | ホテル別の価格推移を Chart.js で折れ線グラフ表示 |
| ホテル一覧 | 登録ホテルのカード表示（直近最安値付き） |

公開 URL: https://ramdamain-commits.github.io/nagoya-hotel-deals/

## スプレッドシート構成

| シート | 用途 |
|---|---|
| Hotels | お気に入りホテルのマスタ（hotelNo・ホテル名・目標価格） |
| PriceLog | 日次取得の価格履歴（ホテル×宿泊日ごとの最安プランのみ） |
| NotifyLog | 通知履歴（クールダウン管理用） |
| Config | API キー・通知設定等 |

## Config シート設定項目

| キー | 説明 |
|---|---|
| API_KEY | 楽天ウェブサービスの applicationId |
| ADULT_NUM | 検索時の大人人数（デフォルト: 2） |
| WEEKS_AHEAD | 何週間先まで取得するか（デフォルト: 4） |
| NOTIFY_EMAIL | 通知先メールアドレス |
| REQUEST_DELAY_MS | API リクエスト間のディレイ（ミリ秒、デフォルト: 1000） |
| COOLDOWN_HOURS | 同一ホテル×宿泊日の通知クールダウン時間（デフォルト: 24） |
| DISCOUNT_THRESHOLD_PCT | 通知する割安率の閾値（%、デフォルト: 10） |
