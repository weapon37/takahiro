import {Composition} from 'remotion';
import {AbsoluteFill} from 'remotion';

const Placeholder: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        color: 'white',
        fontSize: 60,
      }}
    >
      準備完了(ここに動画が入ります)
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ShortVideo"
      component={Placeholder}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
