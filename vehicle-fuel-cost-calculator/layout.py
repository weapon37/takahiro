"""スプレッドシートのレイアウト定義(運行表シート・ガソリン代按分シート共通)

列位置をここで一元管理する。列数を変える場合は関連する列文字も
あわせて修正すること(自動計算はしていない)。
"""

# --- 運行表シート (例: "2026.8") ---
HEADER_ROW = 1
DATA_START_ROW = 2
MAX_DAYS = 31
TOTAL_ROW = DATA_START_ROW + MAX_DAYS  # 33行目に月間合計を書き込む

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

# --- ガソリン代按分シート ---
FUEL_HEADER_ROW = 1
FUEL_DATA_START_ROW = 2
MAX_RECEIPTS = 10  # 変更する場合はB〜K以降の列文字も合わせて修正すること

FUEL_HEADERS = (
    ["対象月"]
    + [f"領収書{i}" for i in range(1, MAX_RECEIPTS + 1)]
    + ["合計金額", "A距離(km)", "B距離(km)", "A負担額", "B負担額"]
)

# A=対象月 B〜K=領収書1〜10 L=合計金額 M=A距離 N=B距離 O=A負担額 P=B負担額
COL_MONTH = "A"
COL_FUEL_TOTAL = "L"
COL_FUEL_A_DIST = "M"
COL_FUEL_B_DIST = "N"
COL_FUEL_A_SHARE = "O"
COL_FUEL_B_SHARE = "P"
