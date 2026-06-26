import Stub from "../_FeatureStub";

interface Props {
  bootstrap: any;
  onRefresh: () => void;
  candidateId: string;
  candidateEmail: string;
  fullscreen?: boolean;
}

export function MyBoardCanvas(_: Props) {
  return <Stub name="MyBoard" description="Drag-and-drop personal board for tracking applications, tasks and notes." />;
}
