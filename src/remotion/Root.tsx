import React from "react";
import { Composition, Still } from "remotion";
import { ShortVideo } from "./compositions/ShortVideo";
import { Thumbnail } from "./compositions/Thumbnail";
import { sampleShortVideo } from "./data/sample";
import { getTotalDuration, shortVideoSchema, type ShortVideoProps } from "./schema";

const FPS = 30;

/** props の内容から尺を計算する。ポイントを増やせば自動で動画が伸びる */
const calculateMetadata = ({ props }: { props: ShortVideoProps }) => ({
  durationInFrames: getTotalDuration(props, FPS),
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* TikTok / YouTube Shorts / Reels 向けの縦動画 */}
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        schema={shortVideoSchema}
        defaultProps={sampleShortVideo}
        calculateMetadata={calculateMetadata}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={1080}
        height={1920}
      />

      {/* 同じ中身を横位置で書き出す(X / YouTube 用) */}
      <Composition
        id="WideVideo"
        component={ShortVideo}
        schema={shortVideoSchema}
        defaultProps={sampleShortVideo}
        calculateMetadata={calculateMetadata}
        durationInFrames={30 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />

      {/* サムネイル用の静止画 */}
      <Still
        id="Thumbnail"
        component={Thumbnail}
        schema={shortVideoSchema}
        defaultProps={sampleShortVideo}
        width={1080}
        height={1920}
      />
    </>
  );
};
