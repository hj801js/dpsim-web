import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold">Not found</h2>
      <p className="text-slate-600 dark:text-slate-400">
        Nothing at this URL. Back to{" "}
        <Link href="/" className="text-blue-600 hover:underline">
          the dashboard
        </Link>
        .
      </p>
    </div>
  );
}
