"""スプレッドシートのレイアウト定義

1つのタブ(シート)に「運行表」と「ガソリン代按分」の両方を持たせる構成。
シートは月ごとに1枚(例: "2026.8")。
列位置・行位置をここで一元管理する。変更する場合は関連する列文字も
あわせて修正すること(自動計算はしていない)。
"""

# --- 運行表セクション (シート上部) ---
HEADER_ROW = 1
DATA_START_ROW = 2
MAX_DAYS = 31
TOTAL_ROW = DATA_START_ROW + MAX_DAYS  # 33行目に月間合計

DRIVING_LOG_HEADERS = [
    "日", "終了距離数(km)", "移動距離(km)", "運転手(A/B/AB)", "備考",
    "A距離(km)", "B距離(km)",
]

# A=日 B=終了距離数 C=移動距離 D=運転手 E=備考 F=A距離 G=B距離
COL_DAY = "A"
COL_END_KM = "B"
COL_DISTANCE = "C"
COL_DRIVER = "D"
COL_NOTE = "E"
COL_A_DISTANCE = "F"
COL_B_DISTANCE = "G"

# --- ガソリン代按分セクション (同じシートの運行表の下) ---
# B列に項目名、C列に金額・数式を配置する
FUEL_SECTION_ROW = TOTAL_ROW + 2                            # 35 見出し
MAX_RECEIPTS = 10
RECEIPT_START_ROW = FUEL_SECTION_ROW + 1                    # 36 領収書1
RECEIPT_END_ROW = RECEIPT_START_ROW + MAX_RECEIPTS - 1      # 45 領収書10
FUEL_TOTAL_ROW = RECEIPT_END_ROW + 1                        # 46 合計金額
FUEL_A_DIST_ROW = FUEL_TOTAL_ROW + 1                        # 47 A距離
FUEL_B_DIST_ROW = FUEL_TOTAL_ROW + 2                        # 48 B距離
FUEL_A_SHARE_ROW = FUEL_TOTAL_ROW + 3                       # 49 A負担額
FUEL_B_SHARE_ROW = FUEL_TOTAL_ROW + 4                       # 50 B負担額

COL_FUEL_LABEL = "B"
COL_FUEL_VALUE = "C"

FUEL_SECTION_TITLE = "■ ガソリン代按分"
