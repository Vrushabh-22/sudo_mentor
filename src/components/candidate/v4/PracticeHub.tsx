import { useState } from 'react';
import { V4Bootstrap } from '@/pages/CandidatePortalV4';
import { MyLearningPaths } from './MyLearningPaths';
import { LearningPathView } from './LearningPathView';
import { DailyWorkout } from './practice/DailyWorkout';

interface Props { bootstrap: V4Bootstrap; onDone: () => void }

export function PracticeHub({ bootstrap, onDone }: Props) {
  const [openPath, setOpenPath] = useState<string | null>(null);

  if (openPath) {
    return <LearningPathView pathId={openPath} onBack={() => setOpenPath(null)} />;
  }

  return (
    <div className="space-y-6">
      <DailyWorkout bootstrap={bootstrap} onDone={onDone} />

      <div className="pt-2">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-sm font-semibold text-slate-700">Learning Paths</div>
          <div className="text-xs text-muted-foreground">deep-dives, on your own pace</div>
        </div>
        <MyLearningPaths onOpen={(id) => setOpenPath(id)} />
      </div>
    </div>
  );
}
