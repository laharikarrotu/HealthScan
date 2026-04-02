type RouteLoadingProps = {
  label: string;
};

export default function RouteLoading({ label }: RouteLoadingProps) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center bg-slate-50 text-slate-700">
      <div className="flex items-center gap-3 text-sm font-medium">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
          aria-hidden
        />
        <span>{label}</span>
      </div>
    </div>
  );
}
