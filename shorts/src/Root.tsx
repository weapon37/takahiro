import {Composition} from 'remotion';
import {ShortVideo, ShortVideoProps} from './ShortVideo';
import {RankingVideo, RankingVideoProps} from './RankingVideo';
import defaultProps from './props.json';
import rankingProps from './props_ranking.json';

const FPS = 30;

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
        calculateMetadata={({props}) => {
          const total = props.scenes.reduce((a, s) => a + s.durationInFrames, 0);
          return {durationInFrames: Math.max(total, 30)};
        }}
      />
      <Composition
        id="RankingVideo"
        component={RankingVideo}
        fps={FPS}
        width={1080}
        height={1920}
        durationInFrames={300}
        defaultProps={rankingProps as RankingVideoProps}
        calculateMetadata={({props}) => {
          const total = props.scenes.reduce((a, s) => a + s.durationInFrames, 0);
          return {durationInFrames: Math.max(total, 30)};
        }}
      />
    </>
  );
};
