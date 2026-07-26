import {Composition} from 'remotion';
import {ShortVideo, ShortVideoProps} from './ShortVideo';
import {RankingVideo, RankingVideoProps} from './RankingVideo';
import {ContrarianVideo, ContrarianVideoProps} from './ContrarianVideo';
import {StoryVideo, StoryVideoProps} from './StoryVideo';
import {MinimalVideo, MinimalVideoProps} from './MinimalVideo';
import defaultProps from './props.json';
import rankingProps from './props_ranking.json';
import contraProps from './props_contra.json';
import storyProps from './props_story.json';

const FPS = 30;

const byTotal = <T extends {durationInFrames: number}>(scenes: T[]) =>
  Math.max(scenes.reduce((a, s) => a + s.durationInFrames, 0), 30);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortVideo"
        component={ShortVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={defaultProps as ShortVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
      <Composition
        id="RankingVideo"
        component={RankingVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={rankingProps as RankingVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
      <Composition
        id="ContrarianVideo"
        component={ContrarianVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={contraProps as ContrarianVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
      {/* 実写ミニマル型: RankingVideo と同じpropsを流用できる */}
      <Composition
        id="MinimalVideo"
        component={MinimalVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={rankingProps as unknown as MinimalVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
      <Composition
        id="StoryVideo"
        component={StoryVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={storyProps as StoryVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
    </>
  );
};
