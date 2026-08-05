import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Background } from "../components/Background";
import { ProgressBar } from "../components/Chrome";
import { HookScene } from "../scenes/HookScene";
import { OutroScene } from "../scenes/OutroScene";
import { PointScene } from "../scenes/PointScene";
import { getSceneDurations, TRANSITION_FRAMES, type ShortVideoProps } from "../schema";
import { getTheme } from "../theme";

const timing = linearTiming({ durationInFrames: TRANSITION_FRAMES });

export const ShortVideo: React.FC<ShortVideoProps> = (props) => {
  const { fps } = useVideoConfig();
  const theme = getTheme(props.theme);
  const durations = getSceneDurations(props, fps);

  // TransitionSeries は Sequence と Transition が交互に並ぶ必要があるため、
  // ポイントの数だけ組み立ててから渡す。
  const children: React.ReactNode[] = [
    <TransitionSeries.Sequence key="hook" durationInFrames={durations.hook}>
      <HookScene hook={props.hook} theme={theme} />
    </TransitionSeries.Sequence>,
  ];

  props.points.forEach((point, index) => {
    children.push(
      <TransitionSeries.Transition
        key={`transition-${index}`}
        presentation={slide({ direction: "from-bottom" })}
        timing={timing}
      />,
      <TransitionSeries.Sequence
        key={`point-${index}`}
        durationInFrames={durations.points[index]}
      >
        <PointScene
          point={point}
          index={index}
          total={props.points.length}
          theme={theme}
        />
      </TransitionSeries.Sequence>,
    );
  });

  children.push(
    <TransitionSeries.Transition
      key="transition-outro"
      presentation={fade()}
      timing={timing}
    />,
    <TransitionSeries.Sequence key="outro" durationInFrames={durations.outro}>
      <OutroScene outro={props.outro} theme={theme} />
    </TransitionSeries.Sequence>,
  );

  return (
    <AbsoluteFill>
      {/* 背景はシーンをまたいで動き続けてほしいので TransitionSeries の外に置く */}
      <Background theme={theme} />
      <TransitionSeries>{children}</TransitionSeries>
      <ProgressBar theme={theme} />
    </AbsoluteFill>
  );
};
