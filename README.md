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

## ダッシュボード

https://ramdamain-commits.github.io/nagoya-hotel-deals/
