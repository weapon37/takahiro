import {Composition} from 'remotion';
import {ShortVideo, ShortVideoProps} from './ShortVideo';
import {RankingVideo, RankingVideoProps} from './RankingVideo';
import {ContrarianVideo, ContrarianVideoProps} from './ContrarianVideo';
import {StoryVideo, StoryVideoProps} from './StoryVideo';
import {PortfolioVideo, PortfolioVideoProps} from './PortfolioVideo';
import defaultProps from './props.json';
import rankingProps from './props_ranking.json';
import contraProps from './props_contra.json';
import storyProps from './props_story.json';
import portfolioProps from './props_portfolio.json';

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
      {/* 🎥営業用ポートフォリオだけ横型(1920x1080)。HP掲載・商談用 */}
      <Composition
        id="PortfolioVideo"
        component={PortfolioVideo}
        fps={FPS}
        width={1920}
        height={1080}
        durationInFrames={300}
        defaultProps={portfolioProps as PortfolioVideoProps}
        calculateMetadata={({props}) => ({durationInFrames: byTotal(props.scenes)})}
      />
    </>
  );
};
