import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-tn-page px-6 text-center">
      <p className="m-0 font-serif text-2xl font-semibold text-tn-ink">Page not found</p>
      <Link to="/" className="font-sans text-sm font-medium text-tn-gold">
        Back to iGroom for Business
      </Link>
    </div>
  );
}

export default NotFoundPage;
