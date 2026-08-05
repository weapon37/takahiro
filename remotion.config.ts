import { Config } from "@remotion/cli/config";

// npx remotion コマンド共通の設定。
// レンダリング時のフラグ (--codec など) を渡せば、こちらより優先される。
Config.setEntryPoint("./src/remotion/index.ts");

// 中間フレームの形式。jpeg のほうが速く、透過が要らないなら十分きれい。
Config.setVideoImageFormat("jpeg");

// 書き出し先のデフォルト。out/ は .gitignore 済み。
Config.setOutputLocation("out/video.mp4");
Config.setOverwriteOutput(true);

Config.setCodec("h264");
// 数値が小さいほど高画質・大容量 (0-51)。SNS 投稿なら 18 前後がちょうどよい。
Config.setCrf(18);

// SNS のプレイヤーで音が出ない事故を避けるため AAC で固定する。
Config.setAudioCodec("aac");
