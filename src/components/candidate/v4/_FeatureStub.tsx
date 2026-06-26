import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface StubProps {
  name: string;
  description?: string;
}

export default function V4FeatureStub({ name, description }: StubProps) {
  return (
    <Card className="bg-white/80 border-violet-100">
      <CardContent className="p-8 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-violet-600" />
        </div>
        <div className="text-lg font-semibold text-slate-800">{name}</div>
        <div className="text-sm text-slate-500 max-w-md mx-auto">
          {description ||
            "This section is being ported from the source project. Login, auth, profile bootstrap and tenant switching are fully wired to the ATS backend — additional V4 tabs will be brought over in follow-up iterations."}
        </div>
      </CardContent>
    </Card>
  );
}
