import { LanguageList } from "@/components/LanguageMenu";
import { t } from "@/i18n";

/**
 * Settings › Language. The choice is this device's, like a browser
 * setting — two people sharing the front-desk tablet see the same
 * language, and your phone can be in another.
 */
export function LanguageSettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 font-sans text-2xl font-semibold text-tn-ink">{t("Language")}</h1>
        <p className="m-0 font-sans text-sm text-tn-muted-5">
          {t("The language this app is shown in on this device.")}
        </p>
      </div>
      <LanguageList />
    </div>
  );
}

export default LanguageSettingsPage;
