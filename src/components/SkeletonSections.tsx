const SkeletonSections = () => {
  return (
    <div className="space-y-0">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="border-b rule-amber py-4">
          <div className="h-3 w-40 bg-border animate-pulse mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-border/50 animate-pulse" />
            <div className="h-3 w-5/6 bg-border/50 animate-pulse" />
            <div className="h-3 w-4/6 bg-border/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default SkeletonSections;
