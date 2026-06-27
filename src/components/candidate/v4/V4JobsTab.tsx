import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { V2ApplicationsList } from '@/components/candidate/V2ApplicationsList';
import { V4ApplicationTimeline } from './V4ApplicationTimeline';
import { DiscoverJobs } from './DiscoverJobs';
import { Briefcase, Compass } from 'lucide-react';

interface Props {
  candidateId: string;
  candidateEmail: string;
}

export function V4JobsTab({ candidateId, candidateEmail }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-3 sm:p-5 border border-violet-100 shadow-sm">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4 bg-violet-50">
          <TabsTrigger value="mine" className="data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
            <Briefcase className="h-4 w-4" /> My Applications
          </TabsTrigger>
          <TabsTrigger value="discover" className="data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm gap-2">
            <Compass className="h-4 w-4" /> Discover Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-0">
          <V2ApplicationsList key={refreshKey} candidateId={candidateId} DetailComponent={V4ApplicationTimeline} />
        </TabsContent>

        <TabsContent value="discover" className="mt-0">
          <DiscoverJobs
            candidateEmail={candidateEmail}
            onApplied={() => {
              setRefreshKey((k) => k + 1);
              setTab('mine');
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
