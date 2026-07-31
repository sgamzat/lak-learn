import { Suspense } from "react";
import { SRSReviewScreen } from "@/components/srs/SRSReviewScreen";

export default function ReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
          <div className="h-64 w-full max-w-sm animate-pulse rounded-3xl bg-gray-200" />
        </div>
      }
    >
      <SRSReviewScreen />
    </Suspense>
  );
}
