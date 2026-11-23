import { Link } from "react-router";
import { t } from "@/i18n";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-tn-page px-6 text-center">
      <p className="m-0 font-sans text-2xl font-semibold text-tn-ink">{t("Page not found")}</p>
      <Link to="/" className="font-sans text-sm font-medium text-tn-gold">
        {t("Back to iGroom for Business")}
      </Link>
    </div>
  );
}

export default NotFoundPage;
