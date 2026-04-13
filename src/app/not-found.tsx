import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="panel p-8">
      <p className="eyebrow">Not Found</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        The requested page does not exist.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
        Use the primary navigation to return to an operational area of Metro
        Trailer.
      </p>
      <div className="mt-6">
        <Link
          href="/"
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          Return to overview
        </Link>
      </div>
    </section>
  );
}
